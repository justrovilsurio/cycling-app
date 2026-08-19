import { Router } from "express";
import { postSignup, postLogin } from "../controllers/auth.controller";

const router = Router();

router.post("/signup", postSignup);
router.post("/login", postLogin);

export default router;
