import { Router } from "express";
import { listWorkoutsHandler } from "../controllers/workout.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, listWorkoutsHandler);

export default router;
