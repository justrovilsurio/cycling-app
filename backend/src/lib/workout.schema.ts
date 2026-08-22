import { z } from "zod";

export const listWorkoutsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;
