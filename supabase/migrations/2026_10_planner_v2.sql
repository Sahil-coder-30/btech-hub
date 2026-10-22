-- =============================================================
-- Study Planner v2: one row per task, so tasks can be ticked,
-- skipped and moved when the student falls behind.
-- Run once in the Supabase SQL Editor. Safe to run again.
-- =============================================================

alter table public.study_plans add column if not exists start_date date;
alter table public.study_plans add column if not exists settings   jsonb not null default '{}';  -- availability, subjects with exam dates
alter table public.study_plans add column if not exists status     text  not null default 'active';
alter table public.study_plans add column if not exists updated_at timestamptz not null default now();
alter table public.study_plans add column if not exists progress   jsonb not null default '{}';  -- legacy v1 ticks

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_plans_status_check') then
    alter table public.study_plans add constraint study_plans_status_check check (status in ('active','archived'));
  end if;
end $$;

create table if not exists public.study_plan_tasks (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.study_plans(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  date          date not null,
  position      smallint not null default 0,
  subject       text not null,
  subject_code  text,
  unit          text,
  topic         text not null,
  type          text not null check (type in ('learn','revise','practice','pyq','mock')),
  minutes       smallint not null check (minutes between 5 and 600),
  status        text not null default 'todo' check (status in ('todo','done','skipped')),
  done_at       timestamptz,
  moved_from    date,                          -- set when a re-plan moved the task
  created_at    timestamptz not null default now()
);

create index if not exists study_plan_tasks_plan_idx on public.study_plan_tasks (plan_id, date, position);
create index if not exists study_plan_tasks_user_idx on public.study_plan_tasks (user_id, date);
create index if not exists study_plans_user_idx      on public.study_plans (user_id, created_at desc);

alter table public.study_plan_tasks enable row level security;
