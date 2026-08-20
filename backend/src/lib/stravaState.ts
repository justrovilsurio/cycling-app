import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
  userId: string;
  expiresAt: number;
}

const pendingStates = new Map<string, PendingState>();

function sweepExpired() {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (entry.expiresAt <= now) {
      pendingStates.delete(state);
    }
  }
}

export function generateState(userId: string): string {
  sweepExpired();
  const state = crypto.randomBytes(24).toString("hex");
  pendingStates.set(state, { userId, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

// Single-use: a state is consumed (deleted) the moment it's looked up, so a
// leaked or replayed callback URL can't be used twice.
export function consumeState(state: string): string | null {
  const entry = pendingStates.get(state);
  if (!entry) return null;

  pendingStates.delete(state);
  if (entry.expiresAt <= Date.now()) return null;

  return entry.userId;
}
