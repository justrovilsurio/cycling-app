import { Router } from "express";
import { getProfileHandler, updateProfileHandler } from "../controllers/profile.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, getProfileHandler);
router.put("/", requireAuth, updateProfileHandler);

export default router;
