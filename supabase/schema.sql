-- Run this in Supabase Dashboard → SQL Editor

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_events (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.weather_snapshots (
  city_key text primary key,
  city text not null,
  payload jsonb not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_events_user_idx
  on public.scheduled_events (user_id, start_time);

alter table public.user_preferences enable row level security;
alter table public.scheduled_events  enable row level security;
alter table public.weather_snapshots enable row level security;

drop policy if exists "own prefs"  on public.user_preferences;
drop policy if exists "own events" on public.scheduled_events;

create policy "own prefs" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own events" on public.scheduled_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
