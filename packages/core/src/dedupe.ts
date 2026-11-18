import { canonicalUrl, normCompany, normLocationKey, normTitle } from "./normalize.js";
import type { Job } from "./types.js";

export function dedupeKey(job: { company: string; title: string; location: string }, isRemote: boolean): string {
  return [normCompany(job.company), normTitle(job.title), normLocationKey(job.location, isRemote)].join("|");
}

// Direct employer boards beat aggregators when choosing which URL/description to keep.
const SOURCE_RANK: Record<string, number> = { greenhouse: 3, lever: 3, ashby: 3, usajobs: 3, adzuna: 1, jsearch: 1 };
const rank = (s: string) => SOURCE_RANK[s] ?? 2;

function merge(a: Job, b: Job): Job {
  const primary = rank(b.source) > rank(a.source) ? b : a;
  const other = primary === a ? b : a;
  const dates = [a.postedAt, b.postedAt].filter((d): d is string => !!d).sort();
  return {
    ...primary,
    description: primary.description.length >= other.description.length ? primary.description : other.description,
    postedAt: dates[0] ?? primary.postedAt,
    sources: [...new Set([...a.sources, ...b.sources])],
    remote: primary.remote ?? other.remote,
  };
}

/** Collapse postings that share a dedupe key OR a canonical URL. Order of first appearance is kept. */
export function dedupe(jobs: Job[]): Job[] {
  const out: Job[] = [];
  const byKey = new Map<string, number>();
  const byUrl = new Map<string, number>();
  for (const job of jobs) {
    const url = canonicalUrl(job.url);
    const idx = byKey.get(job.dedupeKey) ?? byUrl.get(url);
    if (idx === undefined) {
      byKey.set(job.dedupeKey, out.length);
      byUrl.set(url, out.length);
      out.push(job);
    } else {
      out[idx] = merge(out[idx]!, job);
      byKey.set(job.dedupeKey, idx);
      byUrl.set(url, idx);
    }
  }
  return out;
}
