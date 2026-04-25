# Weather Scheduler

**Live demo: [weather-scheduler-three.vercel.app](https://weather-scheduler-three.vercel.app/)**

Weather Scheduler is a weather-aware scheduling app that answers a more useful question than a normal forecast: **when should I do this activity?**

Instead of showing raw weather data, the app scores upcoming 30-minute time windows for different activities, explains the tradeoffs, and helps users add the best option to a calendar. It is built for decisions like when to run, study outside, plan dinner on a terrace, take photos, or avoid weather-risky travel windows.

## What It Does

- Scores weather windows for running, studying, social plans, commuting, photography, and custom preferences.
- Compares the best time against the user's usual time and nearby alternatives.
- Lets users tune personal weather sensitivity, comfort thresholds, preferred city, usual time, and blocked scheduling windows.
- Provides a conversational scheduler that can create, update, and delete calendar events after user confirmation.
- Detects weather-sensitive calendar events that are at risk and suggests safer times.
- Supports persistent accounts with saved preferences and events through Supabase.
- Uses live Google Weather data when configured, with deterministic mock weather fallback for reliable demos.

## Hackathon Demo Flow

Visit the live app at **[weather-scheduler-three.vercel.app](https://weather-scheduler-three.vercel.app/)** and log in with the demo account to explore all features without setting up anything:

```text
Email:    demo@weatherscheduler.com
Password: demo2026
```

1. Open the app and go to the dashboard.
2. Choose an activity, city, usual time, and weather preferences.
3. Review the recommended weather window, ranked alternatives, timeline chart, score breakdown, and explanation.
4. Use the Compare page to ask a natural-language question such as:

   ```text
   Best time for tennis tomorrow afternoon
   ```

5. Pick one of the recommendation cards and schedule it.
6. Go to the Scheduler page and use the assistant for requests like:

   ```text
   Add an outdoor dinner Friday evening
   Move my run to a better weather window
   ```

7. Open Auto-Protect to see weather-risk analysis for existing events and apply suggested moves.

## Core Pages

| Page | Purpose |
| --- | --- |
| `/` | Product overview and entry point. |
| `/dashboard` | Main weather scheduling dashboard with scoring, ranking, comparison, and insights. |
| `/compare` | Chat-driven activity comparison with recommendation cards and one-click scheduling. |
| `/scheduler` | Calendar, AI scheduling assistant, saved events, and Auto-Protect suggestions. |
| `/about` | Explanation of the scoring philosophy and supported activity types. |
| `/login` / `/signup` | Supabase authentication and demo account access. |

## How The Scoring Works

The app converts hourly weather forecasts into 30-minute `TimeWindow` objects, then scores each window from 0 to 100 for each supported activity.

Examples of activity-specific logic:

- **Running:** temperature, humidity, wind, rain probability, UV exposure, and time-of-day preference.
- **Study / deep work:** thermal comfort, daylight preference, and weather distraction level.
- **Social plans:** warmth, rain, wind, and atmosphere.
- **Commutes:** rain, wind, daylight, safety, and temperature, adjusted for car, bike, or walking.
- **Photography:** golden hour, cloud preference, rain, visibility, and light quality.

User preferences are applied on top of the base scoring model, so two users can receive different recommendations for the same forecast.

## Architecture

```text
Next.js App Router
  -> Dashboard / Compare / Scheduler UI
  -> Weather data hook
      -> /api/weather server proxy
      -> Google Weather API when configured
      -> mock weather fallback when unavailable
  -> Scoring engine
      -> activity-specific scores
      -> preference-adjusted windows
  -> Scheduler assistant
      -> /api/assistant
      -> Gemini function calling
      -> calendar, weather, and preference tools
  -> Supabase
      -> auth
      -> user preferences
      -> scheduled events
```

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui-style components, Radix UI
- **Charts and motion:** Recharts, Framer Motion
- **Auth and persistence:** Supabase Auth and Postgres
- **AI assistant:** Gemini API with tool/function calling
- **Weather:** Google Weather API with server-side API key protection

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Optional for full functionality: Google Weather API key, Gemini API key, and Supabase project

### Install

```bash
pnpm install
```

### Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then fill in the values you want to enable:

| Variable | Required For | Notes |
| --- | --- | --- |
| `GOOGLE_WEATHER_API_KEY` | Live weather | Without it, the app uses mock weather data. |
| `GEMINI_API_KEY` | AI chat and scheduling assistant | Required for `/compare` and `/scheduler` assistant responses. |
| `AI_PROVIDER` | AI provider selection | Defaults to `gemini`. |
| `GEMINI_MODEL` | Gemini model override | Defaults to `gemini-2.5-flash`. |
| `GEMINI_FALLBACK_MODELS` | Gemini fallback models | Defaults to `gemini-2.5-flash-lite`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth and saved data | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth and saved data | Browser-safe Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Demo account seeding | Used only server-side by the demo login route. |

### Supabase Setup

Create a Supabase project, enable email/password auth, and run the schema in:

```text
supabase/schema.sql
```

That creates:

- `user_preferences` for per-user settings.
- `scheduled_events` for persisted calendar events.
- Row-level security policies so users can only access their own data.

The login page includes a demo login action. When `SUPABASE_SERVICE_ROLE_KEY` is configured, it creates or refreshes:

```text
demo@weatherscheduler.com / demo2026
```

## Run Locally

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
pnpm build
pnpm start
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the local Next.js dev server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Run the production server. |
| `pnpm lint` | Run ESLint. |

## Important Implementation Details

- Weather API calls are proxied through `app/api/weather/route.ts`, so API keys stay server-side.
- Forecasts are cached briefly on the server to reduce quota usage.
- Mock weather covers multiple days and cities, making judging/demo sessions reliable even without external APIs.
- Assistant writes are confirmation-gated: the AI drafts calendar changes, and the user must approve them before they are applied.
- Blocked scheduling windows are treated as hard constraints for assistant recommendations and event creation.
- Auto-Protect analyzes weather-sensitive events and suggests conflict-free moves when the weather score is poor or a user rule is violated.

## Repository Map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes, pages, and API endpoints. |
| `components/` | UI components for dashboards, charts, calendar, assistant, and settings. |
| `hooks/` | Client-side state hooks for weather, preferences, user, and calendar data. |
| `lib/scoring.ts` | Activity-specific weather scoring engine. |
| `lib/weatherApi.ts` | Google Weather API response transformation into app time windows. |
| `lib/mockData.ts` | Deterministic fallback weather data. |
| `lib/ai/` | Assistant provider, Gemini integration, and scheduling tools. |
| `lib/weather-suggestions.ts` | Auto-Protect risk detection and alternative time suggestions. |
| `lib/supabase/` | Supabase client, server, middleware, and config helpers. |
| `supabase/schema.sql` | Database schema and row-level security policies. |

## Why It Matters

Weather affects outcomes, not just plans. A forecast can tell someone it might rain at 18:00, but it does not tell them whether 17:30 is still good for a run, whether their usual photo walk is worse than golden hour tomorrow, or whether an outdoor dinner should move by one hour.

Weather Scheduler turns forecast data into scheduling decisions.
