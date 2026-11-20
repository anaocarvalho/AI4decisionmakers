import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@jobscout/core";
import type { ScoreStore, ScoreUpdate, UnscoredJob } from "./scoring.js";

/** Columns the fetcher owns. Your tracking fields (interested, status, notes) are never sent, so upserts can't overwrite them. */
export interface JobRow {
  owner_id: string;
  dedupe_key: string;
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  url: string;
  description: string;
  source: string;
  sources: string[];
  source_id: string;
  posted_at: string | null;
  last_seen_at: string;
  sponsorship_status: Job["sponsorship"]["status"];
  sponsorship_reasons: string[];
  everify: boolean;
  min_years_experience: number | null;
}

const MAX_DESCRIPTION = 20_000; // keep rows (and later Claude prompts) bounded

export function toRow(job: Job, ownerId: string, now: Date = new Date()): JobRow {
  const posted = job.postedAt ? new Date(job.postedAt) : null;
  return {
    owner_id: ownerId,
    dedupe_key: job.dedupeKey,
    title: job.title,
    company: job.company,
    location: job.location,
    is_remote: job.isRemote,
    url: job.url,
    description: job.description.slice(0, MAX_DESCRIPTION),
    source: job.source,
    sources: job.sources,
    source_id: job.sourceId,
    posted_at: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
    last_seen_at: now.toISOString(),
    sponsorship_status: job.sponsorship.status,
    sponsorship_reasons: job.sponsorship.reasons,
    everify: job.sponsorship.everify,
    min_years_experience: job.minYearsExperience,
  };
}

export interface RunRecord {
  ownerId: string;
  startedAt: Date;
  stats: Record<string, unknown>;
  errors: { where: string; message: string }[];
}

/** The storage operations the fetcher needs; Supabase in production, an in-memory fake in tests. */
export interface JobStore {
  existingKeys(ownerId: string, keys: string[]): Promise<Set<string>>;
  upsert(rows: JobRow[]): Promise<void>;
  recordRun(run: RunRecord): Promise<void>;
}

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export interface SaveResult {
  inserted: number;
  updated: number;
  newKeys: string[]; // jobs seen for the first time (to be scored in Milestone 4)
}

export async function saveJobs(store: JobStore, jobs: Job[], ownerId: string, now = new Date(), batchSize = 200): Promise<SaveResult> {
  const rows = jobs.map((j) => toRow(j, ownerId, now));
  const newKeys: string[] = [];
  for (const batch of chunk(rows, batchSize)) {
    const existing = await store.existingKeys(ownerId, batch.map((r) => r.dedupe_key));
    newKeys.push(...batch.filter((r) => !existing.has(r.dedupe_key)).map((r) => r.dedupe_key));
    await store.upsert(batch);
  }
  return { inserted: newKeys.length, updated: rows.length - newKeys.length, newKeys };
}

export class SupabaseJobStore implements JobStore, ScoreStore {
  constructor(private db: SupabaseClient) {}

  static fromEnv(env: Record<string, string | undefined>): SupabaseJobStore {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (GitHub Secrets or .env)");
    return new SupabaseJobStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  }

  async existingKeys(ownerId: string, keys: string[]): Promise<Set<string>> {
    if (!keys.length) return new Set();
    const { data, error } = await this.db.from("jobs").select("dedupe_key").eq("owner_id", ownerId).in("dedupe_key", keys);
    if (error) throw new Error(`Supabase select failed: ${error.message}`);
    return new Set((data ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  }

  async upsert(rows: JobRow[]): Promise<void> {
    const { error } = await this.db.from("jobs").upsert(rows, { onConflict: "owner_id,dedupe_key" });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  /** Newest unscored postings first, so the per-run budget goes to fresh jobs. */
  async unscored(ownerId: string, limit: number): Promise<UnscoredJob[]> {
    const { data, error } = await this.db
      .from("jobs")
      .select("id,title,company,location,description,sponsorship_status,sponsorship_reasons,everify")
      .eq("owner_id", ownerId)
      .is("fit_score", null)
      .order("first_seen_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase select unscored failed: ${error.message}`);
    return (data ?? []) as UnscoredJob[];
  }

  async saveScore(id: string, update: ScoreUpdate): Promise<void> {
    const { error } = await this.db.from("jobs").update(update).eq("id", id);
    if (error) throw new Error(`Supabase score update failed: ${error.message}`);
  }

  /** Resume Markdown from the profiles table (edited in the web app). */
  async resume(ownerId: string): Promise<string | null> {
    const { data, error } = await this.db.from("profiles").select("resume_md").eq("user_id", ownerId).maybeSingle();
    if (error) throw new Error(`Supabase profile read failed: ${error.message}`);
    const md = (data as { resume_md?: string } | null)?.resume_md?.trim();
    return md ? md : null;
  }

  async uploadResume(ownerId: string, resumeMd: string): Promise<void> {
    const { error } = await this.db.from("profiles").upsert({ user_id: ownerId, resume_md: resumeMd });
    if (error) throw new Error(`Supabase profile upsert failed: ${error.message}`);
  }

  async recordRun(run: RunRecord): Promise<void> {
    const { error } = await this.db.from("fetch_runs").insert({
      owner_id: run.ownerId,
      started_at: run.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      stats: run.stats,
      errors: run.errors,
    });
    if (error) throw new Error(`Supabase fetch_runs insert failed: ${error.message}`);
  }
}
