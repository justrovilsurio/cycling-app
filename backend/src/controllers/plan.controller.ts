import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { getPrescription, getSuggestedEffort, pickTopSpot, WorkoutLike } from "../services/planService";

const WORKOUT_HISTORY_DAYS = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getTodayPlanHandler(req: Request, res: Response) {
  const userId = req.user!.id;

  const historyStart = new Date(Date.now() - WORKOUT_HISTORY_DAYS * MS_PER_DAY);

  const [profile, workouts, raceGoal] = await Promise.all([
    prisma.riderProfile.findUnique({ where: { userId } }),
    prisma.workout.findMany({ where: { userId, date: { gte: historyStart } } }),
    prisma.raceGoal.findFirst({
      where: { userId, date: { gte: new Date() } },
      orderBy: { date: "asc" },
    }),
  ]);

  const workoutsForPlan: WorkoutLike[] = workouts.map((workout) => ({
    date: workout.date,
    type: workout.type,
    durationMinutes: (workout.durationSeconds ?? 0) / 60,
  }));

  const { type: recommendedType, reason } = getPrescription(
    profile?.level ?? null,
    workoutsForPlan,
    raceGoal,
  );
  const suggestedEffort = getSuggestedEffort(recommendedType, profile?.maxHr ?? null);

  const spots = await prisma.spot.findMany({
    where: { suitableFor: { has: recommendedType } },
  });
  const { spot: topSpot, reason: spotReason, otherSpots } = pickTopSpot(recommendedType, spots);

  res.status(200).json({
    recommendedType,
    reason,
    suggestedEffort,
    topSpot,
    spotReason,
    otherSpots,
  });
}
