-- =============================================================
-- AKTU circulars: synced daily from the AKTU ERP circular page.
-- Each circular is read once (text layer or Gemini vision), summarised, and the
-- text is kept for chat. Rows are only written by the server (service role).
-- Run once in Supabase SQL Editor. Safe to run again.
-- =============================================================

create table if not exists public.circulars (
  id            text primary key,                -- AKTU PDF file name, e.g. 211271u3msy4zx
  department    text,
  title         text not null,
  published_on  date,
  pdf_url       text not null,
  status        text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  summary       jsonb,                           -- {gist, audience, forStudents, deadline, action, points[]}
  text          text,                            -- full text for chat, filled when ready
  error         text,
  started_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists circulars_published_idx on public.circulars (published_on desc nulls last, id desc);
create index if not exists circulars_status_idx    on public.circulars (status, published_on desc);
create index if not exists circulars_department_idx on public.circulars (department);

alter table public.circulars enable row level security;

-- Department filter options with counts. security_invoker keeps the table's RLS in force.
create or replace view public.circular_departments with (security_invoker = true) as
  select department, count(*)::int as circulars
  from public.circulars
  where department is not null
  group by department;
