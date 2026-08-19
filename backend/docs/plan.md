# Cycling Training Planner — Final Build Plan

## v1 Scope (locked in)

- **Multi-user**, capped early audience (see Strava constraint below)
- **Strava OAuth**: pulls activities (training history) and the athlete's own saved routes — no manual entry
- **Curated spot database**: named local spots (Vermosa, Davilan, etc.) tagged by terrain type (road/MTB) and difficulty — matched against the day's prescribed intensity
- **Rider profile**: cycling level (casual / mid / racing), weight, height, age, max HR
- **Optional daily inputs**: hours slept, upcoming race + race type
- **Full calendar view**: past + upcoming sessions
- **Deferred to v2**: bike weight/tire-based effort modeling, Komoot/OneLapFit integration, Strava's location-based route discovery (needs Extended Access)

---

## 1. Stack Recommendation

### Frontend: React (Vite) + Tailwind

Vite, not Next.js, since the backend is now a separate Express service — you don't need Next.js's server-rendering machinery if nothing runs server-side in the frontend repo. Vite gives you a fast dev server and build step without the extra concepts (server components, API routes) that only make sense when frontend and backend share a repo. Same React + Tailwind you already know.

### Backend: Express + TypeScript (separate service)

This is the right call for what you said you want — real-world backend practice that transfers beyond one framework's conventions. A few honest trade-offs since you're choosing this over the simpler path:

- **You now own two deploys, two sets of env vars, and CORS.** Your Express API needs to explicitly allow requests from your Vercel frontend's domain (`cors` middleware, one `origin` config line — small, but it's a new failure mode that doesn't exist in a single-repo setup: "why is my frontend getting blocked" is a rite of passage).
- **You're not sharing types automatically between frontend and backend** the way a single Next.js repo would let you. Worth setting up a shared `types` package or just duplicating your key interfaces (Workout, RiderProfile, etc.) in both repos for now — a monorepo tool (Turborepo, Nx) solves this properly but is its own thing to learn; skip it for v1 and revisit if the duplication gets painful.
- **What you get in return**: an API that's a standalone, framework-agnostic service — the pattern used at most companies with a dedicated backend team, and knowledge that transfers directly to any future Node backend job, not just Next.js shops.

Structure it as a standard layered Express app: routes → controllers → services → database access. That layering is the actual "real world" habit worth building now — it's what makes an Express app testable and maintainable as it grows, versus one big file of route handlers.

### Auth: roll your own (JWT + bcrypt), not Supabase Auth

This is the one place I'd steer you away from the "obvious" shortcut. Supabase ships a full Auth product, and it would save you time — but if the reason you wanted Express is to practice real-world backend setup, letting Supabase's Auth handle login defeats that specific purpose. You'd be back to barely touching backend auth code, just from a different vendor.

**Recommendation: build auth yourself in Express.** Signup hashes passwords with `bcrypt`, login issues a signed JWT (`jsonwebtoken`), and an Express middleware verifies that JWT on protected routes. This is the single most valuable "real world" pattern to actually practice — nearly every backend job expects you to understand this flow, not just call a vendor's SDK. Supabase, in this setup, becomes *purely* your hosted Postgres database — nothing more.

*Caveat:* rolling your own auth means you're responsible for getting the security details right (password hashing rounds, JWT expiry + refresh token rotation, rate-limiting login attempts against brute force). This is more work and more risk than Supabase Auth. If at any point your training/work schedule makes this a bottleneck, falling back to Supabase Auth is a reasonable pragmatic call — just know you're trading learning depth for speed if you do.

### Database: Postgres via Supabase — used as hosted Postgres only

Same reasoning as before on Postgres itself: your data (users, profiles, workouts, spots, race goals) is relational, foreign-key-heavy, exactly what Postgres is for. Supabase remains a good *hosting* choice for that Postgres instance — reliable, generous free tier, easy dashboard for inspecting data while you build. You just won't use its Auth or auto-generated REST API layer, since Express talks to the database directly.

### ORM: Prisma over Drizzle

Both are solid in 2026, but they optimize for different things. Drizzle's main edge is minimal bundle size and fast cold starts on edge/serverless runtimes (Cloudflare Workers, Vercel Edge Functions) — irrelevant to you, since Express on Render is a traditional long-running Node process, not an edge function. Prisma's edge is developer experience: a readable schema file, `prisma migrate` for versioned schema changes, and Prisma Studio for browsing your data visually — all of which matter more when you're still learning schema design and want fast feedback loops.

**Pick: Prisma.** If you later build something that deploys to the edge, Drizzle becomes the better call then — worth knowing the distinction, not worth switching now.

---

## 2. Deployment Plan

### Frontend: Vercel

Deploys your Vite build as a static site. Zero-config, automatic preview URLs per pull request, generous free tier for a project this size. No change from before — this part was never in question.

### Backend: Render, not Railway

Railway no longer has a meaningful free tier for a real API + database combo — as of 2026 it requires the Hobby plan at $5/month minimum just to run one service persistently, and that's before adding a database. Render's free tier, by contrast, genuinely costs $0: 750 instance hours per month, no credit card required. The catch is real and worth knowing upfront — a free Render web service spins down after 15 minutes of no traffic, and the next request takes about a minute to wake it back up. For a training app people check once or twice a day, that's a mildly annoying "first load is slow" moment, not a dealbreaker. When you're ready to remove it, Render's paid tier starts at $7/month for an always-on instance.

**Pick: Render for the Express API**, upgrade to the $7/month tier once cold starts actually bother real users (not on day one).

### Database: Supabase

Free tier covers this comfortably: 500 MB database storage and 50,000 monthly active users tracked (though you're not using Supabase's user tracking directly, that ceiling isn't your binding constraint — database size is, and 500 MB is a lot of headroom for structured rows like workouts and profiles, not media). One real gotcha: free Supabase projects auto-pause after 7 days of zero API activity and need a manual restart from the dashboard. Not an issue once users are active daily, but if you go quiet for a week during a race taper, check on it.

### Realistic cost once you outgrow free tier
Supabase Pro starts at $25/month past the free caps. Render's always-on tier is $7/month. Budget roughly $30–40/month combined once you're past free tiers — not a launch-day concern, but know it's coming as "Rov is Cycling" grows.

### Strava API — affects your rollout timeline, not your stack
Strava restructured developer access in June 2026. Standard Tier gives you up to 10 connected users and requires you to hold an active Strava subscription — no approval wait. Beyond 10 users, you need Extended Access Tier approval, which has its own timeline you don't control. **Launch to a small beta group first, and submit the Extended Access application in parallel** — don't plan a public opening date around same-day approval.

---

## 3. Setup Steps

1. **Register your Strava API application** at strava.com/settings/api. Client ID and Secret — the Secret lives only in your Express server's env vars, never in the React frontend, since frontend code is fully visible to anyone who opens dev tools.

2. **Set up two repos** (or two folders in one repo if you'd rather keep them together for now — a true monorepo tool is overkill for v1): `cycling-app-frontend` (Vite + React + Tailwind) and `cycling-app-backend` (Express + TypeScript). Two repos more accurately mirrors the "real world scalable" setup you're after — separate deploy pipelines, separate versioning.

3. **Scaffold the Express backend**: TypeScript, `express`, `cors`, `dotenv`, `bcrypt`, `jsonwebtoken`, `@prisma/client` + `prisma` as dev dependency. Set up the layered structure early (`routes/`, `controllers/`, `services/`, `middleware/`) even with just one route — retrofitting structure onto a flat pile of route handlers later is more painful than starting with it.

4. **Create the Supabase project**, grab the Postgres connection string (not the Supabase client keys — you're connecting directly via Prisma, not through Supabase's SDK). Design your schema in `schema.prisma` before writing any routes: `User` (email, hashed password), `RiderProfile` (linked to User: level, weight, height, age, max HR), `Workout` (date, type, intensity, linked Spot, source: manual/strava), `Spot` (name, terrain type, difficulty score), `RaceGoal` (date, race type), `StravaToken` (access/refresh tokens per user — treat this table as sensitive, it's effectively a credential store). Sketching this on paper first saves you from restructuring mid-build.

5. **Run your first Prisma migration** (`prisma migrate dev`) against the Supabase database to create these tables, then generate the typed client (`prisma generate`). This is the moment you find out if your schema relationships actually make sense — expect to adjust it once or twice here, that's normal.

6. **Build auth**: signup route hashes the password with bcrypt and stores the user; login route verifies the password and issues a JWT; an `authMiddleware` function verifies the JWT on every protected route and attaches the user ID to the request. Write this before anything else that needs a logged-in user — every other feature depends on knowing who's asking.

7. **Build the Strava OAuth flow** as Express routes: `/auth/strava` redirects to Strava's authorize URL, `/auth/strava/callback` receives the code, exchanges it server-side for access/refresh tokens, and stores them in `StravaToken` linked to the logged-in user. This is a second, separate flow from step 6 — your app's login and "connecting Strava" are two different things a user does at different times.

8. **Pull activities on-demand for v1**: a "Sync my Strava data" button on the frontend calls a protected Express route that fetches `/athlete/activities` using the stored token, and writes new workouts into your database. Defer Strava's webhook-based real-time push to v2 — it requires a publicly reachable endpoint and signature verification, real complexity not worth taking on before the core app works.

9. **Build the plan-matching logic as a plain service function** (not tied to any route): given rider level + recent training load (from synced activities) + optional race goal, return today's prescribed intensity, then query the `Spot` table filtered by matching difficulty. Keep it pure and testable — you'll tune the matching rules over time without touching route or React code.

10. **Set up CORS** in Express to allow only your Vercel frontend's domain, and configure environment variables in both Vercel (frontend) and Render (backend) dashboards — they don't read from your local `.env` files, you re-enter them per platform.

11. **First deploys**: push the backend to Render and the frontend to Vercel, wired to each other via the deployed API URL (not `localhost`) in the frontend's env config. Do this early, even with just signup/login working, so you catch CORS and env var issues while the app is small.

---

## 4. Deliberately Left Out of v1 (v2 backlog)

- **Bike weight/tire-type effort adjustment** — real physiological modeling, disproportionate complexity for v1 value. You flagged this yourself as not a priority.
- **Komoot / OneLapFit integration** — each is a separate OAuth + API integration; Strava alone covers most riders for v1.
- **Strava location-based route discovery (Explore Segments)** — gated behind Extended Access Tier approval as of September 2026.
- **Strava webhooks (real-time sync)** — start with manual/on-demand sync; add push-based sync once core plan-matching is solid.
- **Monorepo tooling (Turborepo/Nx) for shared types** — duplicate types across the two repos for now; revisit if the duplication becomes a real maintenance drag.
- **Supabase Auth as a fallback** — noted above as an escape hatch if your own JWT auth becomes a time sink, not something to build in parallel.
