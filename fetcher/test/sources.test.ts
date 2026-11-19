import { readFileSync } from "node:fs";
import { buildJob, parseConfig, type Config } from "@jobscout/core";
import { describe, expect, it, vi } from "vitest";
import { collect } from "../src/collect.js";
import { silentLogger } from "../src/log.js";
import { ashby } from "../src/sources/ashby.js";
import { greenhouse } from "../src/sources/greenhouse.js";
import { lever } from "../src/sources/lever.js";
import type { HttpGet, SourceContext } from "../src/sources/types.js";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8");
const baseCfg = parseConfig(readFileSync(new URL("../../config.yaml", import.meta.url), "utf8"));

function cfgWith(boards: Partial<Record<"greenhouse" | "lever" | "ashby", { company: string; token: string }[]>>): Config {
  const s = { ...baseCfg.sources };
  for (const [k, b] of Object.entries(boards)) s[k as "greenhouse"] = { enabled: true, boards: b! };
  return { ...baseCfg, sources: s };
}

/** Fake HTTP that serves fixtures by URL substring; anything else → 404. */
function fakeHttp(routes: Record<string, string>): HttpGet & ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) throw new Error(`HTTP 404 for ${url}`);
    return new Response(hit[1], { status: 200 });
  }) as never;
}

const ctx = (cfg: Config, http: HttpGet, errors: string[] = []): SourceContext => ({
  cfg, http, log: silentLogger, env: {}, reportError: (w) => errors.push(w),
});

describe("greenhouse", () => {
  it("maps the public board API, decoding escaped HTML", async () => {
    const cfg = cfgWith({ greenhouse: [{ company: "Charles River Associates", token: "charlesriverassociates" }] });
    const jobs = await greenhouse.fetch(ctx(cfg, fakeHttp({ "boards/charlesriverassociates/jobs?content=true": fixture("greenhouse") })));
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      source: "greenhouse",
      company: "Charles River Associates",
      sourceId: expect.stringMatching(/^charlesriverassociates:\d+$/),
      url: expect.stringContaining("job-boards.greenhouse.io/charlesriverassociates/jobs/"),
      postedAt: expect.stringMatching(/^2026-/),
    });
    expect(jobs[0]!.description).toContain("<p>");
    expect(buildJob(jobs[0]!).description).not.toMatch(/<|&lt;/);
  });
});

describe("lever", () => {
  it("maps postings including country, workplace type and epoch dates", async () => {
    const cfg = cfgWith({ lever: [{ company: "Example", token: "brookings" }] });
    const jobs = await lever.fetch(ctx(cfg, fakeHttp({ "postings/brookings?mode=json": fixture("lever") })));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ source: "lever", country: "US", url: expect.stringContaining("jobs.lever.co/brookings/") });
    expect(jobs[0]!.postedAt).toBe("2019-07-24T20:23:47.097Z");
  });
});

describe("ashby", () => {
  it("maps postings including isRemote", async () => {
    const cfg = cfgWith({ ashby: [{ company: "IDinsight", token: "idinsight" }] });
    const jobs = await ashby.fetch(ctx(cfg, fakeHttp({ "job-board/idinsight": fixture("ashby") })));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ source: "ashby", company: "IDinsight", remote: true, location: "Manila, Philippines" });
  });
});

describe("collect", () => {
  it("skips a failing board but keeps the others in the same source", async () => {
    const cfg = cfgWith({
      greenhouse: [
        { company: "Broken", token: "doesnotexist" },
        { company: "Charles River Associates", token: "charlesriverassociates" },
      ],
      lever: [],
      ashby: [],
    });
    const res = await collect([greenhouse, lever, ashby], {
      cfg, log: silentLogger, http: fakeHttp({ charlesriverassociates: fixture("greenhouse") }),
    });
    expect(res.sourcesRun).toEqual(["greenhouse"]); // lever/ashby have no boards → disabled
    expect(res.perSource.greenhouse).toBe(3);
    expect(res.errors.map((e) => e.where)).toEqual(["greenhouse/doesnotexist"]);
    expect(res.sourcesFailed).toEqual([]);
  });

  it("isolates a source that throws entirely and marks it failed", async () => {
    const cfg = cfgWith({ greenhouse: [{ company: "CRA", token: "charlesriverassociates" }], lever: [], ashby: [] });
    const exploding = { name: "boom", isEnabled: () => true, fetch: async () => { throw new Error("kaboom"); } };
    const res = await collect([exploding, greenhouse], {
      cfg, log: silentLogger, http: fakeHttp({ charlesriverassociates: fixture("greenhouse") }),
    });
    expect(res.sourcesFailed).toEqual(["boom"]);
    expect(res.errors).toEqual([{ where: "boom", message: "kaboom" }]);
    expect(res.raws).toHaveLength(3);
  });

  it("can limit to selected sources", async () => {
    const cfg = cfgWith({ greenhouse: [{ company: "CRA", token: "charlesriverassociates" }], lever: [{ company: "X", token: "brookings" }], ashby: [] });
    const res = await collect([greenhouse, lever], {
      cfg, log: silentLogger, only: ["lever"], http: fakeHttp({ brookings: fixture("lever") }),
    });
    expect(res.sourcesRun).toEqual(["lever"]);
  });
});
