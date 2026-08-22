import { Router } from "express";
import { getTodayPlanHandler } from "../controllers/plan.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/today", requireAuth, getTodayPlanHandler);

export default router;
