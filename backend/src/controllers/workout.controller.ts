import { Request, Response } from "express";
import { listWorkoutsQuerySchema } from "../lib/workout.schema";
import { listWorkouts } from "../services/workout.service";

export async function listWorkoutsHandler(req: Request, res: Response) {
  const result = listWorkoutsQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: "Invalid query parameters", details: result.error.flatten() });
    return;
  }

  const { from, to } = result.data;
  const workouts = await listWorkouts(req.user!.id, from, to);
  res.status(200).json(workouts);
}
