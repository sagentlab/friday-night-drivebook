# Friday Night Drivebook

A fast, phone-friendly game journal for capturing scores, drives, and sideline observations while the game is still moving. It is a compact showcase of a full database-backed app built on Cloudflare Workers and D1 (SQLite).

## Stack

- Cloudflare Worker for the API and static asset routing
- Cloudflare D1 for relational data
- Plain HTML, CSS, and JavaScript for a fast, dependency-light UI
- Versioned SQL migrations and generated Worker binding types

## Develop locally

```bash
npm install
npm run db:migrate:local
npm run dev
```

Then open `http://localhost:8787`.

## Verify and deploy

```bash
npm run check
npm run db:migrate:remote
npm run deploy
```

The checked-in `wrangler.jsonc` is the source of truth for the Worker, assets, D1 binding, compatibility date, and observability configuration.

