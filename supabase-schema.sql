-- ============================================================
--  Octofinder — Supabase Schema
--  Run this in your Supabase project's SQL Editor
-- ============================================================

-- Reports table (false positives)
create table if not exists reports (
  id                 uuid primary key default gen_random_uuid(),
  flagged_text       text,
  username           text,
  severity           text check (severity in ('red', 'yellow')),
  reasons            jsonb            default '[]',
  page_url           text,
  extension_version  text,
  status             text             default 'pending'
                     check (status in ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at         timestamptz      default now()
);

-- Feedback table (ratings + comments)
create table if not exists feedback (
  id                 uuid primary key default gen_random_uuid(),
  rating             int check (rating between 1 and 5),
  comment            text,
  extension_version  text,
  created_at         timestamptz      default now()
);

-- ============================================================
--  Row Level Security
--  Anonymous users can INSERT only. Only authenticated
--  admins can SELECT/UPDATE/DELETE.
-- ============================================================

alter table reports  enable row level security;
alter table feedback enable row level security;

-- Allow anonymous inserts
create policy "anon_insert_reports"
  on reports for insert
  to anon
  with check (true);

create policy "anon_insert_feedback"
  on feedback for insert
  to anon
  with check (true);

-- Only authenticated users (you) can read all rows
create policy "auth_read_reports"
  on reports for select
  to authenticated
  using (true);

create policy "auth_read_feedback"
  on feedback for select
  to authenticated
  using (true);

create policy "auth_update_reports"
  on reports for update
  to authenticated
  using (true);
