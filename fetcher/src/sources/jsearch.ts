import type { RawJob } from "@jobscout/core";
import { buildQueries, dayNumber, rotate } from "./queries.js";
import type { JobSource } from "./types.js";

// Docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch  (Google for Jobs aggregator via RapidAPI)
// Free tier ≈ 200 requests/month, so we run at most `max_queries_per_run` queries per day, rotating through the list.
interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name?: string;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_location?: string | null;
  job_is_remote?: boolean;
  job_apply_link: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string | null;
}

export const jsearch: JobSource = {
  name: "jsearch",
  requiredEnv: ["RAPIDAPI_KEY"],
  isEnabled: (cfg) => cfg.sources.jsearch.enabled,
  async fetch(ctx) {
    const out: RawJob[] = [];
    const queries = rotate(buildQueries(ctx.cfg), ctx.cfg.sources.jsearch.max_queries_per_run, dayNumber());
    for (const q of queries) {
      const query = q.remote ? `${q.what} remote` : `${q.what} in ${q.where}`;
      const params = new URLSearchParams({ query, page: "1", num_pages: "1", country: "us", date_posted: "week" });
      if (q.remote) params.set("work_from_home", "true");
      try {
        const res = await ctx.http(`https://jsearch.p.rapidapi.com/search?${params}`, {
          headers: { "x-rapidapi-key": ctx.env.RAPIDAPI_KEY!, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
        });
        const data = (await res.json()) as { data?: JSearchJob[] };
        for (const j of data.data ?? []) {
          const location = j.job_location ?? [j.job_city, j.job_state].filter(Boolean).join(", ");
          out.push({
            source: "jsearch",
            sourceId: j.job_id,
            title: j.job_title,
            company: j.employer_name ?? "Unknown",
            location: location || (j.job_is_remote ? "Remote" : ""),
            remote: j.job_is_remote || undefined,
            country: j.job_country ?? undefined,
            url: j.job_apply_link,
            description: j.job_description ?? "",
            postedAt: j.job_posted_at_datetime_utc ?? undefined,
          });
        }
      } catch (err) {
        ctx.reportError(`jsearch "${query}"`, err);
      }
    }
    return out;
  },
};
