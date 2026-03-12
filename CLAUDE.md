# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PainRecorder** — A Japanese-language web app for chronic pain patients to record pain levels over time. Managed with Docker Compose.

## Commands

```bash
# Start the app (first time builds and syncs DB schema automatically)
docker-compose up

# Rebuild after dependency changes
docker-compose up --build

# Stop
docker-compose down

# Access DB studio (run locally after npm install)
npm run db:studio
```

## Architecture

**Stack:** Next.js 14 (App Router, TypeScript) + PostgreSQL + Prisma ORM + NextAuth.js + Recharts + Tailwind CSS

**Docker services:**
- `app` — Next.js dev server on port 3000, mounts source as volume
- `db` — PostgreSQL 16 on port 5432, persists via named volume `postgres_data`

On container start, `scripts/start.sh` runs `prisma generate` → `prisma db push` → `next dev`.

**App structure:**
- `src/app/page.tsx` — Login/register page (public)
- `src/app/(protected)/` — Auth-protected pages: dashboard, record, graph, settings
- `src/app/api/` — REST API routes (auth, pain-types, records)
- `src/components/` — Client components (RecordForm, PainGraph, PainLevelPicker, ActivityPicker, Navigation)
- `src/lib/auth.ts` — NextAuth config (credentials provider, JWT strategy) — import `authOptions` from here
- `src/lib/prisma.ts` — Prisma client singleton (avoids hot-reload connection leaks)
- `src/lib/constants.ts` — Activity level labels (0–6) and pain level colors (0–9)
- `src/middleware.ts` — Protects `/dashboard`, `/record`, `/graph`, `/settings` via NextAuth middleware

**Database schema (Prisma):**
- `User` — id, username (unique), passwordHash
- `PainType` — user-defined pain categories (e.g. "指の曲がりにくさ"), scoped per user
- `PainRecord` — one entry per recording session: activityLevel (0–6), comment, recordedAt
- `PainLevelEntry` — links a PainRecord to a PainType with a level (0–9)

**Domain:**
- Pain levels: 0 (痛みなし) to 9 (最大の痛み)
- Activity levels: 0 (寝たきり) to 6 (外で歩行) — full labels in `src/lib/constants.ts`
- Graph page: ComposedChart with Lines per pain type (left Y: 0–9) + Bar for activity (right Y: 0–6), filterable by date range

**API routes:**
- `POST /api/auth/register` — create user (bcryptjs, cost 10)
- `GET/POST /api/pain-types` — list/create pain types for session user
- `DELETE /api/pain-types/[id]` — delete (cascades to PainLevelEntry)
- `GET /api/records?range=today|7d|30d|all` — returns `{ records, painTypes }`
- `POST /api/records` — create record with `{ activityLevel, comment, recordedAt, painEntries: [{painTypeId, level}] }`
- `DELETE /api/records/[id]` — delete record

All API routes check `getServerSession(authOptions)` and return 401 if unauthenticated.

## Mandatory Rules

- Do NOT modify any files unless explicitly instructed.
- Do NOT refactor existing code unless clearly requested.
- Prefer minimal, localized changes over large improvements.
- Stability and existing behavior are more important than code cleanliness.

## Change Proposal Requirement

Before making any code changes:
- Explain what will be changed
- Explain why it is necessary
- Describe potential risks or side effects

Wait for explicit approval before proceeding.

## Security Rules

- Never request or output secrets, API keys, or credentials.
- Do not log or print personal data.
- Assume production-like constraints even in development.

## Cost Awareness

- Keep responses concise.
- Avoid repeating large code blocks unless necessary.
- Prefer explanation over full implementation when possible.

## Notation

- Indent must be 4
- Don't insert extra spaces
- Don't omit "{}"
- Don't use left symbol like ">" and ">=". Please use right symbol like "<" and "<="
- Avoid using goto
- Consider readability

## Model Usage Policy

- Use the Default (recommended) model for all tasks.
- The Default model is currently Sonnet.
- Do NOT switch to Opus unless explicitly instructed by the user.
- Prefer lower-cost models unless higher capability is required.
