import { readFileSync } from "node:fs";
import { buildJob, parseConfig } from "@jobscout/core";
import { describe, expect, it, vi } from "vitest";
import { collect } from "../src/collect.js";
import { silentLogger } from "../src/log.js";
import { adzuna, adzunaUrl } from "../src/sources/adzuna.js";
import { jsearch } from "../src/sources/jsearch.js";
import { buildQueries, rotate } from "../src/sources/queries.js";
import type { HttpGet, SourceContext } from "../src/sources/types.js";
import { usajobs } from "../src/sources/usajobs.js";
import { adzunaResponse, jsearchResponse, usajobsResponse } from "./fixtures/keyed.js";

const cfg = parseConfig(readFileSync(new URL("../../config.yaml", import.meta.url), "utf8"));
const oneQueryCfg = { ...cfg, search: { ...cfg.search, queries: ["data analyst"] } };

const jsonHttp = (body: unknown) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body))) as HttpGet & ReturnType<typeof vi.fn>;
const ctx = (http: HttpGet, env: Record<string, string>, c = oneQueryCfg): SourceContext => ({
  cfg: c, http, log: silentLogger, env, reportError: (w, e) => { throw new Error(`${w}: ${String(e)}`); },
});

describe("query helpers", () => {
  it("builds one NYC and one remote query per configured query", () => {
    expect(buildQueries(oneQueryCfg)).toEqual([
      { what: "data analyst", where: "New York, NY", remote: false },
      { what: "data analyst", remote: true },
    ]);
  });
  it("rotates through queries day by day", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(rotate(xs, 2, 0)).toEqual([1, 2]);
    expect(rotate(xs, 2, 1)).toEqual([3, 4]);
    expect(rotate(xs, 2, 2)).toEqual([5, 1]);
    expect(rotate(xs, 9, 3)).toEqual(xs);
  });
});

describe("adzuna", () => {
  it("builds the documented search URL", () => {
    const u = new URL(adzunaUrl({ what: "data analyst", where: "New York, NY", remote: false }, "id", "key", 50));
    expect(u.pathname).toBe("/v1/api/jobs/us/search/1");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ app_id: "id", app_key: "key", what: "data analyst", where: "New York, NY", results_per_page: "50" });
    expect(new URL(adzunaUrl({ what: "x", remote: true }, "i", "k", 5)).searchParams.get("what")).toBe("x remote");
  });

  it("maps results, stripping highlight tags and marking remote searches", async () => {
    const http = jsonHttp(adzunaResponse);
    const jobs = await adzuna.fetch(ctx(http, { ADZUNA_APP_ID: "i", ADZUNA_APP_KEY: "k" }));
    expect(http).toHaveBeenCalledTimes(2);
    expect(jobs[0]).toMatchObject({ source: "adzuna", title: "Junior Data Analyst", company: "Acme Analytics", location: "New York City, New York" });
    const remote = jobs.find((j) => j.remote && j.title === "Economic Research Assistant")!;
    expect(remote.location).toBe("US (Remote)");
    expect(buildJob(remote).sponsorship.status).toBe("friendly");
  });
});

describe("jsearch", () => {
  it("sends RapidAPI headers, caps queries per run, and maps results", async () => {
    const http = jsonHttp(jsearchResponse);
    const capped = { ...cfg, sources: { ...cfg.sources, jsearch: { enabled: true, max_queries_per_run: 3 } } };
    const jobs = await jsearch.fetch(ctx(http, { RAPIDAPI_KEY: "rk" }, capped));
    expect(http).toHaveBeenCalledTimes(3);
    const init = http.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ "x-rapidapi-key": "rk", "x-rapidapi-host": "jsearch.p.rapidapi.com" });
    expect(jobs[0]).toMatchObject({ title: "Policy Analyst", location: "New York, NY", country: "US", url: "https://careers.example.org/jobs/42" });
    expect(buildJob(jobs[0]!).sponsorship.status).toBe("blocked");
    expect(jobs[1]).toMatchObject({ location: "Remote", remote: true, postedAt: undefined });
  });
});

describe("usajobs", () => {
  it("sends the auth headers and tags federal postings as citizenship-required", async () => {
    const http = jsonHttp(usajobsResponse);
    const jobs = await usajobs.fetch(ctx(http, { USAJOBS_API_KEY: "uk", USAJOBS_EMAIL: "me@example.com" }));
    const [url, init] = http.mock.calls[0]! as [string, RequestInit];
    expect(new URL(url).searchParams.get("LocationName")).toBe("New York, New York");
    expect(init.headers).toMatchObject({ "user-agent": "me@example.com", "authorization-key": "uk" });
    expect(jobs[0]).toMatchObject({ title: "Economist", company: "Bureau of Labor Statistics", location: "New York, New York" });
    expect(buildJob(jobs[0]!).sponsorship.status).toBe("blocked");
  });
});

describe("collect with keyed sources", () => {
  it("skips sources whose keys are missing, without counting them as failures", async () => {
    const res = await collect([adzuna, jsearch], { cfg: oneQueryCfg, http: jsonHttp({}), log: silentLogger, env: {} });
    expect(res.sourcesRun).toEqual([]);
    expect(res.sourcesFailed).toEqual([]);
    expect(res.sourcesSkipped.map((s) => s.name)).toEqual(["adzuna", "jsearch"]);
  });
});
