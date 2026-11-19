import { describe, expect, it } from "vitest";
import { dedupe, dedupeKey } from "../src/dedupe.js";
import { buildJob } from "../src/pipeline.js";
import { raw } from "./helpers.js";

describe("dedupeKey", () => {
  it("ignores company suffixes, punctuation and remote tags in titles", () => {
    expect(dedupeKey({ company: "Mathematica, Inc.", title: "Research Analyst - Remote", location: "Remote" }, true)).toBe(
      dedupeKey({ company: "mathematica", title: "Research Analyst (Remote)", location: "Anywhere in US" }, true),
    );
  });
  it("keeps different cities apart", () => {
    expect(dedupeKey({ company: "A", title: "Analyst", location: "New York, NY" }, false)).not.toBe(
      dedupeKey({ company: "A", title: "Analyst", location: "Chicago, IL" }, false),
    );
  });
});

describe("dedupe", () => {
  it("merges the same job from a board and an aggregator, preferring the employer board", () => {
    const board = buildJob(raw({ source: "greenhouse", description: "short", postedAt: "2026-11-12" }));
    const agg = buildJob(
      raw({ source: "jsearch", sourceId: "x", url: "https://jsearch.example/abc", description: "a much longer description text", postedAt: "2026-11-10" }),
    );
    const out = dedupe([agg, board]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: "greenhouse",
      url: "https://boards.greenhouse.io/urban/jobs/1",
      description: "a much longer description text",
      postedAt: "2026-11-10",
    });
    expect(out[0]!.sources.sort()).toEqual(["greenhouse", "jsearch"]);
  });

  it("merges by canonical URL even when titles differ", () => {
    const a = buildJob(raw({ title: "Data Analyst", url: "https://jobs.lever.co/x/1?utm_source=a" }));
    const b = buildJob(raw({ title: "Data Analyst I", url: "https://jobs.lever.co/x/1/" }));
    expect(dedupe([a, b])).toHaveLength(1);
  });

  it("does not merge jobs that differ only by an identifying query param (gh_jid)", () => {
    const a = buildJob(raw({ title: "Data Analyst", url: "https://careers.upstart.com/jobs?gh_jid=1&utm_source=x" }));
    const b = buildJob(raw({ title: "Policy Analyst", url: "https://careers.upstart.com/jobs?gh_jid=2" }));
    const c = buildJob(raw({ title: "Data Analyst", url: "https://careers.upstart.com/jobs?gh_jid=1" }));
    expect(dedupe([a, b, c])).toHaveLength(2);
  });

  it("keeps distinct jobs", () => {
    const a = buildJob(raw({ title: "Data Analyst" }));
    const b = buildJob(raw({ title: "Policy Analyst", url: "https://boards.greenhouse.io/urban/jobs/2" }));
    expect(dedupe([a, b])).toHaveLength(2);
  });
});
