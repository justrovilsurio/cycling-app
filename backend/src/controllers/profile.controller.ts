import { Request, Response } from "express";
import { updateProfileSchema } from "../lib/profile.schema";
import { getProfile, updateProfile } from "../services/profile.service";

export async function getProfileHandler(req: Request, res: Response) {
  const profile = await getProfile(req.user!.id);
  res.status(200).json(profile);
}

export async function updateProfileHandler(req: Request, res: Response) {
  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid profile data", details: result.error.flatten() });
    return;
  }

  const profile = await updateProfile(req.user!.id, result.data);
  res.status(200).json(profile);
}
