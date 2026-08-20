import { z } from "zod";

export const stravaCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type StravaCallbackQuery = z.infer<typeof stravaCallbackQuerySchema>;
