-- Dashboard: tick off study plan tasks.
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table public.study_plans
  add column if not exists progress jsonb not null default '{}';  -- {"dayIndex-taskIndex": true}

-- Dashboard lists are read per user, newest first
create index if not exists study_plans_user_idx on public.study_plans (user_id, created_at desc);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);
create index if not exists doubts_user_idx on public.doubts (user_id, created_at desc);
