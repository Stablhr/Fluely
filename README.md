# 🗂️ Fluely — Social Content Planner

## 📖 Project Overview

Fluely is a social media content planning and scheduling app. Plan posts across platforms on a
calendar, board, or table; run collaborative boards with multiple views; and get an at-a-glance
dashboard of what's coming up.

The app UI is ported from [Stablhr/Kali](https://github.com/Stablhr/Kali) and runs as a Next.js 16
app behind a JWT auth boundary, with an Express.js + MongoDB API alongside it. Boards, lists, cards,
collaborators, media, profiles, and notifications are stored on the server. Social posts and
connected social accounts don't have backend routes yet, so they are kept in browser storage.

### Key Features

- **Dashboard** — At-a-glance overview of boards, due-soon items, and planner previews.
- **Boards** — Kanban boards with Board, Calendar, Table, Timeline, and Map views; workspaces,
  collaborators, email invitations, public boards, live updates (polling), archive, and activity.
- **Cards** — Comments with mentions, attachments and image/video covers on Cloudinary (videos up
  to 500 MB), autolinked URLs, inline embeds for YouTube, Vimeo, Google Drive, and video files, and
  link cards. Done cards are cleaned up automatically after two days.
- **Schedule** — Day-column planner of board cards by due date, with drag-and-drop between days and
  an unscheduled pool.
- **Social Posting** — Platform overview plus calendar, board (Idea → Posted), and table views over
  one set of social posts, edited in a slide-over panel.
- **Social** — Compose modal, bulk scheduling, analytics, media library, and account connection
  (YouTube, Facebook, Instagram, TikTok).
- **Notifications** — Bell for mentions and board invitations.
- **Accounts** — Sign up, sign in, email verification, password reset, profile with avatar and
  visibility settings, and a role-based admin area.

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
| Uploads | multer (in-memory) → Cloudinary |
| Logging | Pino |
| Security | Helmet, CORS, express-rate-limit |

## 📁 Project Structure

```
fluely/
├── frontend/
│   ├── app/
│   │   ├── (app)/                # Authenticated app — owns /
│   │   │   ├── boards/           # /boards, /boards/[boardId]
│   │   │   ├── content-planner/  # /content-planner (Social Posting)
│   │   │   ├── dev/              # Contrast test page
│   │   │   ├── planner/          # /planner → redirects to /schedule
│   │   │   ├── schedule/         # /schedule
│   │   │   ├── settings/         # /settings (profile, account)
│   │   │   └── layout.tsx        # Auth guard, .kali-app wrapper, providers
│   │   ├── (admin)/              # /admin/dashboard (parallel routes)
│   │   ├── (auth)/               # sign-in, sign-up, forgot/reset, verify
│   │   ├── (public)/             # /landing, /docs
│   │   ├── invite/               # Board invitation landing
│   │   ├── globals.css           # Tailwind entry + shadcn tokens
│   │   └── kali.css              # App design system, scoped to .kali-app
│   ├── components/
│   │   ├── kali/                 # Ported app components
│   │   │   ├── boards/           # Boards, lists, cards & views
│   │   │   ├── card-modal/       # Card detail modal & fields
│   │   │   ├── content-planner/  # Social Posting: overview, calendar/board/table
│   │   │   ├── dashboard/        # Home dashboard
│   │   │   ├── dev/              # Contrast test page
│   │   │   ├── layout/           # Sidebar, app shell, top bar, notifications
│   │   │   ├── settings/         # Settings, avatar crop
│   │   │   ├── planner/          # Day-column schedule planner
│   │   │   ├── shared/           # Buttons, inputs, modals, skeletons
│   │   │   └── social/           # Compose, analytics, media library
│   │   └── ui/                   # shadcn/ui primitives
│   ├── lib/
│   │   ├── api/                  # Axios client; auth, account, media, embed APIs; error mapping
│   │   ├── auth/                 # Redirect utilities
│   │   ├── hooks/                # useMeQuery, useLogout
│   │   ├── kali/                 # Store, board API modules, realtime polling, utils
│   │   └── provider/             # ReactQueryProvider
│   ├── public/assets/            # Static assets & logos
│   └── .env.example
└── backend/
    ├── api/
    │   ├── config/               # DB connection, env schema, Cloudinary client
    │   ├── constants/            # Shared constants
    │   ├── controllers/          # Route handlers
    │   ├── dtos/                 # Zod validation schemas
    │   ├── logging/              # Pino logger
    │   ├── middleware/           # Auth, CSRF, board access, upload, rate limit, sanitize
    │   ├── models/               # Users, workspaces, boards, lists, cards, media, notifications
    │   ├── repositories/         # Data access layer
    │   ├── routes/               # Express router definitions
    │   ├── services/             # Business logic
    │   ├── templates/            # HTML email templates
    │   └── utils/                # Error, crypto, pagination, serialization
    ├── scripts/                  # Admin seed + one-off migrations
    ├── tests/                    # Jest suites
    ├── .env.example
    └── package.json
```

## ⚙️ Prerequisites

- Node.js 18+
- npm
- Git
- MongoDB instance (local or Atlas)
- SMTP credentials (e.g. Gmail, Resend, Mailtrap)
- A Cloudinary account (uploaded files are stored there, never on local disk)

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

Fill in `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, the SMTP values, and the
three `CLOUDINARY_*` credentials — see `backend/.env.example` for the full list.
Generate secrets with:

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

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:5000/api`. The backend must be running: boards
and accounts are loaded from it.

```bash
npm run dev
```

The app runs at `http://localhost:3000`. Sign in at `/sign-in`; the planner itself is at `/` and
requires a session. The marketing page is at `/landing`.

### 4. Deploy

Both halves are deployable to Vercel (`backend/vercel.json` covers the API). Set the same
environment variables in each Vercel project, and deploy them independently. `backend/vercel.json`
also schedules the daily done-card cleanup cron; set `CRON_SECRET` so only Vercel can call it.

## 📜 Available Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start the production server |
| `npm run seed:admin` | Seed an admin account |
| `npm run migrate:media-to-cloudinary` | One-off: upload legacy local files to Cloudinary |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Jest suites in `tests/` |

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
production                         # default branch — what is deployed
└── development                    # integration branch — day-to-day work lands here
    ├── feature/<short-description>
    ├── fix/<short-description>
    └── chore/<short-description>  # (configs, deps, refactors)
hotfix/<short-description>         # urgent fixes, branched from production
```

| Type | Branch from | Pattern | Example |
|------|-------------|---------|---------|
| Feature | `development` | `feature/<short-description>` | `feature/content-planner` |
| Bug Fix | `development` | `fix/<short-description>` | `fix/sidebar-tooltip` |
| Chore | `development` | `chore/<short-description>` | `chore/update-deps` |
| Hotfix | `production` | `hotfix/<short-description>` | `hotfix/login-redirect` |

`main` is a leftover from before this workflow and is no longer updated — don't branch from it or
merge into it.

### Starting a new feature

```bash
# 1. Make sure development is up to date
git checkout development
git pull origin development

# 2. Create your branch
git checkout -b feature/content-planner

# 3. Work on your changes, then commit
git add .
git commit -m "feat: add content planner calendar"

# 4. Push your branch
git push origin feature/content-planner
```

### Merging

1. Open a Pull Request from your branch into `development` and get it reviewed. CI (build and lint
   for both projects) runs on every push and pull request; run `npm test` in `backend/` yourself.
2. When `development` is ready to ship, open a Pull Request from `development` into `production`.
3. A `hotfix/...` branch goes into `production` first, then gets merged back into `development` so
   the two don't drift.

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

Branch off `development` using the branch naming above. Follow the commit message convention. Open a
Pull Request into `development` and request a code review before merging.

More detail for agents and contributors lives in [AGENTS.md](./AGENTS.md) and
[frontend/AGENTS.md](./frontend/AGENTS.md).

