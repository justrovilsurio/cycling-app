import { Router } from "express";
import { getStravaConnect, getStravaCallback } from "../controllers/strava.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, getStravaConnect);
router.get("/callback", getStravaCallback);

export default router;
