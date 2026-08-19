import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true },
  });

  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }

  res.status(200).json(user);
}
