import { adjustedScore, type Config, type Fit, type ScoreFn, type SponsorshipInfo } from "@jobscout/core";
import type { Logger } from "./log.js";

export interface UnscoredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  sponsorship_status: SponsorshipInfo["status"];
  sponsorship_reasons: string[];
  everify: boolean;
}

export interface ScoreUpdate {
  fit_score: number;
  rank_score: number;
  fit_rationale: string;
  score_model: string;
  scored_at: string;
}

export interface ScoreStore {
  unscored(ownerId: string, limit: number): Promise<UnscoredJob[]>;
  saveScore(id: string, update: ScoreUpdate): Promise<void>;
}

export interface ScoringResult {
  scored: number;
  failed: number;
  skippedFatal: boolean;
}

/**
 * Score up to `scoring.max_jobs_per_run` unscored jobs, `concurrency` at a time.
 * A failing job is logged and stays unscored (it will be retried next run). A fatal error
 * (bad API key, no credit) stops scoring for this run without failing the fetch.
 */
export async function scoreUnscored(opts: {
  store: ScoreStore;
  score: ScoreFn;
  cfg: Config;
  ownerId: string;
  log: Logger;
  isFatal?: (err: unknown) => boolean;
  concurrency?: number;
  now?: () => Date;
}): Promise<ScoringResult> {
  const { store, score, cfg, ownerId, log, concurrency = 3 } = opts;
  const now = opts.now ?? (() => new Date());
  const jobs = await store.unscored(ownerId, cfg.scoring.max_jobs_per_run);
  const result: ScoringResult = { scored: 0, failed: 0, skippedFatal: false };
  let next = 0;

  const worker = async () => {
    while (next < jobs.length && !result.skippedFatal) {
      const job = jobs[next++]!;
      try {
        const fit: Fit = await score(job);
        const sponsorship = { status: job.sponsorship_status, everify: job.everify, reasons: job.sponsorship_reasons };
        await store.saveScore(job.id, {
          fit_score: fit.fit_score,
          rank_score: adjustedScore(fit.fit_score, sponsorship, cfg),
          fit_rationale: fit.rationale,
          score_model: cfg.scoring.model,
          scored_at: now().toISOString(),
        });
        result.scored++;
      } catch (err) {
        result.failed++;
        if (opts.isFatal?.(err)) {
          result.skippedFatal = true;
          log.error("scoring stopped (fatal API error):", err);
        } else {
          log.error(`could not score "${job.title}" at ${job.company}:`, err);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  log.info(`Scored ${result.scored}/${jobs.length} jobs${result.failed ? ` (${result.failed} failed, will retry next run)` : ""}`);
  return result;
}
