import { htmlToText, type RawJob } from "@jobscout/core";
import { buildQueries, type SearchQuery } from "./queries.js";
import type { JobSource } from "./types.js";

// Docs: https://developer.adzuna.com/docs/search  (free key: developer.adzuna.com)
// Note: Adzuna returns a ~500-character description snippet, not the full posting.
interface AdzunaJob {
  id: string | number;
  title: string;
  description?: string;
  created?: string;
  redirect_url: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
}

export function adzunaUrl(q: SearchQuery, appId: string, appKey: string, perPage: number): string {
  const p = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(perPage),
    what: q.remote ? `${q.what} remote` : q.what,
    max_days_old: "14",
    sort_by: "date",
    "content-type": "application/json",
  });
  if (q.where) p.set("where", q.where);
  return `https://api.adzuna.com/v1/api/jobs/us/search/1?${p}`;
}

export const adzuna: JobSource = {
  name: "adzuna",
  requiredEnv: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
  isEnabled: (cfg) => cfg.sources.adzuna.enabled,
  async fetch(ctx) {
    const out: RawJob[] = [];
    for (const q of buildQueries(ctx.cfg)) {
      try {
        const res = await ctx.http(adzunaUrl(q, ctx.env.ADZUNA_APP_ID!, ctx.env.ADZUNA_APP_KEY!, ctx.cfg.sources.adzuna.results_per_query));
        const data = (await res.json()) as { results?: AdzunaJob[] };
        for (const j of data.results ?? []) {
          const location = j.location?.display_name ?? "";
          out.push({
            source: "adzuna",
            sourceId: String(j.id),
            title: htmlToText(j.title),
            company: j.company?.display_name ?? "Unknown",
            location: q.remote && !/remote/i.test(location) ? `${location} (Remote)`.trim() : location,
            remote: q.remote || undefined,
            url: j.redirect_url,
            description: j.description ?? "",
            postedAt: j.created,
          });
        }
      } catch (err) {
        ctx.reportError(`adzuna "${q.what}"${q.where ? ` in ${q.where}` : " remote"}`, err);
      }
    }
    return out;
  },
};
