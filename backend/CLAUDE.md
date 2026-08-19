# Project overview

Multi-user cycling training planner. Generates daily training intensity based on rider level, recent training load (synced from Strava), and race goals, then suggests a matching local spot. Built by a frontend dev (React) learning full-stack — see "How to work with me" below, it's not optional.

Full architecture and the reasoning behind every stack choice: see `docs/plan.md` in this repo. Read it before proposing anything that deviates from it.

# Tech stack

- Backend: Express + TypeScript (this repo) — deployed on Render
- ORM: Prisma
- Database: Postgres, hosted on Supabase — used as plain hosted Postgres only
- Auth: hand-rolled JWT (jsonwebtoken) + bcrypt
- Frontend (separate repo): React (Vite) + Tailwind, deployed on Vercel

# Do not use

- Supabase Auth or the Supabase client SDK — auth is intentionally hand-rolled for learning purposes, this was a deliberate decision, don't suggest switching
- Next.js patterns or API routes — this is a standalone Express service, not a Next.js backend
- localStorage for storing the JWT client-side (XSS risk) — token lives in memory on the frontend
- Drizzle — using Prisma, decided for this project's deployment target (see docs/plan.md)

# How to work with me

- I'm learning full-stack, not just shipping. Before writing code for a new feature, briefly explain the approach and why you're choosing it, then implement.
- Prefer small, reviewable changes over large multi-file generations in one shot. If a task naturally splits into stages, propose the stages first.
- After implementing something, briefly explain what the code does and why it's structured that way — don't just report that it works.
- If I ask "why" about something you generated, that's not criticism, answer it directly.
- Use plan mode for anything non-trivial so I can review the approach before you touch files.

# Architecture conventions

- Layered structure: `routes/` → `controllers/` → `services/` → `middleware/`. Don't put business logic directly in route handlers.
- Every protected route goes through `requireAuth` middleware — controllers should never re-check the token themselves.
- Database queries that return user-owned data must filter by `req.user.id` — never trust a client-supplied user id in the request body.

# Commands

(fill in once scaffolded)
- `npm run dev` — start dev server
- `npx prisma migrate dev` — run migrations
- `npx prisma studio` — browse the database visually
