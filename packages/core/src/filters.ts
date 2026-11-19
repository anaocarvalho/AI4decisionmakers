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
const US_STATE_ABBR = /,\s*(A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\b/;
const US_STATES = ["alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi","missouri","montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee","texas","utah","vermont","virginia","washington","west virginia","wisconsin","wyoming","district of columbia"];
const GENERIC_REMOTE = /^(remote|anywhere|remote anywhere|work from home|fully remote|distributed)?$/;

function hasUsSignal(rawLocation: string, loc: string): boolean {
  return US_RE.test(loc) || US_STATE_ABBR.test(rawLocation) || US_STATES.some((st) => has(loc, st)) || GENERIC_REMOTE.test(loc);
}

export function checkLocation(job: Pick<Job, "location" | "isRemote" | "country">, cfg: Config): RejectReason | null {
  const loc = normText(job.location);
  const inCity = cfg.locations.cities.some((c) => [c.name, ...c.aliases].some((a) => has(loc, a.split(",")[0]!)));
  if (inCity) return null; // on-site, hybrid or remote — all fine in NYC
  if (job.country && !/^(us|usa|united states)$/i.test(job.country.trim())) return "location";
  if (!job.isRemote || !cfg.locations.remote_us) return "location";
  // Remote: needs a US signal ("Remote - US", "Austin, TX", plain "Remote"), and no foreign marker unless the US is also named.
  const nonUs = cfg.locations.non_us_markers.some((m) => has(loc, m));
  if (nonUs && !US_RE.test(loc)) return "location";
  return hasUsSignal(job.location, loc) ? null : "location";
}

export function checkAge(job: Pick<Job, "postedAt">, cfg: Config, now = new Date()): RejectReason | null {
  if (!job.postedAt) return null;
  const t = Date.parse(job.postedAt);
  if (Number.isNaN(t)) return null;
  return now.getTime() - t > cfg.search.max_age_days * 86_400_000 ? "stale" : null;
}

/** First failing check, or null if the job passes every filter. */
export function rejectReason(job: Job, cfg: Config, now = new Date()): RejectReason | null {
  return checkTitle(job.title, cfg) ?? checkLocation(job, cfg) ?? checkExperience(job, cfg) ?? checkAge(job, cfg, now);
}
