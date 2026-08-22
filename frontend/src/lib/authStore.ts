// Plain module (no React) so non-component code, like the fetch wrapper in
// api.ts, can read the current token and trigger a logout without hooks.
// AuthContext is the source of truth for rendering — it mirrors every
// change into this store.

let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getToken() {
  return token;
}

export function setToken(next: string | null) {
  token = next;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}
