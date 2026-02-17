-- Enable needed extensions
create extension if not exists pgcrypto;

-- =========================
-- Tables
-- =========================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  type text not null,              -- 'tab_updated', 'tab_activated', 'click', 'form_interaction'
  url text,
  title text,
  text_content text,               -- small safe context e.g. button text or input label (NO raw passwords)
  selector text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  url_host text,
  summary_text text not null
);

-- =========================
-- Search index (FTS)
-- =========================
create index if not exists memories_search_idx
on public.memories
using gin (to_tsvector('english', summary_text));

-- Useful indexes
create index if not exists events_user_time_idx on public.events (user_id, created_at desc);
create index if not exists memories_user_time_idx on public.memories (user_id, created_at desc);

-- =========================
-- RLS
-- =========================
alter table public.events enable row level security;
alter table public.memories enable row level security;

-- Users can only read/write their own rows
create policy "events_owner_rw"
on public.events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "memories_owner_rw"
on public.memories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================
-- Optional: Proper Postgres FTS via RPC
-- =========================
create or replace function public.search_memories(q text, lim int default 20)
returns setof public.memories
language sql
security invoker
as $$
  select *
  from public.memories
  where user_id = auth.uid()
    and to_tsvector('english', summary_text) @@ plainto_tsquery('english', q)
  order by created_at desc
  limit lim;
$$;
