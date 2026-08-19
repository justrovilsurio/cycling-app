import { Request, Response } from "express";
import { isValidEmail, isValidPassword } from "../lib/validators";
import {
  signup,
  login,
  DuplicateEmailError,
  InvalidCredentialsError,
} from "../services/auth.service";

export async function postSignup(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }
  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const result = await signup(email, password);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    throw err;
  }
}

export async function postLogin(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!isValidEmail(email) || !isValidPassword(password)) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const result = await login(email, password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    throw err;
  }
}
