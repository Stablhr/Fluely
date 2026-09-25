# AGENTS.md

## Project Overview

Social content planner built on an auth boilerplate — a Next.js 16 frontend plus an Express.js
backend with JWT authentication, role-based access (User/Admin), email verification, and password
reset. The planner UI (boards, calendar, inbox, scheduled posts) is ported from
[Stablhr/Kali](https://github.com/Stablhr/Kali) and lives in `frontend/components/kali/`; the
backend currently exposes auth only, so app data is kept in browser storage.

## Stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript 5, TailwindCSS v4, shadcn/ui, TanStack Query v5, Axios
- **App UI:** ported from Kali; its own design system in `frontend/app/kali.css` (scoped to `.kali-app`), `@hello-pangea/dnd`, lucide icons
- **Backend:** Express.js, Mongoose (MongoDB), jsonwebtoken, bcrypt, Zod, Nodemailer, Pino
- **Testing:** Jest + Supertest tooling is available; no test suite is included in this repository
- **Runtime:** Node.js 18+

## Sub-Agents

| Scope | Read this file |
|-------|----------------|
| Frontend work (React, Next.js, UI, pages) | [frontend/AGENTS.md](./frontend/AGENTS.md) |
| Backend work (Express, API, DB, auth logic) | [backend/AGENTS.md](./backend/AGENTS.md) |

## Commits

Use conventional commits: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`
