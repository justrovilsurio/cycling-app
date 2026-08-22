import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { WorkoutType } from "../generated/prisma/enums";
import { getValidAccessToken } from "../services/strava.service";

const STRAVA_SEGMENT_URL = "https://www.strava.com/api/v3/segments";

// Independent, stacking checks (not one exclusive if/else chain) — a segment
// can be both interval-worthy and, separately, still get ENDURANCE.
const MIN_GRADE_FOR_INTERVAL = 5; // percent
const MIN_LENGTH_FOR_INTERVAL_METERS = 500;
const FLAT_ELEVATION_GAIN_PER_KM_THRESHOLD = 15; // m/km
// A second, independent path to INTERVAL: short climbs people lap as hill
// repeats (e.g. Cardiac Hill: 4% average grade, well under
// MIN_GRADE_FOR_INTERVAL, but short and steep enough per km to be a real
// repeats spot). Judged on gain-per-km rather than average grade over the
// whole segment, since a short climb's average grade dilutes fast.
const MAX_LENGTH_FOR_REPEATS_METERS = 3000;
const REPEATS_MIN_GAIN_PER_KM = 25; // m/km — steeper than "not flat" (15), short of a sustained long climb

interface StravaSegment {
  id: number;
  name: string;
  distance: number; // meters
  average_grade: number; // percent
  maximum_grade: number; // percent
  // Strava's own computed gain from the elevation profile — not the same as
  // elevation_high - elevation_low, which ignores rollers within the segment.
  total_elevation_gain: number; // meters
  climb_category: number; // Strava's own 0-5 rating, informational only
}

function deriveSuitableFor(segment: StravaSegment): WorkoutType[] {
  const suitable = new Set<WorkoutType>();
  const gainPerKm = segment.total_elevation_gain / (segment.distance / 1000);

  // Sustained climbs: steep and long enough, as a whole, to be a structured
  // hard effort in one shot.
  if (
    segment.average_grade >= MIN_GRADE_FOR_INTERVAL &&
    segment.distance >= MIN_LENGTH_FOR_INTERVAL_METERS
  ) {
    suitable.add(WorkoutType.INTERVAL);
  }

  // Repeats climbs: short enough to lap several times in a session, and
  // steep per km even if the average grade over the whole segment doesn't
  // clear MIN_GRADE_FOR_INTERVAL.
  if (segment.distance <= MAX_LENGTH_FOR_REPEATS_METERS && gainPerKm >= REPEATS_MIN_GAIN_PER_KM) {
    suitable.add(WorkoutType.INTERVAL);
  }

  if (gainPerKm < FLAT_ELEVATION_GAIN_PER_KM_THRESHOLD) {
    suitable.add(WorkoutType.RECOVERY);
    suitable.add(WorkoutType.ENDURANCE);
  } else {
    suitable.add(WorkoutType.ENDURANCE);
  }

  return Array.from(suitable);
}

// Solo-dev tool, no HTTP request/JWT to carry a user id. Exactly one
// StravaToken row is the expected steady state right now; anything else
// needs --user rather than silently guessing which token to use.
async function resolveUserId(userEmail: string | undefined): Promise<string> {
  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      throw new Error(`No user found with email ${userEmail}`);
    }
    return user.id;
  }

  const tokens = await prisma.stravaToken.findMany({ select: { userId: true } });
  if (tokens.length === 0) {
    throw new Error("No StravaToken rows found. Connect Strava first.");
  }
  if (tokens.length > 1) {
    throw new Error(`Found ${tokens.length} StravaToken rows. Pass --user <email> to pick one.`);
  }
  return tokens[0].userId;
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  let userEmail: string | undefined;
  const userFlagIndex = args.indexOf("--user");
  if (userFlagIndex !== -1) {
    userEmail = args[userFlagIndex + 1];
    args.splice(userFlagIndex, 2);
  }

  const [segmentId, spotId] = args;
  if (!segmentId || !spotId) {
    console.error(
      "Usage: npx tsx src/scripts/importSpotSegment.ts <segmentId> <spotId> [--user <email>]",
    );
    process.exit(1);
  }

  return { segmentId, spotId, userEmail };
}

async function main() {
  const { segmentId, spotId, userEmail } = parseArgs(process.argv.slice(2));

  const userId = await resolveUserId(userEmail);
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(`${STRAVA_SEGMENT_URL}/${segmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 403) {
      console.error(
        `Strava returned 403 fetching segment ${segmentId}. The OAuth scope ` +
          `requested at connect-time (Milestone 5: "activity:read_all" only) ` +
          `likely needs "read" added for segment access — flagging this as a ` +
          `probable scope gap rather than guessing at a fix.`,
      );
      process.exit(1);
    }
    console.error(`Strava segment fetch failed: ${response.status} ${await response.text()}`);
    process.exit(1);
  }

  const segment = (await response.json()) as StravaSegment;
  const suitableFor = deriveSuitableFor(segment);

  try {
    const spot = await prisma.spot.update({
      where: { id: spotId },
      data: {
        averageGradePercent: segment.average_grade,
        maxGradePercent: segment.maximum_grade,
        distanceMeters: segment.distance,
        elevationGainMeters: segment.total_elevation_gain,
        climbCategory: segment.climb_category,
        suitableFor,
      },
    });

    console.log(`Fetched segment ${segment.id} ("${segment.name}") from Strava.\n`);
    console.log("Raw fields:");
    console.log(`  distance:             ${segment.distance} m`);
    console.log(`  average_grade:        ${segment.average_grade} %`);
    console.log(`  maximum_grade:        ${segment.maximum_grade} %`);
    console.log(`  total_elevation_gain: ${segment.total_elevation_gain} m`);
    console.log(
      `  climb_category:       ${segment.climb_category} (Strava's own 0-5 rating, not used in derivation)\n`,
    );
    console.log(`Derived suitableFor: [${suitableFor.join(", ")}]\n`);
    console.log(`Updated Spot ${spot.id} ("${spot.name}").`);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      console.error(`No Spot found with id ${spotId}`);
      process.exit(1);
    }
    throw err;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
