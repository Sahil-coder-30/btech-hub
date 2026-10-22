-- =============================================================
-- Run this AFTER importing the CSV files.
-- 1. Turns empty CSV cells into real NULLs.
-- 2. Adds foreign keys to branches.
-- 3. Moves identity counters past the imported ids.
-- =============================================================

update public.subjects  set branch_code  = null where branch_code  = '';
update public.subjects  set primary_code = null where primary_code = '';
update public.resources set branch_code  = null where branch_code  = '';
update public.resources set subject_code = null where subject_code = '';
update public.resources set url          = null where url          = '';

alter table public.subjects
  drop constraint if exists subjects_branch_fk,
  add  constraint subjects_branch_fk foreign key (branch_code) references public.branches(code);

alter table public.resources
  drop constraint if exists resources_branch_fk,
  add  constraint resources_branch_fk foreign key (branch_code) references public.branches(code);

alter table public.syllabus_links
  drop constraint if exists syllabus_branch_fk,
  add  constraint syllabus_branch_fk foreign key (branch_code) references public.branches(code);

select setval(pg_get_serial_sequence('public.subjects', 'id'),       (select coalesce(max(id), 1) from public.subjects));
select setval(pg_get_serial_sequence('public.resources', 'id'),      (select coalesce(max(id), 1) from public.resources));
select setval(pg_get_serial_sequence('public.syllabus_links', 'id'), (select coalesce(max(id), 1) from public.syllabus_links));

-- Quick check: every count should be > 0
select 'branches' as t, count(*) from public.branches
union all select 'subjects', count(*) from public.subjects
union all select 'resources', count(*) from public.resources
union all select 'syllabus_links', count(*) from public.syllabus_links
union all select 'university_info', count(*) from public.university_info;
