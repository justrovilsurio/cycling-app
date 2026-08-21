import { Router } from "express";
import { getStravaConnect, getStravaCallback, postStravaSync } from "../controllers/strava.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, getStravaConnect);
router.get("/callback", getStravaCallback);
router.post("/sync", requireAuth, postStravaSync);

export default router;
