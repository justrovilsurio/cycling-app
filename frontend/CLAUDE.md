# Project overview

React frontend for a multi-user cycling training planner. Talks only to a separate Express API (never directly to the database or Strava). Built by a frontend dev learning full-stack — backend concepts are new, frontend ones aren't, adjust explanations accordingly. See "How to work with me" below.

Full architecture: see `docs/plan.md` in the backend repo for the complete picture.

# Tech stack

- React (Vite) + Tailwind, deployed on Vercel
- Backend (separate repo): Express + TypeScript on Render — this frontend calls it via `fetch`/`axios`, never talks to Postgres or Strava directly

# Do not use

- Next.js — this is a Vite SPA, not a Next.js app
- localStorage for the auth token — kept in memory (React state/context) only

# How to work with me

- I already know React well — no need to over-explain component basics, hooks, or JSX.
- I'm newer to the full-stack parts that touch this repo: auth token handling, API integration patterns, CORS-related issues. Explain those in more depth when relevant.
- Prefer small, reviewable changes over large multi-file generations in one shot.

# Commands

(fill in once scaffolded)
- `npm run dev` — start dev server
- `npm run build` — production build
