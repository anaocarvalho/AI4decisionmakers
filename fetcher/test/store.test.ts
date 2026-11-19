import { buildJob } from "@jobscout/core";
import { describe, expect, it } from "vitest";
import { saveJobs, toRow, type JobRow, type JobStore, type RunRecord } from "../src/store.js";

const job = (n: number, extra: Partial<Parameters<typeof buildJob>[0]> = {}) =>
  buildJob({ source: "greenhouse", sourceId: `b:${n}`, title: `Data Analyst ${n}`, company: "Acme", location: "Remote", url: `https://x/${n}`, description: "<p>OPT welcome</p>", postedAt: "2026-11-10", ...extra });

class MemoryStore implements JobStore {
  rows = new Map<string, JobRow>();
  upsertCalls = 0;
  runs: RunRecord[] = [];
  async existingKeys(owner: string, keys: string[]) {
    return new Set(keys.filter((k) => this.rows.has(`${owner}|${k}`)));
  }
  async upsert(rows: JobRow[]) {
    this.upsertCalls++;
    for (const r of rows) this.rows.set(`${r.owner_id}|${r.dedupe_key}`, r);
  }
  async recordRun(run: RunRecord) {
    this.runs.push(run);
  }
}

describe("toRow", () => {
  it("maps a job to the fetcher-owned columns only", () => {
    const row = toRow(job(1), "owner-1", new Date("2026-11-19T00:00:00Z"));
    expect(row).toMatchObject({
      owner_id: "owner-1",
      title: "Data Analyst 1",
      description: "OPT welcome",
      sponsorship_status: "friendly",
      posted_at: "2026-11-10T00:00:00.000Z",
      last_seen_at: "2026-11-19T00:00:00.000Z",
    });
    for (const userField of ["interested", "status", "notes", "fit_score", "first_seen_at"]) expect(row).not.toHaveProperty(userField);
  });

  it("nulls out unparseable dates and caps huge descriptions", () => {
    const row = toRow(job(2, { postedAt: "not a date", description: "x".repeat(50_000) }), "o");
    expect(row.posted_at).toBeNull();
    expect(row.description).toHaveLength(20_000);
  });
});

describe("saveJobs", () => {
  it("batches upserts and reports which jobs are new", async () => {
    const store = new MemoryStore();
    const first = await saveJobs(store, [job(1), job(2), job(3)], "o", new Date(), 2);
    expect(first).toMatchObject({ inserted: 3, updated: 0 });
    expect(store.upsertCalls).toBe(2);

    const second = await saveJobs(store, [job(2), job(3), job(4)], "o");
    expect(second.inserted).toBe(1);
    expect(second.updated).toBe(2);
    expect(second.newKeys).toEqual([job(4).dedupeKey]);
  });
});
