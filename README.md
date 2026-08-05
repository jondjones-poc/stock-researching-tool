# Stock Research Platform

Next.js app for portfolio research, eToro sync, sector heatmaps, and global market flow tracking.

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in secrets
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Feature docs

- **Global Market Flow Tracker** (`/research/markets`) — [docs/market-flow-tracker.md](docs/market-flow-tracker.md)
- **Company Finder** (`/research/company-finder`) — [docs/company-finder.md](docs/company-finder.md)
- **Sector heatmap** — `/research/sectors` (formerly `/research/markets`)
- **Migrations** — `scripts/migrations/`

## Scripts

```bash
npm run build
npm run lint
npm test -- --testPathPattern=market-flow
node scripts/apply-market-flow-tracker.mjs
```

## Deploy

Deploy the Next.js app to Netlify (or similar). Apply SQL migrations on Supabase, set env vars from `.env.example`, then hit `POST /api/market-flow/refresh` once (admin or cron secret) and schedule it daily.
