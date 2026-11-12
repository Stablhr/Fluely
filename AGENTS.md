# AGENTS.md

## Project Overview

Social content planner built on an auth boilerplate — a Next.js 16 frontend plus an Express.js
backend with JWT authentication, role-based access (User/Admin), email verification, and password
reset. The planner UI (boards, calendar, scheduled posts) is ported from
[Stablhr/Kali](https://github.com/Stablhr/Kali) and lives in `frontend/components/kali/`.

The backend persists boards, lists, cards (with comments, attachments, and covers), collaborators, invitations,
workspaces, notifications, media (Cloudinary), profiles, and link previews. The browser store caches
that data and keeps what the API does not serve yet — chiefly social posts and connected social
accounts.

## Stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript 5, TailwindCSS v4, shadcn/ui, TanStack Query v5, Axios
- **App UI:** ported from Kali; its own design system in `frontend/app/kali.css` (scoped to `.kali-app`), `@hello-pangea/dnd`, lucide icons
- **Backend:** Express.js, Mongoose (MongoDB), jsonwebtoken, bcrypt, Zod, Nodemailer, Pino
- **Testing:** Jest backend suites in `backend/tests/` (`cd backend && npm test`); no frontend tests yet
- **Runtime:** Node.js 18+

## Sub-Agents

| Scope | Read this file |
|-------|----------------|
| Frontend work (React, Next.js, UI, pages) | [frontend/AGENTS.md](./frontend/AGENTS.md) |
| Backend work (Express, API, DB, auth logic) | [backend/AGENTS.md](./backend/AGENTS.md) |

## Commits

Use conventional commits: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`
