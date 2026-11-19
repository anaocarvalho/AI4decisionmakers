import { decodeEntities, type RawJob } from "@jobscout/core";
import { encode, fetchBoards } from "./boards.js";
import type { JobSource } from "./types.js";

// Docs: https://developers.greenhouse.io/job-board.html (public, no auth)
interface GhJob {
  id: number | string;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;              // HTML, entity-escaped
  first_published?: string;
  updated_at?: string;
  company_name?: string;
}

export const greenhouse: JobSource = {
  name: "greenhouse",
  isEnabled: (cfg) => cfg.sources.greenhouse.enabled && cfg.sources.greenhouse.boards.length > 0,
  fetch: (ctx) =>
    fetchBoards(ctx, "greenhouse", ctx.cfg.sources.greenhouse.boards, async ({ company, token }) => {
      const res = await ctx.http(`https://boards-api.greenhouse.io/v1/boards/${encode(token)}/jobs?content=true`);
      const data = (await res.json()) as { jobs?: GhJob[] };
      return (data.jobs ?? []).map(
        (j): RawJob => ({
          source: "greenhouse",
          sourceId: `${token}:${j.id}`,
          title: j.title,
          company,
          location: j.location?.name ?? "",
          url: j.absolute_url,
          description: decodeEntities(j.content ?? ""), // → real HTML; core turns it into text
          postedAt: j.first_published ?? j.updated_at,
        }),
      );
    }),
};
