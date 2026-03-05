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

-- ============================================================
--  Reviews table — public testimonials submitted via the
--  reviews page on the landing site.
-- ============================================================

create table if not exists reviews (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,            -- Display name (not stored privately)
  reddit_username  text,                     -- Optional: u/handle
  rating           int  not null check (rating between 1 and 5),
  comment          text not null,            -- Review body
  approved         boolean default false,    -- Admin approval before showing publicly
  created_at       timestamptz default now()
);

-- Index for dashboard ordering
create index if not exists reviews_created_at_idx on reviews (created_at desc);

alter table reviews enable row level security;

-- Anyone can submit a review
create policy "anon_insert_reviews"
  on reviews for insert
  to anon
  with check (true);

-- Only approved reviews are publicly readable
create policy "anon_read_approved_reviews"
  on reviews for select
  to anon
  using (approved = true);

-- Admins can read all and update (approve/reject)
create policy "auth_read_reviews"
  on reviews for select
  to authenticated
  using (true);

create policy "auth_update_reviews"
  on reviews for update
  to authenticated
  using (true);
