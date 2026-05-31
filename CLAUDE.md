# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local dev server
npx wrangler pages dev . --d1=DB

# Apply schema to local DB
npx wrangler d1 execute workout-tracker --local --file=schema.sql

# Apply schema to production DB (always use --remote for prod)
npx wrangler d1 execute workout-tracker --remote --file=schema.sql

# Run a query against local DB
npx wrangler d1 execute workout-tracker --local --command="SELECT * FROM workouts"

# Run a query against production DB
npx wrangler d1 execute workout-tracker --remote --command="SELECT * FROM workouts"

# Deploy to Cloudflare Pages
npx wrangler pages deploy .
```

## Architecture

Single-page app with no build step — `index.html` is both the build artifact and source. The backend is Cloudflare Pages Functions (filesystem-based routing under `functions/`).

**Frontend (`index.html`):** Vanilla JS, no framework. All state is fetched from the API on demand — there is no client-side store. Chart.js (CDN) renders the class attendance and exercise progression charts. The three tabs (Log, History, Stats) are CSS `display:none` toggled — all are in the DOM at all times.

**Backend (`functions/api/`):** Pages Functions with file-based routing. Each file maps to a URL:
- `functions/api/workouts.js` → `GET /api/workouts`, `POST /api/workouts`
- `functions/api/workouts/[id].js` → `PUT /api/workouts/:id`, `DELETE /api/workouts/:id`
- `functions/api/classes.js` → `GET /api/classes`, `POST /api/classes`
- `functions/api/classes/[id].js` → `DELETE /api/classes/:id`

The D1 binding is `env.DB`. Exercises are stored as a JSON string in the `exercises` column and parsed on read.

**Database:** Two tables — `workouts` (with `exercises` as JSON text) and `classes`. Schema is in `schema.sql`. DB name: `workout-tracker`, ID: `0f486c02-fa7d-4c21-b02d-c5578196a008`.

**Deployed URL:** https://workout.sardine.dev
