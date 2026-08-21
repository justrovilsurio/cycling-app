import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { WorkoutSource, WorkoutType, IntensityZone } from "../generated/prisma/enums";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const REQUESTED_SCOPE = "activity:read_all";

const SYNC_WINDOW_DAYS = 60;
const ACTIVITIES_PER_PAGE = 200;
const MAX_PAGES = 5; // safety bound — 1000 activities comfortably covers 60 days

const RECOVERY_MAX_AVG_SPEED_KMH = 22;
const RECOVERY_MAX_DISTANCE_METERS = 30_000;
// suffer_score (Strava's HR-derived "Relative Effort") scaled to a per-hour
// rate, so a short hard ride and a long hard ride are compared fairly. No
// real user data to calibrate against yet — a reasonable starting point,
// easy to retune once we see how it classifies actual rides.
const INTERVAL_SUFFER_SCORE_PER_HOUR = 70;
// Fallback hard-effort signal for rides with no HR data at all (so no
// suffer_score either): average power per kg bodyweight. Same "reasonable
// starting point, easy to retune" caveat — we have no FTP on file to
// benchmark against, just a flat W/kg cutoff.
const INTERVAL_WATTS_PER_KG = 3.0;

const CYCLING_SPORT_TYPES = new Set([
  "Ride",
  "VirtualRide",
  "GravelRide",
  "MountainBikeRide",
  "EBikeRide",
]);

export class StravaTokenExchangeError extends Error {}
export class StravaNotConnectedError extends Error {}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete: { id: number };
}

// Strava omits `athlete` on a refresh-token grant — it's only sent alongside
// the initial authorization-code exchange.
interface StravaRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface StravaActivity {
  id: number;
  sport_type: string;
  start_date: string; // ISO 8601 UTC
  distance: number; // meters
  moving_time: number; // seconds
  average_speed: number; // meters/second
  average_heartrate?: number;
  // Strava's auto-computed "Relative Effort", derived from HR data. Absent
  // if the ride has no heart-rate data for Strava to compute it from.
  suffer_score?: number;
  // Average power in watts — from a real power meter, or Strava's own
  // speed/grade-based estimate ("virtual power") when there's no meter.
  // Either way, present even on rides with no HR data at all.
  average_watts?: number;
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.stravaClientId);
  url.searchParams.set("redirect_uri", env.stravaRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", REQUESTED_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new StravaTokenExchangeError(`Strava token exchange failed: ${response.status}`);
  }

  return (await response.json()) as StravaTokenResponse;
}

export async function saveStravaToken(userId: string, token: StravaTokenResponse) {
  const data = {
    athleteId: String(token.athlete.id),
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(token.expires_at * 1000),
  };

  return prisma.stravaToken.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<StravaRefreshResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new StravaTokenExchangeError(`Strava token refresh failed: ${response.status}`);
  }

  return (await response.json()) as StravaRefreshResponse;
}

// Returns a valid access token for the user, refreshing and persisting a new
// one first if the stored token has already expired. Every call site that
// talks to Strava's API should go through this rather than reading
// StravaToken.accessToken directly.
async function getValidAccessToken(userId: string): Promise<string> {
  const stravaToken = await prisma.stravaToken.findUnique({ where: { userId } });
  if (!stravaToken) {
    throw new StravaNotConnectedError(`User ${userId} has not connected Strava`);
  }

  if (stravaToken.expiresAt > new Date()) {
    return stravaToken.accessToken;
  }

  const refreshed = await refreshAccessToken(stravaToken.refreshToken);
  await prisma.stravaToken.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(refreshed.expires_at * 1000),
    },
  });

  return refreshed.access_token;
}

async function fetchRecentActivities(accessToken: string): Promise<StravaActivity[]> {
  const afterUnixSeconds = Math.floor(
    (Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000,
  );

  const activities: StravaActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(STRAVA_ACTIVITIES_URL);
    url.searchParams.set("after", String(afterUnixSeconds));
    url.searchParams.set("per_page", String(ACTIVITIES_PER_PAGE));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new StravaTokenExchangeError(`Strava activities fetch failed: ${response.status}`);
    }

    const pageActivities = (await response.json()) as StravaActivity[];
    activities.push(...pageActivities);

    if (pageActivities.length < ACTIVITIES_PER_PAGE) {
      break; // short page means this was the last one
    }
  }

  return activities;
}

// Classifies by effort only — WorkoutType no longer has a duration-based
// value. "Was this ride long" is fully answerable from Workout.distanceMeters
// directly, so nothing needs a category for it.
function deriveWorkoutType(activity: StravaActivity, weightKg: number | null): WorkoutType {
  const avgSpeedKmh = activity.average_speed * 3.6;
  if (avgSpeedKmh <= RECOVERY_MAX_AVG_SPEED_KMH && activity.distance < RECOVERY_MAX_DISTANCE_METERS) {
    return WorkoutType.RECOVERY;
  }

  if (isHardEffort(activity, weightKg)) {
    return WorkoutType.INTERVAL;
  }

  return WorkoutType.ENDURANCE;
}

// "Was this an unusually hard effort for its duration" — prefers suffer_score
// (Strava's HR-derived Relative Effort, already calibrated to the athlete's
// own zones) and falls back to average power per kg bodyweight when there's
// no HR data at all. Neither signal sees the on/off shape of real intervals
// (that needs per-activity stream data, ruled out earlier for its API cost)
// — both are approximations of "this was hard," not literal interval
// detection.
function isHardEffort(activity: StravaActivity, weightKg: number | null): boolean {
  const movingHours = activity.moving_time / 3600;
  if (movingHours <= 0) {
    return false;
  }

  if (activity.suffer_score) {
    return activity.suffer_score / movingHours >= INTERVAL_SUFFER_SCORE_PER_HOUR;
  }

  if (activity.average_watts && weightKg) {
    return activity.average_watts / weightKg >= INTERVAL_WATTS_PER_KG;
  }

  return false;
}

// Buckets avgHeartRate as a fraction of the rider's max HR into the five
// IntensityZone bands (standard %-of-max-HR zones). Falls back to a flat
// ENDURANCE placeholder when either value is unavailable — Strava may omit
// HR data, and RiderProfile.maxHr is optional.
function deriveIntensityZone(avgHeartRate: number | undefined, maxHr: number | null): IntensityZone {
  if (!avgHeartRate || !maxHr) {
    return IntensityZone.ENDURANCE;
  }

  const pctOfMax = avgHeartRate / maxHr;
  if (pctOfMax < 0.6) return IntensityZone.RECOVERY;
  if (pctOfMax < 0.7) return IntensityZone.ENDURANCE;
  if (pctOfMax < 0.8) return IntensityZone.TEMPO;
  if (pctOfMax < 0.9) return IntensityZone.THRESHOLD;
  return IntensityZone.VO2MAX;
}

export interface SyncResult {
  created: number;
  updated: number;
  total: number;
}

export async function syncStravaActivities(userId: string): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(userId);
  const activities = await fetchRecentActivities(accessToken);
  const cyclingActivities = activities.filter((activity) =>
    CYCLING_SPORT_TYPES.has(activity.sport_type),
  );

  const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
  const maxHr = riderProfile?.maxHr ?? null;
  const weightKg = riderProfile?.weightKg ?? null;

  const activityIds = cyclingActivities.map((activity) => String(activity.id));
  const existing = await prisma.workout.findMany({
    where: { stravaActivityId: { in: activityIds } },
    select: { stravaActivityId: true },
  });
  const existingIds = new Set(existing.map((workout) => workout.stravaActivityId));

  let created = 0;
  let updated = 0;

  for (const activity of cyclingActivities) {
    const stravaActivityId = String(activity.id);
    const data = {
      date: new Date(activity.start_date),
      type: deriveWorkoutType(activity, weightKg),
      intensity: deriveIntensityZone(activity.average_heartrate, maxHr),
      distanceMeters: activity.distance,
      durationSeconds: activity.moving_time,
      avgHeartRate: activity.average_heartrate ?? null,
      source: WorkoutSource.STRAVA,
    };

    await prisma.workout.upsert({
      where: { stravaActivityId },
      create: { userId, stravaActivityId, ...data },
      update: data,
    });

    if (existingIds.has(stravaActivityId)) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated, total: cyclingActivities.length };
}
