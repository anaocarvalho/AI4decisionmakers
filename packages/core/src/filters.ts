import type { Config } from "./config.js";
import { normText, normTitle } from "./normalize.js";
import type { Job, RejectReason } from "./types.js";

const has = (haystack: string, phrase: string) => ` ${haystack} `.includes(` ${normText(phrase)} `);

export function checkTitle(title: string, cfg: Config): RejectReason | null {
  const t = normTitle(title);
  if (cfg.search.title_exclude.some((x) => normText(x) && has(t, x))) return "seniority";
  if (!cfg.search.include_internships && /\bintern(ship)?\b/.test(t)) return "title";
  if (!cfg.search.title_keywords.some((k) => has(t, k))) return "title";
  return null;
}

export function checkExperience(job: Pick<Job, "minYearsExperience">, cfg: Config): RejectReason | null {
  return job.minYearsExperience !== null && job.minYearsExperience > cfg.search.max_years_experience ? "experience" : null;
}

const US_RE = /\b(us|usa|u s|united states|america)\b/;

export function checkLocation(job: Pick<Job, "location" | "isRemote">, cfg: Config): RejectReason | null {
  const loc = normText(job.location);
  const inCity = cfg.locations.cities.some((c) => [c.name, ...c.aliases].some((a) => has(loc, a.split(",")[0]!)));
  if (inCity) return null; // on-site, hybrid or remote — all fine in NYC
  if (job.isRemote && cfg.locations.remote_us) {
    const nonUs = cfg.locations.non_us_markers.some((m) => has(loc, m));
    if (!nonUs || US_RE.test(loc)) return null;
  }
  return "location";
}

/** First failing check, or null if the job passes every filter. */
export function rejectReason(job: Job, cfg: Config): RejectReason | null {
  return checkTitle(job.title, cfg) ?? checkLocation(job, cfg) ?? checkExperience(job, cfg);
}
