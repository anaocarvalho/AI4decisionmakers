# JobScout

A personal job-application assistant for entry-level, OPT/CPT-friendly roles: data analyst, economic analyst, research analyst/assistant, econometrics, policy analyst and think-tank roles. It targets remote (US) and New York City positions.

- **Discovery:** a GitHub Actions cron pulls postings from APIs that allow programmatic access (Greenhouse, Lever and Ashby public boards; Adzuna; JSearch; USAJobs). It never scrapes LinkedIn, Indeed or Handshake.
- **Filtering:** dedupe, then entry-level, location and role filters, then sponsorship flags. Claude scores each surviving job's fit 0–100.
- **Tracker:** a React app on Netlify with Supabase (Postgres, RLS, magic-link auth).
- **Tailoring:** on demand, a Netlify Background Function drafts resume bullets and a cover letter.
- **Human in the loop:** the app never submits applications.

> Status: built milestone by milestone. See the checklist at the bottom.

## Repository layout

| Path | What |
|---|---|
| `config.yaml` | Keywords, locations, target companies, models, thresholds |
| `packages/core` | Shared logic: config, normalize, dedupe, filters, sponsorship flags, HTTP retry |
| `fetcher` | Daily job fetcher (run by GitHub Actions). Sources live in `fetcher/src/sources/` |
| `resume.example.md` | Template. Copy it to `resume.md`, which is **gitignored** |

## Local development

Requires Node 22 (`nvm use`).

```bash
npm install
npm test           # unit tests (Vitest)
npm run typecheck  # tsc
```

## Fetching jobs

```bash
npm run fetch -- --dry-run                    # all enabled sources → out/jobs.json + summary
npm run fetch -- --dry-run --sources ashby    # just one source
```

Behind a corporate/sandbox HTTP proxy, prefix with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21). GitHub Actions doesn't need it.

On GitHub: **Actions → Fetch jobs → Run workflow**. The filtered jobs are attached to the run as the `jobs-dry-run` artifact.

### Sources

| Source | Key needed | Notes |
|---|---|---|
| Greenhouse, Lever, Ashby | none | Public employer boards. Add employers in `config.yaml → sources.<name>.boards`. The token is the slug in the board URL. |
| Adzuna | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Free at [developer.adzuna.com](https://developer.adzuna.com). Returns description snippets only. |
| JSearch (Google for Jobs) | `RAPIDAPI_KEY` | Subscribe to the free JSearch plan on [rapidapi.com](https://rapidapi.com) (about 200 requests/month). Runs 8 queries a day, rotating through `search.queries`. |
| USAJobs | `USAJOBS_API_KEY`, `USAJOBS_EMAIL` | Free at [developer.usajobs.gov](https://developer.usajobs.gov). **Off by default:** federal jobs require U.S. citizenship, so they are all flagged as blocked. |

Keyed sources are skipped automatically until their GitHub Secrets exist, so you enable one just by adding its keys. Keyword sources search each `search.queries` entry in NYC and as remote.

**Adding a source:** create `fetcher/src/sources/<name>.ts` implementing `JobSource` (`name`, `isEnabled(cfg)`, `fetch(ctx)` → `RawJob[]`), register it in `fetcher/src/sources/index.ts`, add a block under `sources:` in `config.yaml` (plus its schema in `packages/core/src/config.ts`), and add a fixture-based test in `fetcher/test/`. Use `ctx.http` (retries + rate limit) and `ctx.reportError` for partial failures. A failing source never stops the others.

### Filtering rules (in `packages/core`)
1. **Dedupe:** same company + title + city, or the same canonical URL. Employer boards win over aggregators.
2. **Title:** must contain a `title_keywords` entry and no `title_exclude` entry (seniority).
3. **Location:** NYC (any arrangement), or remote with a US signal.
4. **Experience:** dropped if the smallest "N years of experience" requirement is above `max_years_experience`.
5. **Age:** dropped if first published more than `max_age_days` ago.
6. **Sponsorship:** never dropped; flagged `blocked` / `friendly` / `unknown` (plus E-Verify) and ranked lower when blocked.

## Fit scoring (Claude)

Each new job that passes the filters gets one call to **Claude Haiku 5.5** (`scoring.model` in `config.yaml`) at low effort. The call returns a 0–100 fit score, a one-line rationale, and whether the role is realistic at 0–2 years of experience. Your resume sits in a fixed system prompt so it can be prompt-cached.

- **Ranking:** `rank_score` = fit score, minus `sponsorship_penalty` (40) for "no sponsorship / citizens only / clearance" postings, plus 5 for OPT-friendly, plus 2 for E-Verify.
- **Budget:** at most `scoring.max_jobs_per_run` (150) calls per run, newest first. Unscored jobs carry over to the next run.
- **Cost:** about $0.0005 per job, so a typical day costs about a cent.
- **Failures:** a bad key or empty credit stops scoring for that run, but the fetch itself still succeeds.
- **Resume:** paste it on the **Resume** page of the web app, or run `npm run resume:upload`, which pushes your local, gitignored `resume.md`.

Add the GitHub Secret `ANTHROPIC_API_KEY`, from [console.anthropic.com](https://console.anthropic.com) → API Keys.

The workflow runs **weekdays at 12:10 UTC** (7:10 AM Eastern). You can also start it by hand from **Actions → Fetch jobs → Run workflow**.

## Supabase setup

The database stores jobs, your tracking status, drafts and your resume. Every table has row-level security: a logged-in user can only see and change their own rows, and logged-out visitors get nothing. The daily fetcher writes with the service-role key, which lives only in GitHub Secrets.

1. **Create the project:** [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → name `JobScout`, region **East US (North Virginia)**. Save the database password in a password manager; JobScout doesn't need it.
2. **Create the tables:** **SQL Editor** → **New query** → paste all of `supabase/migrations/20261119000000_init.sql` → **Run**. You should see "Success. No rows returned".
3. **Create your user:** **Authentication → Users → Add user → Create new user** with your email. Tick "Auto Confirm User" and set any password (you'll log in with magic links). Copy the user's **UID**.
4. **Lock signups:** **Authentication → Sign In / Providers**. Turn **off** "Allow new users to sign up". Leave **Email** enabled. Now only you can log in.
5. **Add GitHub Secrets** (repo → **Settings → Secrets and variables → Actions → New repository secret**):

   | Secret | Where to find it |
   |---|---|
   | `SUPABASE_URL` | Supabase → **Project Settings → Data API** → Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API Keys** → `service_role` (secret) key |
   | `JOBSCOUT_OWNER_ID` | the UID from step 3 |

6. **Test it:** GitHub → **Actions → Fetch jobs → Run workflow**, tick **Save results to Supabase** → run. Then Supabase → **Table Editor → jobs** shows the rows, and **fetch_runs** has one row per run.

To run the save locally, copy `.env.example` to `.env`, fill it in, and run `npm run fetch`.

### Schema at a glance
| Table | Written by | Purpose |
|---|---|---|
| `jobs` | fetcher (posting fields), you (interested, status, notes) | One row per unique posting, unique on `(owner_id, dedupe_key)` |
| `drafts` | tailoring function (Milestone 7) | Resume bullets + cover letter per job |
| `profiles` | you | Your resume (Markdown), kept out of git |
| `fetch_runs` | fetcher | Stats and errors from each daily run |

`supabase/test/rls.test.ts` runs the migration on an in-memory Postgres and checks that one user can't read or change another user's rows.

## Web app (Netlify)

**Stack:** React + Vite, built to static files in `web/dist`, plus Netlify Functions in `netlify/functions`.

**Why not Next.js?** The app is a private, login-only tracker, so server rendering and SEO buy nothing. Supabase (with RLS) and one Netlify Function cover the backend. A static Vite build deploys faster and avoids Next's runtime adapter on Netlify.

**What it does:**
- **Jobs tab:** a table with fit score, title, company, location/remote, source, posted date, sponsorship flag, status and link. The "★" column is the Interested checkbox; ticking it moves New → Interested.
- **Filters:** status, Remote/NYC, source, minimum score, hide no-sponsorship, interested-only, and text search. Click a column header to sort. The pipeline chips at the top count each status, and clicking one filters to it.
- **Job panel:** click a title to see the rationale, sponsorship evidence, description and notes, plus an **Open application ↗** button. JobScout never submits anything.
- **Resume tab:** paste your resume. It is used for scoring and tailoring.

### Netlify setup
1. **Import from Git** (already done): Netlify → **Add new project → Import an existing project → GitHub** → this repo.
2. **Project configuration → Build & deploy → Build settings:** leave **Base directory** empty. `netlify.toml` sets the build command `npm run build`, publish `web/dist`, and functions `netlify/functions`.
3. **Branches and deploy contexts:** **Production branch = `main`**. Deploy previews: "Any pull request against your production branch".
4. **Project configuration → Environment variables** (scope: all, or Builds + Functions):

   | Key | Value | Secret? |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | no. It's public and baked into the browser bundle |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **publishable** key (`sb_publishable_…`) | no. It's public and protected by RLS |
   | `ANTHROPIC_API_KEY` | from console.anthropic.com | **yes**. Tick "Contains secret values", scope **Functions only** (Milestone 7) |

   **Never** put `SUPABASE_SERVICE_ROLE_KEY` in Netlify. It belongs only in GitHub Secrets.
5. **Supabase → Authentication → URL Configuration:**
   - **Site URL** = `https://<your-site>.netlify.app`.
   - **Redirect URLs:** add `https://<your-site>.netlify.app/**`, `https://*--<your-site>.netlify.app/**` (deploy previews) and `http://localhost:8888/**` (local).
6. Trigger a deploy and open the site. Sign in with your email, then click the magic link.

### Where each secret lives
| Secret | GitHub Secrets (fetcher) | Netlify env (site + functions) | Browser |
|---|---|---|---|
| Supabase URL | ✅ `SUPABASE_URL` | ✅ `VITE_SUPABASE_URL` | ✅ (public) |
| Supabase publishable/anon key | | ✅ `VITE_SUPABASE_ANON_KEY` | ✅ (public, RLS-protected) |
| Supabase **service-role** key | ✅ | ❌ never | ❌ never |
| Anthropic API key | ✅ (scoring) | ✅ Functions scope (tailoring) | ❌ never |
| Job API keys (Adzuna, RapidAPI, USAJobs) | ✅ | ❌ | ❌ |

### Local development
```bash
npm install -g netlify-cli   # once
netlify link                 # once: connect this folder to your Netlify project
netlify dev                  # http://localhost:8888, serving the app + functions with Netlify env vars
```
For the UI alone, `npm run dev -w @jobscout/web` with a `web/.env.local` file containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Milestones
- [x] M0 Scaffold
- [x] M1 Core logic (normalize, dedupe, filters, sponsorship flags, retry)
- [x] M2 Keyless sources (Greenhouse / Lever / Ashby) + dry run
- [x] M3 Supabase schema + RLS
- [x] M4 Claude scoring + daily GitHub Action
- [x] M5 Adzuna / JSearch / USAJobs
- [x] M6 Web app on Netlify
- [ ] M7 Tailoring function
- [ ] M8 Weekly digest
