import type { RawJob } from "@jobscout/core";
import { encode, fetchBoards } from "./boards.js";
import type { JobSource } from "./types.js";

// Docs: https://github.com/lever/postings-api (public, no auth)
interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string };
  workplaceType?: string;        // "remote" | "hybrid" | "onsite" | "unspecified"
  country?: string;
  createdAt?: number;            // epoch ms
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
}

export const lever: JobSource = {
  name: "lever",
  isEnabled: (cfg) => cfg.sources.lever.enabled && cfg.sources.lever.boards.length > 0,
  fetch: (ctx) =>
    fetchBoards(ctx, "lever", ctx.cfg.sources.lever.boards, async ({ company, token }) => {
      const res = await ctx.http(`https://api.lever.co/v0/postings/${encode(token)}?mode=json`);
      const data = (await res.json()) as LeverJob[];
      return data.map((j): RawJob => {
        const locations = j.categories?.allLocations?.length ? j.categories.allLocations : [j.categories?.location ?? ""];
        const lists = (j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
        return {
          source: "lever",
          sourceId: `${token}:${j.id}`,
          title: j.text,
          company,
          location: locations.filter(Boolean).join("; "),
          remote: j.workplaceType === "remote" ? true : undefined,
          country: j.country,
          url: j.hostedUrl,
          description: `<p>${j.descriptionPlain ?? ""}</p>${lists}<p>${j.additionalPlain ?? ""}</p>`,
          postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
        };
      });
    }),
};
