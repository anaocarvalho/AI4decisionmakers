import { describe, expect, it } from "vitest";
import { buildJob, processJobs } from "../src/pipeline.js";
import { adjustedScore } from "../src/rank.js";
import { cfg, raw } from "./helpers.js";

describe("buildJob", () => {
  it("strips HTML and detects remote, sponsorship and experience", () => {
    const j = buildJob(raw({ location: "Anywhere", remote: undefined, description: "<p>Need 1-2 years of experience.</p><p>OPT candidates welcome &amp; encouraged.</p>" }));
    expect(j.description).toBe("Need 1-2 years of experience.\nOPT candidates welcome & encouraged.");
    expect(j.isRemote).toBe(true);
    expect(j.sponsorship.status).toBe("friendly");
    expect(j.minYearsExperience).toBe(1);
  });
});

describe("processJobs", () => {
  it("dedupes, filters, counts rejections and keeps sponsorship-blocked jobs flagged", () => {
    const res = processJobs(
      [
        raw({ sourceId: "1" }),
        raw({ sourceId: "1b", source: "adzuna", url: "https://adzuna.example/1" }), // duplicate
        raw({ sourceId: "2", title: "Senior Economist", url: "https://x/2" }),
        raw({ sourceId: "3", title: "Research Assistant", location: "Denver, CO", url: "https://x/3" }),
        raw({ sourceId: "4", title: "Economic Analyst", description: "5+ years of experience required.", url: "https://x/4" }),
        raw({ sourceId: "5", title: "Policy Analyst", location: "New York, NY", description: "US citizens only.", url: "https://x/5" }),
        raw({ sourceId: "6", title: "Accountant", url: "https://x/6" }),
        raw({ sourceId: "7", title: "Research Analyst", postedAt: "2019-07-24", url: "https://x/7" }),
      ],
      cfg,
      new Date("2026-11-15"),
    );
    expect(res.duplicates).toBe(1);
    expect(res.rejected).toEqual({ title: 1, seniority: 1, experience: 1, location: 1, stale: 1 });
    expect(res.jobs.map((j) => j.title)).toEqual(["Data Analyst", "Policy Analyst"]);
    expect(res.jobs[1]!.sponsorship.status).toBe("blocked");
  });
});

describe("adjustedScore", () => {
  const s = (status: "blocked" | "friendly" | "unknown", everify = false) => ({ status, everify, reasons: [] });
  it("pushes blocked jobs down and nudges friendly ones up, clamped 0..100", () => {
    expect(adjustedScore(80, s("blocked"), cfg)).toBe(40);
    expect(adjustedScore(80, s("unknown"), cfg)).toBe(80);
    expect(adjustedScore(80, s("friendly", true), cfg)).toBe(87);
    expect(adjustedScore(98, s("friendly"), cfg)).toBe(100);
    expect(adjustedScore(10, s("blocked"), cfg)).toBe(0);
  });
});
