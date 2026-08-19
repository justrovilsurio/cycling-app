import bcrypt from "bcrypt";
import { prisma } from "../config/prisma";
import { signToken } from "../lib/jwt";

const SALT_ROUNDS = 10;

export class DuplicateEmailError extends Error {}
export class InvalidCredentialsError extends Error {}

export async function signup(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new DuplicateEmailError();
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      // Empty profile row — filled in later via an update, never a second insert.
      riderProfile: { create: {} },
    },
  });

  const token = signToken({ userId: user.id });
  return { user: { id: user.id, email: user.email }, token };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  const token = signToken({ userId: user.id });
  return { user: { id: user.id, email: user.email }, token };
}
