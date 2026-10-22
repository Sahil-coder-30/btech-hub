-- Ask your Syllabus: one chat-ready index per official syllabus PDF.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- Extra document info written by the ML service
alter table public.documents add column if not exists kind text;
alter table public.documents add column if not exists page_count int;

-- Many syllabus_links point to the same PDF (for example every CSE flavour shares the
-- first year syllabus), so indexing state is kept per PDF, keyed by its Drive file id.
create table if not exists public.syllabus_documents (
  file_key     text primary key,                 -- Drive file id, shared by every link to the same PDF
  source_url   text not null,
  document_id  uuid references public.documents(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending','indexing','ready','failed')),
  page_count   int,
  chunk_count  int,
  error        text,
  started_at   timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.syllabus_documents enable row level security;

-- Page text of indexed documents, for keyword search next to the vector search
create table if not exists public.document_pages (
  document_id  uuid not null references public.documents(id) on delete cascade,
  page         int not null,
  text         text not null,
  tsv          tsvector generated always as (to_tsvector('english', text)) stored,
  primary key (document_id, page)
);
create index if not exists document_pages_tsv_idx on public.document_pages using gin (tsv);
alter table public.document_pages enable row level security;

-- Keyword search inside one document. Any query word may match (OR), best pages first.
create or replace function public.search_document_pages(doc uuid, q text, k int default 5)
returns table (page int, text text, rank real)
language sql stable as $$
  with query as (
    select nullif(string_agg(quote_literal(l), ' | '), '')::tsquery as tq
    from unnest(tsvector_to_array(to_tsvector('english', q))) as l
  )
  select p.page, p.text, ts_rank_cd(p.tsv, query.tq) as rank
  from public.document_pages p, query
  where p.document_id = doc and query.tq is not null and p.tsv @@ query.tq
  order by rank desc
  limit k;
$$;
