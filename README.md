# Weather Scheduler

**Live demo: [weather-scheduler-three.vercel.app](https://weather-scheduler-three.vercel.app/)**

Weather Scheduler is a weather-aware calendar assistant. It helps answer a practical question that a normal forecast does not answer directly: **when should I do this activity?**

The app turns forecast data, personal comfort rules, blocked time, and existing calendar events into ranked schedule recommendations. It is built for choices like when to run, study outside, plan dinner on a terrace, commute by bike, take photos, or move a weather-sensitive plan before conditions get worse.

## What The App Does

- Scores upcoming time windows for running, studying, social plans, commuting, photography, and custom outdoor activities.
- Finds the best available slots after checking weather quality, blocked scheduling rules, and existing calendar events.
- Explains why one time is better than another with score breakdowns, insights, and ranked alternatives.
- Lets users tune their city, usual time, weather sensitivity, comfort thresholds, commute mode, time-of-day bias, and blocked windows.
- Provides a Compare page where users can ask natural-language questions like "Best time for tennis tomorrow afternoon" and schedule one of the recommended cards.
- Provides a Scheduler page with a weekly calendar, manual event editing, and a chat assistant that can draft creates, moves, and deletes.
- Requires user confirmation before assistant-generated calendar writes are applied.
- Includes Auto-Protect, which scans saved weather-sensitive events, flags risky plans, and suggests safer same-day moves.
- Supports persistent accounts, saved preferences, saved events, demo account seeding, and weather snapshots through Supabase.
- Uses live Google Weather data server-side, Nominatim for city search/geocoding, and Open-Meteo to extend forecasts beyond the Google hourly window.

## Demo Account

Use the live demo or a configured local Supabase project with:

```text
Email:    demo@weatherscheduler.com
Password: demo2026
```

The demo login route creates or refreshes this account when Supabase and `SUPABASE_SERVICE_ROLE_KEY` are configured. Demo data includes preferences and future sample events so the Scheduler and Auto-Protect views have useful state immediately.

## Product Flow

1. Open the app and go to the dashboard.
2. Choose an activity, city, usual time, comfort settings, and blocked scheduling windows.
3. Review the best recommended window, ranked alternatives, score chip, timeline chart, and explanation.
4. Use Compare to ask a flexible planning question, such as:

   ```text
   Outdoor dinner with friends Friday evening
   ```

5. Schedule one of the recommendation cards and jump to the Scheduler calendar.
6. Use the Scheduler assistant for requests like:

   ```text
   Add a 45-minute walk Saturday afternoon
   Move my run to a better weather window
   Delete my outdoor dinner
   ```

7. Open Auto-Protect to review risky weather-sensitive events and apply suggested moves.

## Core Pages

| Page | Purpose |
| --- | --- |
| `/` | Landing page explaining the product and supported activity types. |
| `/dashboard` | Main weather recommendation dashboard with preferences, best slot, ranked alternatives, charting, and insights. |
| `/compare` | Chat-style activity comparison with weather-aware recommendation cards and one-click scheduling. |
| `/scheduler` | Weekly calendar, event editor, assistant chat, and Auto-Protect suggestions. |
| `/about` | Explanation of the scoring philosophy and activity profiles. |
| `/login` / `/signup` | Supabase authentication, account creation, and demo login. |

## How Recommendations Work

Weather data is converted into 30-minute `TimeWindow` objects. Each window gets a 0-100 score for every supported activity. The dashboard and assistant then filter out blocked windows and calendar conflicts before ranking the remaining slots.

Activity scoring uses different factors:

- **Run / Workout:** temperature, humidity, wind, rain chance, UV, and preferred time of day.
- **Deep Work / Study:** thermal comfort, daylight, distraction level, and timing.
- **Outdoor Social:** warmth, rain, wind, sunset feel, and general atmosphere.
- **Commute:** rain, wind, daylight, safety, temperature, and commute mode for car, bike, or walking.
- **Photography:** golden hour, cloud drama, rain, visibility, and light quality.
- **Custom:** user-defined comfort thresholds for temperature, wind, rain, and timing.

Personal preferences are applied on top of the base scoring model, so two users can see different best times for the same city and forecast.

## Weather And Data Flow

```text
User city
  -> /api/geocode for city search when needed
  -> /api/weather server route
      -> Google Weather current conditions and first 48 forecast hours
      -> Open-Meteo extended hourly forecast after the Google window
      -> Supabase weather_snapshots fallback when Google quota is exhausted
  -> lib/weatherApi.ts converts hourly data into 30-minute windows
  -> lib/scoring.ts scores every supported activity
  -> dashboard, compare, scheduler, and Auto-Protect consume scored windows
```

API keys stay server-side. The browser calls local Next.js API routes rather than calling Google Weather, Gemini, or privileged Supabase APIs directly.

## Assistant Behavior

The assistant is powered by Gemini through `app/api/assistant/route.ts` and `lib/ai/`.

It can:

- Map natural language activities to the closest scored profile.
- Search for conflict-free weather windows.
- Score exact requested times without silently replacing them.
- Draft event creation, update, move, and delete operations.
- Inspect and update preferences.
- Respect blocked scheduling windows as hard constraints.

Calendar writes are confirmation-gated. The assistant returns pending operations, the UI asks for confirmation, and only then are changes applied to the local calendar state and persisted for signed-in users.

## Tech Stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui-style components, Radix UI
- **UI behavior:** Framer Motion, Recharts, Lucide icons
- **Auth and persistence:** Supabase Auth and Postgres
- **AI:** Gemini API with function/tool calling
- **Weather:** Google Weather API, Open-Meteo extended forecast, Nominatim geocoding
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Google Weather API key for live recommendations
- Gemini API key for Compare and Scheduler chat
- Supabase project for auth, saved preferences, saved events, demo seeding, and weather snapshot persistence

### Install

```bash
pnpm install
```

### Environment

Copy the example file:

```bash
cp .env.example .env.local
```

Then fill in the values you want to enable:

| Variable | Required For | Notes |
| --- | --- | --- |
| `GOOGLE_WEATHER_API_KEY` | Live weather recommendations | Used only by the server route. Without it, weather windows cannot load. |
| `GEMINI_API_KEY` | Compare and Scheduler assistant | Required for AI responses unless a deterministic scheduler path handles the request. |
| `AI_PROVIDER` | AI provider selection | Defaults to `gemini`. `openai` is listed in code but not implemented yet. |
| `GEMINI_MODEL` | Gemini model override | Defaults to `gemini-2.5-flash`. |
| `GEMINI_FALLBACK_MODELS` | Gemini fallback models | Defaults to `gemini-2.5-flash-lite`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth and saved data | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth and saved data | Browser-safe Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Demo seeding and weather snapshots | Server-side only. Never expose it to the browser. |

### Supabase Setup

Create a Supabase project, enable email/password auth, and run:

```text
supabase/schema.sql
```

The schema creates:

- `user_preferences` for saved preference state.
- `scheduled_events` for persisted calendar events.
- `weather_snapshots` for the last successful weather payload per city.
- Row-level security policies for user-owned preferences and events.

## Run Locally

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Build And Test

```bash
pnpm build
pnpm start
```

Useful scripts:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the local Next.js dev server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Run the production server. |
| `pnpm lint` | Run ESLint. |
| `pnpm check:scheduler` | Run the scheduler assistant regression check against an existing or spawned production server. |

## Repository Map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js pages, layouts, auth routes, and API endpoints. |
| `components/` | Dashboard, calendar, assistant, chart, preference, and shared UI components. |
| `hooks/` | Client state hooks for user auth, weather, preferences, and calendar data. |
| `lib/scoring.ts` | Activity-specific weather scoring engine. |
| `lib/weatherApi.ts` | Converts provider forecast payloads into scored 30-minute app windows. |
| `lib/google-weather.ts` | Server-side Google Weather, Open-Meteo extension, geocoding, caching, and snapshot fallback logic. |
| `lib/weather-suggestions.ts` | Auto-Protect risk detection and alternative suggestions. |
| `lib/ai/` | Assistant orchestration, provider adapter, deterministic scheduler path, intent parsing, and tool definitions. |
| `lib/preferences.ts` | Default preferences, normalization, comfort profiles, and blocked-time helpers. |
| `lib/calendar-store.ts` | Calendar reducer and event state operations. |
| `lib/supabase/` | Supabase client, server, middleware, and public config helpers. |
| `scripts/check-scheduler-regression.mjs` | Regression script for assistant scheduling behavior. |
| `supabase/schema.sql` | Database tables and RLS policies. |

## Implementation Notes

- Weather recommendations are hidden when live weather cannot be loaded and no quota snapshot is available.
- The dashboard treats blocked scheduling windows and existing calendar events as hard constraints before scoring recommendations.
- The Scheduler calendar uses optimistic client state; signed-in users persist changes through `/api/events`.
- Unsigned users can explore parts of the UI, but saved preferences and calendar persistence require Supabase auth.
- Built-in quick-pick cities are Madrid, Barcelona, Valencia, and Seville, but the city search can geocode other cities through Nominatim.
- Google Weather quota failures can fall back to the most recent Supabase weather snapshot when one exists.

## Why It Matters

A forecast can say it might rain at 18:00. Weather Scheduler goes further: it tells you whether 17:30 is still good for a run, whether golden hour tomorrow is better for photos, whether biking is a bad commute choice, and whether an outdoor dinner should move before the weather turns.

Weather Scheduler turns forecast data into scheduling decisions.
