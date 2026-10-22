-- =============================================================
-- Profile, settings and memory management.
-- Run once in the Supabase SQL Editor. Safe to run again.
-- =============================================================

-- Name the student picked in Settings. Google login keeps updating "name",
-- so the custom one lives in its own column.
alter table public.users add column if not exists display_name text
  check (display_name is null or char_length(display_name) between 1 and 60);

-- Appearance, Vac and privacy preferences. Validated and filled with
-- defaults in code (src/lib/settings.ts), so an empty object is fine.
alter table public.users add column if not exists preferences jsonb not null default '{}';

-- Pinned memories are always sent to Vac and never dropped when the list is full.
alter table public.student_memories add column if not exists pinned boolean not null default false;

-- Students can now add memories themselves.
alter table public.student_memories drop constraint if exists student_memories_source_check;
alter table public.student_memories add constraint student_memories_source_check
  check (source in ('onboarding','chat','quiz','manual'));

-- Chat history is cleared and exported per user.
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at desc);
