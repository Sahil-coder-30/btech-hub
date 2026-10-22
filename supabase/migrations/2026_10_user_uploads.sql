-- =============================================================
-- Student uploads: notes, PYQs or photos sent through the ML service (OCR + vision).
-- Uploads wait for admin review. Approved uploads are indexed into Pinecone and
-- recorded in public.documents like every other indexed file.
-- Run once in Supabase SQL Editor. Safe to run again.
-- =============================================================

create table if not exists public.user_uploads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text not null,
  subject_title   text,
  subject_code    text,
  branch_code     text references public.branches(code),
  year            smallint check (year between 1 and 4),
  type            text not null default 'notes' check (type in ('notes','pyq','imp_question','other')),
  file_name       text not null,
  mime_type       text not null,
  size_bytes      int not null,
  page_count      int not null default 1,
  ocr_methods     jsonb not null default '{}',   -- {text_layer, ocr, vision} page counts
  ocr_confidence  numeric(4,3),
  quality         jsonb,                         -- photo checks: blur, brightness, resolution
  analysis        jsonb not null default '{}',   -- language, detected codes, keywords, suggested type
  text            text not null,                 -- extracted text, indexed on approval
  status          text not null default 'pending' check (status in ('pending','approved','rejected','failed')),
  review_note     text,
  reviewed_by     uuid references public.users(id) on delete set null,
  reviewed_at     timestamptz,
  document_id     uuid references public.documents(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists user_uploads_user_idx   on public.user_uploads (user_id, created_at desc);
create index if not exists user_uploads_status_idx on public.user_uploads (status, created_at);

alter table public.user_uploads enable row level security;
