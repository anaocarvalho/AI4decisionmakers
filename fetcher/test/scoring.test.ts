import { readFileSync } from "node:fs";
import { parseConfig } from "@jobscout/core";
import { describe, expect, it } from "vitest";
import { silentLogger } from "../src/log.js";
import { scoreUnscored, type ScoreStore, type ScoreUpdate, type UnscoredJob } from "../src/scoring.js";

const cfg = parseConfig(readFileSync(new URL("../../config.yaml", import.meta.url), "utf8"));

const job = (id: string, status: UnscoredJob["sponsorship_status"] = "unknown"): UnscoredJob => ({
  id, title: `Job ${id}`, company: "Acme", location: "Remote", description: "d",
  sponsorship_status: status, sponsorship_reasons: [], everify: false,
});

class FakeStore implements ScoreStore {
  saved = new Map<string, ScoreUpdate>();
  requestedLimit = 0;
  constructor(private jobs: UnscoredJob[]) {}
  async unscored(_owner: string, limit: number) {
    this.requestedLimit = limit;
    return this.jobs.slice(0, limit);
  }
  async saveScore(id: string, u: ScoreUpdate) {
    this.saved.set(id, u);
  }
}

describe("scoreUnscored", () => {
  it("scores jobs, applies the sponsorship penalty to rank_score, and respects the budget cap", async () => {
    const store = new FakeStore([job("a"), job("b", "blocked"), job("c", "friendly")]);
    const res = await scoreUnscored({
      store, cfg: { ...cfg, scoring: { ...cfg.scoring, max_jobs_per_run: 3 } }, ownerId: "o", log: silentLogger,
      score: async () => ({ fit_score: 80, rationale: "good", entry_level: true }),
      now: () => new Date("2026-11-20T00:00:00Z"),
    });
    expect(res).toEqual({ scored: 3, failed: 0, skippedFatal: false });
    expect(store.requestedLimit).toBe(3);
    expect(store.saved.get("a")).toMatchObject({ fit_score: 80, rank_score: 80, score_model: cfg.scoring.model, scored_at: "2026-11-20T00:00:00.000Z" });
    expect(store.saved.get("b")!.rank_score).toBe(40);
    expect(store.saved.get("c")!.rank_score).toBe(85);
  });

  it("isolates per-job failures", async () => {
    const store = new FakeStore([job("a"), job("b"), job("c")]);
    const res = await scoreUnscored({
      store, cfg, ownerId: "o", log: silentLogger, concurrency: 1,
      score: async (j) => {
        if (j.title === "Job b") throw new Error("timeout");
        return { fit_score: 60, rationale: "", entry_level: true };
      },
    });
    expect(res).toEqual({ scored: 2, failed: 1, skippedFatal: false });
    expect([...store.saved.keys()].sort()).toEqual(["a", "c"]);
  });

  it("stops early on a fatal error (e.g. invalid API key) without throwing", async () => {
    const store = new FakeStore([job("a"), job("b"), job("c"), job("d")]);
    let calls = 0;
    const res = await scoreUnscored({
      store, cfg, ownerId: "o", log: silentLogger, concurrency: 1,
      score: async () => { calls++; throw new Error("401 invalid x-api-key"); },
      isFatal: () => true,
    });
    expect(res.skippedFatal).toBe(true);
    expect(calls).toBe(1);
    expect(store.saved.size).toBe(0);
  });
});
