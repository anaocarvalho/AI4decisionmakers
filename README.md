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
| Adzuna, JSearch, USAJobs | yes | Milestone 5 |

**Adding a source:** create `fetcher/src/sources/<name>.ts` implementing `JobSource` (`name`, `isEnabled(cfg)`, `fetch(ctx)` → `RawJob[]`), register it in `fetcher/src/sources/index.ts`, add a block under `sources:` in `config.yaml` (plus its schema in `packages/core/src/config.ts`), and add a fixture-based test in `fetcher/test/`. Use `ctx.http` (retries + rate limit) and `ctx.reportError` for partial failures. A failing source never stops the others.

### Filtering rules (in `packages/core`)
1. **Dedupe:** same company + title + city, or the same canonical URL. Employer boards win over aggregators.
2. **Title:** must contain a `title_keywords` entry and no `title_exclude` entry (seniority).
3. **Location:** NYC (any arrangement), or remote with a US signal.
4. **Experience:** dropped if the smallest "N years of experience" requirement is above `max_years_experience`.
5. **Age:** dropped if first published more than `max_age_days` ago.
6. **Sponsorship:** never dropped; flagged `blocked` / `friendly` / `unknown` (plus E-Verify) and ranked lower when blocked.

## Milestones
- [x] M0 Scaffold
- [x] M1 Core logic (normalize, dedupe, filters, sponsorship flags, retry)
- [x] M2 Keyless sources (Greenhouse / Lever / Ashby) + dry run
- [ ] M3 Supabase schema + RLS
- [ ] M4 Claude scoring + daily GitHub Action
- [ ] M5 Adzuna / JSearch / USAJobs
- [ ] M6 Web app on Netlify
- [ ] M7 Tailoring function
- [ ] M8 Weekly digest
