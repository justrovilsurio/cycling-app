# Auth state: why Context, and how the pieces fit together

This walks through the reasoning behind `src/context/AuthContext.tsx`,
`src/lib/authStore.ts`, and `src/lib/api.ts` — written for future reference
since Context was new the first time this was built.

## Why Context at all

There's one piece of state — "who's logged in, with what token" — that needs
to be read from components all over the tree: the login form writes it, the
header/nav will read it to show the logged-in user, and every API call needs
the token. Passing that through props would mean threading
`user`/`token`/`login`/`logout` through every intermediate component that
doesn't care about auth, just so it reaches the ones that do ("prop
drilling"). Context lets any component under a provider read the value
directly, without it being passed down manually at every level.

This is the right tool specifically because the state is low-frequency
(changes on login/logout, not on every keystroke) and genuinely global. For
state that's local to one feature, or that changes very often, plain
`useState`/`useReducer` in a lower component — or colocated state — is
usually a better fit than reaching for Context.

## The three-part shape

Every Context setup in React has the same three pieces
(see [AuthContext.tsx](../src/context/AuthContext.tsx)):

1. **`createContext<AuthContextValue | undefined>(undefined)`** — the
   channel itself. It's typed as possibly-`undefined` because that's the
   real value a consumer would get if no provider is wrapping it — the type
   is being honest about that failure mode rather than lying with a fake
   default.

2. **`AuthProvider`** — an ordinary component. It holds the actual
   `useState` for `user` and `token`, defines `login`/`logout`, and renders
   `<AuthContext.Provider value={...}>{children}</AuthContext.Provider>`.
   Nothing magic here — it's a component like any other, it just happens to
   make `value` available to everything it wraps without passing it as a
   prop.

3. **`useAuth()`** — a thin wrapper around `useContext(AuthContext)` that
   throws if called outside a provider. Without that check, forgetting to
   wrap `<App />` in `<AuthProvider>` (see `main.tsx`) would silently hand
   every consumer `undefined`, and it would fail confusingly later wherever
   someone tries to destructure `.user` off it. Throwing immediately at the
   call site turns a confusing bug into an obvious one.

## The one non-obvious wrinkle: `authStore.ts`

`api.ts`'s `apiFetch` needs to read the current token on every request, and
needs to be able to trigger a logout when it sees a 401 back from the
server. But `apiFetch` is a plain function, not a component — it can't call
`useContext`, because hooks only work inside the render tree.

The fix is a tiny module with no React in it at all
([authStore.ts](../src/lib/authStore.ts)): it holds the token in a plain
variable, plus a single registered "unauthorized" callback.

- `AuthProvider` is still the source of truth for anything that needs
  re-renders — that's still plain React state.
- Every time that state changes (`login`, `logout`), it also mirrors the new
  value into `authStore` via `setToken`.
- `AuthProvider` registers its own `logout` as `authStore`'s
  unauthorized-handler in a `useEffect` on mount.
- `apiFetch` only ever talks to `authStore` — `getToken()` to attach the
  header, `notifyUnauthorized()` on a 401 — never to React directly.

This is a standard escape hatch for "state that both React and non-React
code need to read," not something unusual to this project. The alternative
(passing the token into every `fetch` call manually, from every component)
is exactly the manual-handling-in-every-component problem the fetch wrapper
exists to avoid.

## The full lifecycle, traced end to end

1. User submits the login form → `login(email, password)` calls
   `apiFetch('/auth/login', ...)`.
2. On success, `AuthProvider` sets `user`/`token` React state (triggers a
   re-render) **and** calls `authStore.setToken(token)`.
3. Later, any component calls `apiFetch(...)` for some other request →
   `apiFetch` reads `authStore.getToken()` and attaches
   `Authorization: Bearer <token>`.
4. If the server ever responds 401 (expired or invalid token), `apiFetch`
   calls `authStore.notifyUnauthorized()`.
5. That's wired to `AuthProvider`'s `logout`, which clears `user`/`token`
   state and calls `authStore.setToken(null)`.
6. `App.tsx` renders based on `useAuth().user` — once it's `null`, it
   re-renders `<LoginForm />`.

No router is involved in step 6 — see the "No router yet" note in
`frontend/CLAUDE.md`'s Architecture conventions. The context state flipping
is the entire "redirect."
