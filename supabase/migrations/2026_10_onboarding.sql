-- =============================================================
-- Onboarding, student profile and memory.
-- Run once in Supabase SQL Editor on a database created from an
-- older schema.sql. Safe to run again.
-- =============================================================

alter table public.users add column if not exists semester smallint check (semester between 1 and 8);
alter table public.users add column if not exists onboarded_at timestamptz;

alter table public.sgpa_records add column if not exists source text not null default 'manual'
  check (source in ('manual','aktu_result'));
alter table public.sgpa_records add column if not exists meta jsonb not null default '{}';

create table if not exists public.student_profiles (
  user_id      uuid primary key references public.users(id) on delete cascade,
  batch_year   smallint,
  origin       text not null check (origin in ('aktu_result','no_result')),
  electives    jsonb not null default '[]',
  goals        jsonb not null default '[]',
  target_cgpa  numeric(4,2),
  note         text,
  stats        jsonb not null default '{}',
  insights     jsonb not null default '{}',
  insights_at  timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists public.student_memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null check (kind in ('goal','struggle','strength','preference','fact','event')),
  content     text not null check (char_length(content) <= 300),
  source      text not null check (source in ('onboarding','chat','quiz')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists student_memories_user_idx on public.student_memories (user_id, updated_at desc);

alter table public.student_profiles enable row level security;
alter table public.student_memories enable row level security;

-- Admins skip onboarding. Existing students are sent through it on
-- their next visit to the dashboard.
update public.users set onboarded_at = now() where role = 'admin' and onboarded_at is null;
