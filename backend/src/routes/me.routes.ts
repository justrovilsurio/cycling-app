import { Router } from "express";
import { getMe } from "../controllers/me.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, getMe);

export default router;
