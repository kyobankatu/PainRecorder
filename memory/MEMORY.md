# PainRecorder Project Memory

## Status
Active development. Core features complete. Recent work on graph statistics and custom date range.

## Stack
Next.js 14 (App Router, TypeScript) + PostgreSQL + Prisma + NextAuth.js + Recharts + Tailwind CSS
Docker Compose manages app (port 3000) + db (PostgreSQL 16, port 5432).

## Key Paths
- Auth config: `src/lib/auth.ts` (authOptions)
- Prisma singleton: `src/lib/prisma.ts`
- Constants (activity/pain labels+colors): `src/lib/constants.ts`
- Protected pages: `src/app/(protected)/` (dashboard, record, graph, settings)
- API: `src/app/api/` (auth/register, pain-types, records, records/latest)
- Middleware: `src/middleware.ts` (protects /dashboard, /record, /graph, /settings, /print-preview)
- Print preview: `src/app/(print)/print-preview/page.tsx`

## Domain Model
- PainType: user-defined pain categories, scoped per user
- PainRecord: one recording session (activityLevel 0-6, comment, recordedAt, temperature, humidity, pressure)
- PainLevelEntry: links PainRecord to PainType with level (0-9)

## Startup
`docker-compose up` → start.sh: prisma generate → prisma db push → next dev

## User Preferences
- Japanese UI
- Indent: 4 spaces
- No extra spaces, always use {}, use < and <= (not > and >=)
- Minimal changes, propose before changing
- Use Sonnet model

## Statistical Design Decisions
- [project/stats] Pain trend uses **linear regression on daily averages per pain type** (not MACD, not first/second half split)
  - Per-type: separate regression for each pain type
  - Daily aggregation first (avg same-day entries) to avoid bias from multiple records per day
  - x = calendar day number (Unix ms / 86400000), y = daily avg pain level for that type
  - Outputs: slope (change/day), R² (reliability)
  - MACD was considered but rejected: designed for regularly-spaced financial data, needs 35+ points, not suited for sparse medical records
  - Rolling average overlay was considered but not implemented — kept simple

## Features Implemented
- Weather data (temperature, humidity, pressure) per record — auto-fetch (Open-Meteo) or manual per field
- PWA: manifest, service worker, bottom nav for mobile
- Pain graph: pain+activity chart, temp+humidity chart, pressure chart (separate axes)
- Trend report: period summary, per-type stats (avg/min/max), worst/best day, pain trend (linear regression), activity distribution, activity correlation, weather correlation
- Custom date range for graph and print preview
- CSV download, print/PDF preview (landscape)
- Copy last record quick input
- Daily reminder notifications (service worker, localStorage settings)
- Memo page
