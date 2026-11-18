import type { Config } from "./config.js";
import { dedupe, dedupeKey } from "./dedupe.js";
import { minYearsExperience } from "./experience.js";
import { rejectReason } from "./filters.js";
import { htmlToText, looksRemote } from "./normalize.js";
import { detectSponsorship } from "./sponsorship.js";
import type { Job, RawJob, RejectReason } from "./types.js";

export function buildJob(raw: RawJob): Job {
  const description = /<[a-z][\s\S]*>/i.test(raw.description) ? htmlToText(raw.description) : raw.description.trim();
  const isRemote = raw.remote ?? looksRemote(raw.location, raw.title);
  const text = `${raw.title}\n${description}`;
  return {
    ...raw,
    title: raw.title.trim(),
    company: raw.company.trim(),
    description,
    isRemote,
    dedupeKey: dedupeKey(raw, isRemote),
    sources: [raw.source],
    sponsorship: detectSponsorship(text),
    minYearsExperience: minYearsExperience(description),
  };
}

export interface PipelineResult {
  jobs: Job[];
  rejected: Record<RejectReason, number>;
  duplicates: number;
}

/** Normalize → dedupe → filter. Sponsorship-blocked jobs are kept (flagged, ranked lower), not dropped. */
export function processJobs(raws: RawJob[], cfg: Config): PipelineResult {
  const built = raws.map(buildJob);
  const unique = dedupe(built);
  const rejected: Record<RejectReason, number> = { title: 0, seniority: 0, experience: 0, location: 0 };
  const jobs = unique.filter((job) => {
    const reason = rejectReason(job, cfg);
    if (reason) rejected[reason]++;
    return !reason;
  });
  return { jobs, rejected, duplicates: built.length - unique.length };
}
