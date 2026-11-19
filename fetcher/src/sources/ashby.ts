import type { RawJob } from "@jobscout/core";
import { encode, fetchBoards } from "./boards.js";
import type { JobSource } from "./types.js";

// Docs: https://developers.ashbyhq.com/docs/public-job-posting-api (public, no auth)
interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  isListed?: boolean;
}

export const ashby: JobSource = {
  name: "ashby",
  isEnabled: (cfg) => cfg.sources.ashby.enabled && cfg.sources.ashby.boards.length > 0,
  fetch: (ctx) =>
    fetchBoards(ctx, "ashby", ctx.cfg.sources.ashby.boards, async ({ company, token }) => {
      const res = await ctx.http(`https://api.ashbyhq.com/posting-api/job-board/${encode(token)}`);
      const data = (await res.json()) as { jobs?: AshbyJob[] };
      return (data.jobs ?? [])
        .filter((j) => j.isListed !== false)
        .map(
          (j): RawJob => ({
            source: "ashby",
            sourceId: `${token}:${j.id}`,
            title: j.title,
            company,
            location: [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join("; "),
            remote: j.isRemote,
            url: j.jobUrl,
            description: j.descriptionPlain ?? "",
            postedAt: j.publishedAt,
          }),
        );
    }),
};
