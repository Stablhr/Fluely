# Backend AGENTS.md

## Stack

Express.js, Mongoose (MongoDB), jsonwebtoken, bcrypt, Zod, Nodemailer, Pino

## Commands

```bash
cd backend
npm run dev          # Start dev server (port 5000)
npm run build        # Compile TypeScript
npm run start        # Start production server
npm run seed:admin   # Seed admin account
npm run migrate:media-to-cloudinary  # One-off: upload legacy local files to Cloudinary
npm run lint         # ESLint
npm test             # Jest (no test suite included)
```

## Architecture

```
api/config/          # DB connection (db.ts), env validation (env.ts), Cloudinary client (cloudinary.ts)
api/constants/       # Error codes, cookies, product enums (board roles, platforms, statuses)
api/controllers/     # Route handlers (thin — delegate to services)
api/services/        # Business logic (auth, email, blocklist)
api/repositories/    # Data access layer (user, admin)
api/middleware/       # Auth, validation, rate limiting, sanitize (NoSQL injection prevention), error handler
api/models/          # Mongoose models (Admin.model.ts, User.model.ts) extending BaseUser schema
api/routes/          # Express router definitions
api/templates/       # HTML email templates
api/dtos/            # Zod validation schemas
api/utils/           # ApiError, actor resolution, crypto, pagination, serialization, transactions
api/logging/         # Pino logger configuration
scripts/             # Seed and one-off migration scripts (seed-admin.ts, migrate-media-to-cloudinary.ts)
```

## Code Style

- TypeScript strict mode — no `any` types in new code (existing tech debt in auth.service.ts)
- Use `ApiError` class for all errors: `throw new ApiError(400, 'ERROR_CODE', 'Message')`
- Use `env` import from `api/config/env.ts` — avoid `process.env` directly (note: COOKIE_SECURE, COOKIE_SAMESITE still use process.env — tech debt to fix)
- Zod DTOs in `api/dtos/` validate all request bodies
- Use `validateRequest({body, params, query})` for new routes; the older `validate(schema)` is
  body-only and kept for the auth routes
- Repository pattern: services call repositories, never Mongoose directly
- Controllers are thin — validate input, call service, send response

## Error Shape

All API errors must follow this shape (enforced in `api/middleware/errorHandler.ts`):

```ts
{
  success: false;
  code: string;      // e.g. "INVALID_CREDENTIALS"
  message: string;   // Human-readable message
  details?: unknown; // Optional additional info
}
```

## Security Rules

- Never commit `.env` files — only `.env.example` is tracked
- Never log secrets, tokens, or passwords
- Cookies use HTTP-only, Secure, SameSite — configured via env vars
- Refresh tokens are revoked on use (in-memory blocklist — resets on server restart)
- Passwords must be bcrypt-hashed before storage
- All input passes through Zod validation before reaching services
- Sanitize middleware strips `$`-prefixed keys to prevent NoSQL injection
- Body size limited to 10kb (`express.json({ limit: '10kb' })`)

## Media Uploads

Uploaded files go to Cloudinary; nothing is written to local disk. `multer` uses in-memory storage
(`api/middleware/upload.ts`) and `mediaService.create` streams each buffer to Cloudinary through the
shared helpers in `api/services/cloudinary.service.ts`, which read the client configured once in
`api/config/cloudinary.ts`. Assets live under `fluely/{avatars,boards,tasks,content-planner}`.

A record stores the Cloudinary `url` (`secure_url`), `publicId`, and `resourceType`; deletion calls
`deleteFromCloudinary(publicId, resourceType)` with the exact resource type it was uploaded as.

Profile pictures are the exception to the `MediaAttachment` model: they are a pair of fields on the
account (`avatarUrl`, `avatarPublicId`) served by `api/services/account.service.ts` via
`POST /account/me/avatar` and `DELETE /account/me/avatar`. Each person's assets live under
`fluely/avatars/<userId>`, uploading destroys the picture it replaces, and `avatarPublicId` never
leaves the server (`PublicAccount` carries `avatarUrl` only).

> **Serverless body limit.** On Vercel, a Serverless Function request body is capped (~4.5 MB), so
> large video uploads cannot pass through `POST /api/media`. Those need a direct (signed) upload to
> Cloudinary from the browser instead of the proxy-through-the-API path.

## Testing

- Jest + Supertest tooling is available, but no test suite is included in this repository
- When adding tests, place them in `backend/tests/` and assert against the error shape above
