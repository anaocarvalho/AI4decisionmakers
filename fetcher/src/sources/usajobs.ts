import type { RawJob } from "@jobscout/core";
import { buildQueries } from "./queries.js";
import type { JobSource } from "./types.js";

// Docs: https://developer.usajobs.gov/api-reference/get-api-search  (free key: developer.usajobs.gov)
// Federal civil-service jobs almost always require U.S. citizenship, so postings are tagged that way
// (they will show as sponsorship-blocked) unless the posting says otherwise.
interface UsaJobsItem {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    OrganizationName?: string;
    DepartmentName?: string;
    PositionLocationDisplay?: string;
    PositionURI: string;
    ApplyURI?: string[];
    PublicationStartDate?: string;
    QualificationSummary?: string;
    UserArea?: { Details?: { JobSummary?: string; MajorDuties?: string[]; WhoMayApply?: { Name?: string }; TeleworkEligible?: boolean; RemoteIndicator?: boolean } };
  };
}

const CITIZENSHIP_NOTE = "Federal civil-service position: requires U.S. citizenship.";

export const usajobs: JobSource = {
  name: "usajobs",
  requiredEnv: ["USAJOBS_API_KEY", "USAJOBS_EMAIL"],
  isEnabled: (cfg) => cfg.sources.usajobs.enabled,
  async fetch(ctx) {
    const out: RawJob[] = [];
    for (const q of buildQueries(ctx.cfg)) {
      const p = new URLSearchParams({ Keyword: q.what, DatePosted: "14", ResultsPerPage: "100" });
      if (q.remote) p.set("RemoteIndicator", "True");
      else if (q.where) p.set("LocationName", q.where.replace(/,\s*NY$/, ", New York"));
      try {
        const res = await ctx.http(`https://data.usajobs.gov/api/search?${p}`, {
          headers: { "user-agent": ctx.env.USAJOBS_EMAIL!, "authorization-key": ctx.env.USAJOBS_API_KEY! },
        });
        const data = (await res.json()) as { SearchResult?: { SearchResultItems?: UsaJobsItem[] } };
        for (const item of data.SearchResult?.SearchResultItems ?? []) {
          const d = item.MatchedObjectDescriptor;
          const details = d.UserArea?.Details;
          out.push({
            source: "usajobs",
            sourceId: item.MatchedObjectId,
            title: d.PositionTitle,
            company: d.OrganizationName ?? d.DepartmentName ?? "U.S. Federal Government",
            location: d.PositionLocationDisplay ?? "",
            remote: details?.RemoteIndicator || undefined,
            url: d.ApplyURI?.[0] ?? d.PositionURI,
            description: [details?.JobSummary, ...(details?.MajorDuties ?? []), d.QualificationSummary, `Who may apply: ${details?.WhoMayApply?.Name ?? "n/a"}`, CITIZENSHIP_NOTE]
              .filter(Boolean)
              .join("\n\n"),
            postedAt: d.PublicationStartDate,
          });
        }
      } catch (err) {
        ctx.reportError(`usajobs "${q.what}"`, err);
      }
    }
    return out;
  },
};
