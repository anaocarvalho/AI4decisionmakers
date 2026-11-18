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
| `fetcher` | Daily job fetcher (run by GitHub Actions) |
| `resume.example.md` | Template. Copy it to `resume.md`, which is **gitignored** |

## Local development

Requires Node 22 (`nvm use`).

```bash
npm install
npm test           # unit tests (Vitest)
npm run typecheck  # tsc
```

## Milestones
- [x] M0 Scaffold
- [x] M1 Core logic (normalize, dedupe, filters, sponsorship flags, retry)
- [ ] M2 Keyless sources (Greenhouse / Lever / Ashby) + dry run
- [ ] M3 Supabase schema + RLS
- [ ] M4 Claude scoring + daily GitHub Action
- [ ] M5 Adzuna / JSearch / USAJobs
- [ ] M6 Web app on Netlify
- [ ] M7 Tailoring function
- [ ] M8 Weekly digest
