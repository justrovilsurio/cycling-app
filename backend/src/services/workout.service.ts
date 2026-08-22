import { prisma } from "../config/prisma";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function listWorkouts(userId: string, from?: Date, to?: Date) {
  // `to` is inclusive of the whole day, so filter with an exclusive
  // upper bound at the start of the next day rather than `to` itself.
  const exclusiveTo = to && new Date(to.getTime() + MS_PER_DAY);

  return prisma.workout.findMany({
    where: {
      userId,
      ...((from || exclusiveTo) && {
        date: {
          ...(from && { gte: from }),
          ...(exclusiveTo && { lt: exclusiveTo }),
        },
      }),
    },
    orderBy: { date: "desc" },
  });
}
