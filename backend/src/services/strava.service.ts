import { prisma } from "../config/prisma";
import { env } from "../config/env";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const REQUESTED_SCOPE = "activity:read_all";

export class StravaTokenExchangeError extends Error {}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete: { id: number };
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
