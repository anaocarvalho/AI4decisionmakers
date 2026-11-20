import { readFileSync } from "node:fs";
import { parseConfig } from "@jobscout/core";
import { describe, expect, it } from "vitest";
import { buildDigest, digestTitle, type DigestInput } from "../src/digest.js";

const cfg = parseConfig(readFileSync(new URL("../../config.yaml", import.meta.url), "utf8"));
const input: DigestInput = {
  weekEnding: new Date("2026-11-23T12:00:00Z"),
  newJobsCount: 42,
  appliedThisWeek: 3,
  statusCounts: { new: 30, interested: 5, materials_drafted: 2, applied: 4, interview: 1, offer: 0, rejected: 2 },
  topJobs: [
    { title: "Research Assistant | Economics", company: "Urban Institute", location: "", is_remote: true, url: "https://x/1", rank_score: 91, sponsorship_status: "friendly", fit_rationale: "Strong\nStata match" },
    { title: "Policy Analyst", company: "Think Tank", location: "New York, NY", is_remote: false, url: "https://x/2", rank_score: 72, sponsorship_status: "blocked", fit_rationale: null },
  ],
  siteUrl: "https://jobsearchagentana.netlify.app",
};

describe("weekly digest", () => {
  it("has a dated title", () => {
    expect(digestTitle(input)).toBe("JobScout weekly digest: week ending 2026-11-23");
  });

  it("summarizes counts, pipeline and top jobs as a Markdown table", () => {
    const md = buildDigest(input, cfg);
    expect(md).toContain("**42** new jobs this week · **2** scored 70+ · **3** applications this week");
    expect(md).toContain("| New | Interested | Materials drafted | Applied | Interview | Offer | Rejected |");
    expect(md).toContain("| 30 | 5 | 2 | 4 | 1 | 0 | 2 |");
    expect(md).toContain("| 91 | [Research Assistant \\| Economics](https://x/1), Urban Institute | Remote | ✅ OPT-friendly | Strong Stata match |");
    expect(md).toContain("⚠️ no sponsorship");
    expect(md).toContain("https://jobsearchagentana.netlify.app");
  });

  it("says so when there are no high-fit jobs", () => {
    expect(buildDigest({ ...input, topJobs: [] }, cfg)).toContain("_None this week._");
  });
});
