# 🗂️ Fluely — Social Content Planner

## 📖 Project Overview

Fluely is a social media content planning and scheduling app. It provides a weekly time-grid content
planner where you can drag posts into time slots, manage boards with multiple views, keep track of
your inbox, and get an at-a-glance dashboard of what's coming up.

The app UI is ported from [Stablhr/Kali](https://github.com/Stablhr/Kali) and runs as a Next.js 16
app behind a JWT auth boundary, with an Express.js API alongside it. App data currently lives in a
local store in the browser; the remote API client in `frontend/lib/kali/api/` stays inert until
`NEXT_PUBLIC_KALI_API_URL` points at a backend that serves it.

### Key Features

- **Dashboard** — At-a-glance overview of boards, due-soon items, and planner previews.
- **Inbox** — Incoming items with quick actions.
- **Boards** — Kanban boards with board views: Board, Calendar, Table, Timeline, and Map.
- **Schedule** — Day-column planner with drag-and-drop between days and an unscheduled pool.
- **Content Planner** — Weekly time grid (6 AM – 11 PM) to schedule social posts by hour; drag posts
  between slots and the unscheduled pool.
- **Social** — Compose modal, bulk scheduling, analytics, media library, and OAuth account connection
  (YouTube, Facebook, Instagram, TikTok).
- **Theme** — Light & dark mode with adaptive surfaces.
- **Accounts** — Sign up, sign in, email verification, password reset, and a role-based admin area.

## 🛠️ Tech Stack

### Frontend

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI library | React 19 |
| Language | TypeScript 5 |
| Build tool | Turbopack / Next build |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Drag & drop | @hello-pangea/dnd |
| Icons | Lucide React |
| Server state | TanStack Query v5 |
| HTTP | Axios |
| Linter | ESLint |

### Backend

| Layer | Technology |
|-------|------------|
| Framework | Express.js |
| Database | MongoDB via Mongoose |
| Auth | jsonwebtoken, HTTP-only cookie rotation, bcrypt |
| Validation | Zod (DTO pattern) |
| Email | Nodemailer |
| Uploads | multer |
| Logging | Pino |
| Security | Helmet, CORS, express-rate-limit |

## 📁 Project Structure

```
fluely/
├── frontend/
│   ├── app/
│   │   ├── (app)/                # Authenticated app — owns /
│   │   │   ├── boards/           # /boards, /boards/[boardId]
│   │   │   ├── content-planner/  # /content-planner, /planner
│   │   │   ├── dev/              # Contrast test page
│   │   │   ├── inbox/            # /inbox
│   │   │   ├── schedule/         # /schedule
│   │   │   └── layout.tsx        # Auth guard, .kali-app wrapper, providers
│   │   ├── (admin)/              # /admin/dashboard (parallel routes)
│   │   ├── (auth)/               # sign-in, sign-up, forgot/reset, verify
│   │   ├── (public)/             # /landing, /docs
│   │   ├── globals.css           # Tailwind entry + shadcn tokens
│   │   └── kali.css              # App design system, scoped to .kali-app
│   ├── components/
│   │   ├── kali/                 # Ported app components
│   │   │   ├── boards/           # Boards, lists, cards & views
│   │   │   ├── card-modal/       # Card detail modal & fields
│   │   │   ├── content-planner/  # Weekly time grid planner
│   │   │   ├── dashboard/        # Home dashboard
│   │   │   ├── dev/              # Contrast test page
│   │   │   ├── inbox/            # Inbox view
│   │   │   ├── layout/           # Sidebar, app shell, top bar
│   │   │   ├── planner/          # Day-column schedule planner
│   │   │   ├── shared/           # Buttons, inputs, modals, skeletons
│   │   │   └── social/           # Compose, analytics, media library
│   │   └── ui/                   # shadcn/ui primitives
│   ├── lib/
│   │   ├── api/                  # Axios client, auth API, error mapping
│   │   ├── auth/                 # Redirect utilities
│   │   ├── hooks/                # useMeQuery, useLogout
│   │   ├── kali/                 # Store, hooks, utils, optional API client
│   │   └── provider/             # ReactQueryProvider
│   ├── public/assets/            # Static assets & logos
│   └── .env.example
└── backend/
    ├── api/
    │   ├── config/               # DB connection, env schema
    │   ├── constants/            # Shared constants
    │   ├── controllers/          # Route handlers
    │   ├── dtos/                 # Zod validation schemas
    │   ├── logging/              # Pino logger
    │   ├── middleware/           # Auth, error handler, rate limit, sanitize
    │   ├── models/               # User & Admin models
    │   ├── repositories/         # Data access layer
    │   ├── routes/               # Express router definitions
    │   ├── services/             # Business logic (auth, email, blocklist)
    │   ├── templates/            # HTML email templates
    │   └── utils/                # Error, crypto, pagination, serialization
    ├── scripts/
    │   └── seed-admin.ts         # Admin seed script
    ├── .env.example
    └── package.json
```

## ⚙️ Prerequisites

- Node.js 18+
- npm
- Git
- MongoDB instance (local or Atlas)
- SMTP credentials (e.g. Gmail, Resend, Mailtrap)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Stablhr/Fluely.git
cd fluely
```

### 2. Set up the Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and the SMTP values — see
`backend/.env.example` for the full list. Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then seed an admin account and start the server:

```bash
npm run seed:admin
npm run dev
```

The API runs at `http://localhost:5000`.

### 3. Set up the Frontend

Open a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:5000/api`. Leave
`NEXT_PUBLIC_KALI_API_URL` unset to run entirely on the local store.

```bash
npm run dev
```

The app runs at `http://localhost:3000`. Sign in at `/sign-in`; the planner itself is at `/` and
requires a session. The marketing page is at `/landing`.

### 4. Deploy

Both halves are deployable to Vercel (`backend/vercel.json` covers the API). Set the same
environment variables in each Vercel project, and deploy them independently.

## 📜 Available Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start the production server |
| `npm run seed:admin` | Seed an admin account |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests with Jest |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Type-check and build for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check only |

## 🌿 Git Branching Workflow

### Branch Structure

```
main
└── feature/<short-description>
    ├── fix/<short-description>
    ├── hotfix/<short-description>       # (urgent production fixes)
    └── chore/<short-description>        # (configs, deps, refactors)
```

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/content-planner` |
| Bug Fix | `fix/<short-description>` | `fix/sidebar-tooltip` |
| Hotfix | `hotfix/<short-description>` | `hotfix/login-redirect` |
| Chore | `chore/<short-description>` | `chore/update-deps` |

### Starting a new feature

```bash
# 1. Make sure main is up to date
git checkout main
git pull origin main

# 2. Create your branch
git checkout -b feature/content-planner

# 3. Work on your changes, then commit
git add .
git commit -m "feat: add content planner calendar"

# 4. Push your branch
git push origin feature/content-planner
```

### Merging back to main

Open a Pull Request (`feature/...` → `main`) and get it reviewed before merging.

## 📝 Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>
```

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, deps, config |
| `style` | Formatting, no logic change |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `docs` | Documentation updates |
| `revert` | Revert a previous commit |

Examples:

```bash
git commit -m "feat: make content planner calendar resizable"
git commit -m "fix(sidebar): keep tooltip aligned on collapse"
git commit -m "chore: update react to v19"
git commit -m "docs: update README setup steps"
```

## 🤝 Contributing

Branch off `main` using the branch naming above. Follow the commit message convention. Open a Pull
Request into `main` and request a code review before merging.

More detail for agents and contributors lives in [AGENTS.md](./AGENTS.md) and
[frontend/AGENTS.md](./frontend/AGENTS.md).
