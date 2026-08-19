import { prisma } from "../config/prisma";
import { UpdateProfileInput } from "../lib/profile.schema";

export async function getProfile(userId: string) {
  return prisma.riderProfile.findUnique({ where: { userId } });
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  return prisma.riderProfile.update({ where: { userId }, data });
}
