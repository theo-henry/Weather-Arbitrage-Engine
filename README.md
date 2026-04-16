# Weather Arbitrage Engine

Scores 96 half-hour time slots over 48 hours to find the optimal windows for outdoor activities — running, studying, socializing, flying, and photography — based on real weather data and user preferences.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, and Framer Motion.

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)

### Installation

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and add your Google Weather API key:

```bash
cp .env.example .env.local
```

The app falls back to mock data if the key is missing or the API fails.

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
pnpm build
pnpm start
```

## How It Works

```
useWeatherData(city) hook
  → fetch /api/weather?city=X (server-side proxy, hides API key)
    → Google Weather API (current conditions + 48h hourly forecast)
  → Map response → WeatherConditions, interpolate to 30-min slots
  → Score each slot per activity using weighted factors
  → Fall back to mock data if API unavailable
```

### Core Modules (`lib/`)

| Module | Purpose |
|---|---|
| `types.ts` | Domain types. `TimeWindow` is the central data structure. |
| `scoring.ts` | Pure scoring functions per activity (0–100 with factor breakdowns). |
| `weatherApi.ts` | Transforms Google Weather API responses into `TimeWindow[]`. |
| `mockData.ts` | Deterministic mock weather with city-specific profiles and query helpers. |

### Pages

- **Dashboard** — Preference sidebar, recommendation card, ranked list, timeline chart, factor radar, and insights.
- **Compare** — Side-by-side comparison of best slot vs usual time vs alternate.
- **Scheduler** — Chat panel (natural language scheduling) + weather calendar grid.

### API Route

`app/api/weather/route.ts` — Server-side proxy to Google Weather API. Supports Madrid, Barcelona, Valencia, and Seville.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
