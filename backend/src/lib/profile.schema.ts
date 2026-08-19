import { z } from "zod";
import { RiderLevel } from "../generated/prisma/enums";

export const updateProfileSchema = z.object({
  level: z.nativeEnum(RiderLevel).optional(),
  weightKg: z.number().positive().min(30).max(250).optional(),
  heightCm: z.number().positive().min(100).max(250).optional(),
  age: z.number().int().positive().min(10).max(100).optional(),
  maxHr: z.number().int().positive().min(100).max(230).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
