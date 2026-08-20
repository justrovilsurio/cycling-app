import { Request, Response } from "express";
import { stravaCallbackQuerySchema } from "../lib/strava.schema";
import { generateState, consumeState } from "../lib/stravaState";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  saveStravaToken,
  StravaTokenExchangeError,
} from "../services/strava.service";

export function getStravaConnect(req: Request, res: Response) {
  const state = generateState(req.user!.id);
  res.redirect(buildAuthorizeUrl(state));
}

export async function getStravaCallback(req: Request, res: Response) {
  if (req.query.error) {
    res.status(200).send("Strava connection cancelled. You can close this tab.");
    return;
  }

  const result = stravaCallbackQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: "Invalid callback parameters", details: result.error.flatten() });
    return;
  }

  const { code, state } = result.data;

  // The CSRF check: this state must be one we generated in getStravaConnect
  // and haven't already consumed. It also doubles as how we recover which
  // of our users this callback belongs to, since this request carries no JWT.
  const userId = consumeState(state);
  if (!userId) {
    res.status(403).json({ error: "Invalid or expired state" });
    return;
  }

  try {
    const token = await exchangeCodeForToken(code);
    await saveStravaToken(userId, token);
  } catch (err) {
    if (err instanceof StravaTokenExchangeError) {
      res.status(502).json({ error: "Failed to connect to Strava" });
      return;
    }
    throw err;
  }

  res.status(200).send("Strava account connected! You can close this tab.");
}
