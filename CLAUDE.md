# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # ESLint
```

## Environment

Requires `GOOGLE_WEATHER_API_KEY` in `.env.local` for live weather data. In deployed environments, weather UI should show a visible error instead of falling back to generated data.

## Architecture

**Weather Scheduler** scores 96 half-hour time slots over 48 hours to find optimal windows for outdoor activities (run, study, social, flight, photo) based on real weather data and user preferences.

### Data Flow

```
useWeatherData(city) hook
  → fetch /api/weather?city=X (server-side proxy, hides API key)
    → Google Weather API (currentConditions + 48h hourly forecast)
  → weatherApi.ts: maps Google response → WeatherConditions, interpolates to 30-min slots
  → scoring.ts: scores each slot per activity using weighted factors
  → Shows a live-weather error if Google data is unavailable
```

### Core Modules (lib/)

- **types.ts** — All domain types. `TimeWindow` is the central data structure containing weather, scores for all activities, and factor breakdowns. `WeatherConditions` is the normalized weather format used everywhere.
- **scoring.ts** — Pure scoring functions per activity (`scoreRun`, `scoreStudy`, `scoreSocial`, `scoreFlight`, `scorePhoto`). Each returns `{ score: 0-100, factors: Record<string, number> }`. Weights are tunable constants at the top.
- **weatherApi.ts** — Transforms Google Weather API responses into `TimeWindow[]`. Handles condition type mapping (Google enums → internal types), metric extraction from nested response, and 30-min interpolation from hourly data.
- **mockData.ts** — Deterministic mock weather generator with city-specific profiles for development-only utilities. Shared query helpers live in `weather-window-utils.ts`.

### API Route

`app/api/weather/route.ts` — Server-side proxy to Google Weather API. Fetches current conditions and hourly forecast in parallel. City coordinates are hardcoded for Madrid, Barcelona, Valencia, Seville.

### Pages

All pages are client components ("use client") that consume weather data via the `useWeatherData` hook:

- **dashboard** — Main interface: preference sidebar + recommendation card + ranked list + timeline chart + factor radar + insights
- **compare** — Side-by-side comparison of best slot vs usual time vs alternate
- **scheduler** — Split view: chat panel (natural language scheduling) + weather calendar grid

### Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui (New York style), Recharts, Framer Motion. Path alias: `@/*` maps to repo root.

### Config Notes

- `next.config.mjs` has `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`
- shadcn/ui components live in `components/ui/` (59 primitives)
- CSS variables for theming defined in `app/globals.css` (light/dark modes)
