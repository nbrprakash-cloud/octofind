-- ============================================================
--  Octofinder — Supabase Schema (Hardened)
--  Run this in your Supabase project's SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
--  Core tables
-- ============================================================

create table if not exists reports (
  id                 uuid primary key default gen_random_uuid(),
  flagged_text       text,
  username           text,
  severity           text not null check (severity in ('red', 'yellow')),
  reasons            jsonb not null default '[]'::jsonb,
  page_url           text,
  extension_version  text,
  status             text not null default 'pending'
                     check (status in ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at         timestamptz not null default now()
);

create table if not exists feedback (
  id                 uuid primary key default gen_random_uuid(),
  rating             int check (rating between 1 and 5),
  comment            text,
  extension_version  text,
  created_at         timestamptz not null default now()
);

create table if not exists reviews (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  reddit_username  text,
  rating           int not null check (rating between 1 and 5),
  comment          text not null,
  approved         boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists reviews_created_at_idx on reviews (created_at desc);
create index if not exists reports_created_at_idx on reports (created_at desc);
create index if not exists feedback_created_at_idx on feedback (created_at desc);

-- ============================================================
--  Abuse control table (DB-side rate limiting)
-- ============================================================

create table if not exists ingest_rate_limits (
  client_ip     text not null,
  endpoint      text not null,
  window_start  timestamptz not null,
  request_count int not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (client_ip, endpoint, window_start)
);

create index if not exists ingest_rate_limits_updated_at_idx
  on ingest_rate_limits (updated_at desc);

-- ============================================================
--  Validation helpers
-- ============================================================

create or replace function request_ip_address()
returns text
language sql
stable
as $$
  with headers as (
    select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h
  )
  select nullif(
    trim(
      split_part(
        coalesce(
          h ->> 'x-real-ip',
          h ->> 'x-forwarded-for',
          'unknown'
        ),
        ',',
        1
      )
    ),
    ''
  )
  from headers;
$$;

create or replace function valid_reason_array(
  items jsonb,
  max_items integer default 8,
  max_chars integer default 140
)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(items, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(items, '[]'::jsonb)) <= max_items
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(items, '[]'::jsonb)) as t(reason)
      where char_length(t.reason) = 0 or char_length(t.reason) > max_chars
    );
$$;

create or replace function enforce_ingest_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), 'anon');
  v_ip text := coalesce(request_ip_address(), 'unknown');
  v_window timestamptz := date_trunc('hour', now());
  v_limit int;
  v_count int;
begin
  if v_role <> 'anon' then
    return new;
  end if;

  v_limit := case tg_table_name
    when 'reports' then 40
    when 'feedback' then 8
    when 'reviews' then 8
    else 20
  end;

  insert into ingest_rate_limits (client_ip, endpoint, window_start, request_count, updated_at)
  values (v_ip, tg_table_name, v_window, 1, now())
  on conflict (client_ip, endpoint, window_start)
  do update set
    request_count = ingest_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  if v_count > v_limit then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;

  return new;
end;
$$;

-- ============================================================
--  Data constraints (idempotent)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reports_flagged_text_len_chk'
  ) then
    alter table reports
      add constraint reports_flagged_text_len_chk
      check (flagged_text is null or char_length(flagged_text) <= 280);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reports_username_format_chk'
  ) then
    alter table reports
      add constraint reports_username_format_chk
      check (username is null or username ~ '^[A-Za-z0-9_-]{1,32}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reports_page_url_sanitized_chk'
  ) then
    alter table reports
      add constraint reports_page_url_sanitized_chk
      check (
        page_url is null or (
          char_length(page_url) <= 300 and
          page_url ~* '^https://([a-z0-9-]+\.)?reddit\.com/' and
          position('?' in page_url) = 0 and
          position('#' in page_url) = 0
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reports_extension_version_chk'
  ) then
    alter table reports
      add constraint reports_extension_version_chk
      check (extension_version is null or extension_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reports_reasons_shape_chk'
  ) then
    alter table reports
      add constraint reports_reasons_shape_chk
      check (valid_reason_array(reasons, 8, 140));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'feedback_comment_len_chk'
  ) then
    alter table feedback
      add constraint feedback_comment_len_chk
      check (comment is null or char_length(comment) <= 800);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'feedback_extension_version_chk'
  ) then
    alter table feedback
      add constraint feedback_extension_version_chk
      check (extension_version is null or extension_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reviews_name_len_chk'
  ) then
    alter table reviews
      add constraint reviews_name_len_chk
      check (char_length(name) between 2 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reviews_username_format_chk'
  ) then
    alter table reviews
      add constraint reviews_username_format_chk
      check (
        reddit_username is null or
        reddit_username ~* '^(u/)?[A-Za-z0-9_-]{1,32}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reviews_comment_len_chk'
  ) then
    alter table reviews
      add constraint reviews_comment_len_chk
      check (char_length(comment) between 10 and 1000);
  end if;
end
$$;

-- ============================================================
--  Triggers (rate limit before insert)
-- ============================================================

drop trigger if exists trg_reports_rate_limit on reports;
create trigger trg_reports_rate_limit
before insert on reports
for each row
execute function enforce_ingest_rate_limit();

drop trigger if exists trg_feedback_rate_limit on feedback;
create trigger trg_feedback_rate_limit
before insert on feedback
for each row
execute function enforce_ingest_rate_limit();

drop trigger if exists trg_reviews_rate_limit on reviews;
create trigger trg_reviews_rate_limit
before insert on reviews
for each row
execute function enforce_ingest_rate_limit();

-- ============================================================
--  Row Level Security
-- ============================================================

alter table reports enable row level security;
alter table feedback enable row level security;
alter table reviews enable row level security;
alter table ingest_rate_limits enable row level security;

drop policy if exists "anon_insert_reports" on reports;
drop policy if exists "anon_insert_feedback" on feedback;
drop policy if exists "anon_insert_reviews" on reviews;
drop policy if exists "anon_read_approved_reviews" on reviews;
drop policy if exists "auth_read_reports" on reports;
drop policy if exists "auth_read_feedback" on feedback;
drop policy if exists "auth_update_reports" on reports;
drop policy if exists "auth_read_reviews" on reviews;
drop policy if exists "auth_update_reviews" on reviews;

-- Anonymous insert policies (strict validation)
create policy "anon_insert_reports"
  on reports for insert
  to anon
  with check (
    status = 'pending' and
    severity in ('red', 'yellow') and
    extension_version is not null and
    extension_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$' and
    (flagged_text is null or char_length(flagged_text) between 3 and 280) and
    (username is null or username ~ '^[A-Za-z0-9_-]{1,32}$') and
    (page_url is null or (
      char_length(page_url) <= 300 and
      page_url ~* '^https://([a-z0-9-]+\.)?reddit\.com/' and
      position('?' in page_url) = 0 and
      position('#' in page_url) = 0
    )) and
    valid_reason_array(reasons, 8, 140)
  );

create policy "anon_insert_feedback"
  on feedback for insert
  to anon
  with check (
    rating between 1 and 5 and
    extension_version is not null and
    extension_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$' and
    (comment is null or char_length(comment) between 1 and 800)
  );

create policy "anon_insert_reviews"
  on reviews for insert
  to anon
  with check (
    approved = false and
    char_length(name) between 2 and 80 and
    (reddit_username is null or reddit_username ~* '^(u/)?[A-Za-z0-9_-]{1,32}$') and
    rating between 1 and 5 and
    char_length(comment) between 10 and 1000
  );

-- Public read policy (approved reviews only)
create policy "anon_read_approved_reviews"
  on reviews for select
  to anon
  using (approved = true);

-- Authenticated admin policies
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

create policy "auth_read_reviews"
  on reviews for select
  to authenticated
  using (true);

create policy "auth_update_reviews"
  on reviews for update
  to authenticated
  using (true);