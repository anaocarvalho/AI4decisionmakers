-- JobScout initial schema.
-- Every row belongs to one auth user (owner_id). Row-level security lets a logged-in user touch only
-- their own rows. The daily fetcher writes with the service-role key, which bypasses RLS; that key lives
-- only in GitHub Secrets.


-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles (resume lives here, not in git)
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  resume_md  text not null default '',
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- jobs
create type public.job_status as enum
  ('new', 'interested', 'materials_drafted', 'applied', 'interview', 'offer', 'rejected');

create table public.jobs (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users (id) on delete cascade,
  dedupe_key            text not null,

  -- posting data (written by the fetcher)
  title                 text not null,
  company               text not null,
  location              text not null default '',
  is_remote             boolean not null default false,
  url                   text not null,
  description           text not null default '',
  source                text not null,
  sources               text[] not null default '{}',
  source_id             text,
  posted_at             timestamptz,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  sponsorship_status    text not null default 'unknown'
                          check (sponsorship_status in ('blocked', 'friendly', 'unknown')),
  sponsorship_reasons   text[] not null default '{}',
  everify               boolean not null default false,
  min_years_experience  int,

  -- scoring (written by the fetcher, Milestone 4)
  fit_score             int check (fit_score between 0 and 100),
  rank_score            int check (rank_score between 0 and 100),
  fit_rationale         text,
  score_model           text,
  scored_at             timestamptz,

  -- tracking (written by you in the app)
  interested            boolean not null default false,
  status                public.job_status not null default 'new',
  status_updated_at     timestamptz,
  notes                 text not null default '',

  updated_at            timestamptz not null default now(),
  unique (owner_id, dedupe_key)
);

create index jobs_owner_rank_idx   on public.jobs (owner_id, rank_score desc nulls last);
create index jobs_owner_status_idx on public.jobs (owner_id, status);
create index jobs_owner_posted_idx on public.jobs (owner_id, posted_at desc nulls last);

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Ticking "Interested" moves a New job to Interested; status changes are timestamped.
create or replace function public.jobs_track_status() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.interested and not coalesce(old.interested, false) and new.status = 'new' then
    new.status := 'interested';
  end if;
  if new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger jobs_track_status before update on public.jobs
  for each row execute function public.jobs_track_status();

-- ---------------------------------------------------------------- drafts (tailored materials)
create table public.drafts (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  job_id             uuid not null references public.jobs (id) on delete cascade,
  state              text not null default 'pending'
                       check (state in ('pending', 'running', 'done', 'error')),
  resume_bullets_md  text,
  cover_letter_md    text,
  error              text,
  model              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index drafts_job_idx on public.drafts (job_id, created_at desc);
create index drafts_owner_idx on public.drafts (owner_id);

create trigger drafts_updated_at before update on public.drafts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- fetch_runs (one row per daily run)
create table public.fetch_runs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  stats        jsonb not null default '{}',
  errors       jsonb not null default '[]'
);

create index fetch_runs_owner_idx on public.fetch_runs (owner_id, started_at desc);

-- ---------------------------------------------------------------- row-level security
alter table public.profiles   enable row level security;
alter table public.jobs       enable row level security;
alter table public.drafts     enable row level security;
alter table public.fetch_runs enable row level security;

-- profiles: read/create/update your own
create policy "own profile: select" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own profile: insert" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- jobs: read, update and delete your own. Inserts come only from the fetcher (service role).
create policy "own jobs: select" on public.jobs for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "own jobs: update" on public.jobs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own jobs: delete" on public.jobs for delete to authenticated
  using (owner_id = (select auth.uid()));

-- drafts: full access to your own, and only for your own jobs
create policy "own drafts: select" on public.drafts for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "own drafts: insert" on public.drafts for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = (select auth.uid()))
  );
create policy "own drafts: update" on public.drafts for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own drafts: delete" on public.drafts for delete to authenticated
  using (owner_id = (select auth.uid()));

-- fetch_runs: read-only for you
create policy "own runs: select" on public.fetch_runs for select to authenticated
  using (owner_id = (select auth.uid()));

-- The anonymous (logged-out) role gets nothing at all.
revoke all on public.profiles, public.jobs, public.drafts, public.fetch_runs from anon;

-- ---------------------------------------------------------------- realtime (drafts appear when ready)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.drafts;
  end if;
end;
$$;
