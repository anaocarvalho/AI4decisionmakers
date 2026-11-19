/**
 * Daily fetcher entry point.
 *   npm run fetch -- --dry-run                 # fetch + filter, write out/jobs.json, touch nothing else
 *   npm run fetch -- --dry-run --sources lever # only some sources
 *   npm run fetch                              # save to Supabase (needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JOBSCOUT_OWNER_ID)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadConfig, processJobs } from "@jobscout/core";
import { collect, createHttp } from "./collect.js";
import { createLogger } from "./log.js";
import { saveJobs, SupabaseJobStore } from "./store.js";
import { ALL_SOURCES } from "./sources/index.js";

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      sources: { type: "string" },
      config: { type: "string", default: "config.yaml" },
      out: { type: "string", default: "out/jobs.json" },
    },
  });
  const log = createLogger();
  const startedAt = new Date();
  const cfg = await loadConfig(values.config);
  const only = values.sources?.split(",").map((s) => s.trim()).filter(Boolean);

  const collected = await collect(ALL_SOURCES, { cfg, http: createHttp(), log, env: process.env, only });
  const { jobs, rejected, duplicates } = processJobs(collected.raws, cfg);

  log.info("");
  log.info(`Fetched ${collected.raws.length} postings from ${collected.sourcesRun.join(", ") || "no sources"}`);
  log.info(`  duplicates merged: ${duplicates}`);
  log.info(`  rejected: ${Object.entries(rejected).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  log.info(`  kept: ${jobs.length} (sponsorship-blocked: ${jobs.filter((j) => j.sponsorship.status === "blocked").length})`);
  if (collected.errors.length) log.warn(`${collected.errors.length} source error(s); see above`);

  if (values["dry-run"]) {
    await mkdir(values.out.replace(/\/[^/]+$/, "") || ".", { recursive: true });
    await writeFile(values.out, JSON.stringify({ generatedAt: new Date().toISOString(), ...collected, raws: undefined, jobs }, null, 2));
    log.info(`Dry run: wrote ${values.out}`);
    for (const j of jobs) log.info(`  • ${j.title} — ${j.company} — ${j.location || (j.isRemote ? "Remote" : "?")} [${j.sponsorship.status}]`);
  } else {
    const ownerId = process.env.JOBSCOUT_OWNER_ID;
    if (!ownerId) throw new Error("JOBSCOUT_OWNER_ID must be set (your Supabase user id)");
    const store = SupabaseJobStore.fromEnv(process.env);
    const saved = await saveJobs(store, jobs, ownerId);
    log.info(`Saved to Supabase: ${saved.inserted} new, ${saved.updated} updated`);
    await store.recordRun({
      ownerId,
      startedAt,
      stats: { fetched: collected.raws.length, perSource: collected.perSource, duplicates, rejected, kept: jobs.length, inserted: saved.inserted, updated: saved.updated },
      errors: collected.errors,
    }).catch((err) => log.error("could not record run:", err)); // logging the run must not fail the run
  }

  // Fail the run only when every source that ran failed; partial failures are just logged.
  if (collected.sourcesRun.length > 0 && collected.sourcesFailed.length === collected.sourcesRun.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
