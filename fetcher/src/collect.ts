import { fetchWithRetry, RateLimiter, type Config, type RawJob } from "@jobscout/core";
import type { Logger } from "./log.js";
import type { HttpGet, JobSource, SourceContext } from "./sources/types.js";

export interface SourceError {
  where: string;
  message: string;
}

export interface CollectResult {
  raws: RawJob[];
  perSource: Record<string, number>;
  errors: SourceError[];
  sourcesRun: string[];
  sourcesFailed: string[];  // sources that threw entirely or produced only errors
}

const USER_AGENT = "JobScout/0.1 (personal job tracker; respects public API terms)";

/** Retrying fetch, spaced at least `minIntervalMs` apart per host. */
export function createHttp(minIntervalMs = 300, fetchImpl: typeof fetch = fetch): HttpGet {
  const limiter = new RateLimiter(minIntervalMs);
  return async (url, init = {}) => {
    await limiter.take(new URL(url).host);
    return fetchWithRetry(url, { ...init, headers: { "user-agent": USER_AGENT, accept: "application/json", ...init.headers } }, { fetchImpl });
  };
}

/** Run every enabled source in isolation: a failure is logged and recorded, never fatal. */
export async function collect(
  sources: JobSource[],
  opts: { cfg: Config; http: HttpGet; log: Logger; env?: Record<string, string | undefined>; only?: string[] },
): Promise<CollectResult> {
  const result: CollectResult = { raws: [], perSource: {}, errors: [], sourcesRun: [], sourcesFailed: [] };
  const selected = sources.filter((s) => s.isEnabled(opts.cfg) && (!opts.only?.length || opts.only.includes(s.name)));

  for (const source of selected) {
    result.sourcesRun.push(source.name);
    let errorsHere = 0;
    const ctx: SourceContext = {
      cfg: opts.cfg,
      http: opts.http,
      log: opts.log,
      env: opts.env ?? {},
      reportError: (where, err) => {
        errorsHere++;
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ where, message });
        opts.log.error(`source error at ${where}:`, err);
      },
    };
    opts.log.info(`▶ ${source.name}`);
    try {
      const jobs = await source.fetch(ctx);
      result.raws.push(...jobs);
      result.perSource[source.name] = jobs.length;
      if (jobs.length === 0 && errorsHere > 0) result.sourcesFailed.push(source.name);
    } catch (err) {
      ctx.reportError(source.name, err);
      result.perSource[source.name] = 0;
      result.sourcesFailed.push(source.name);
    }
  }
  return result;
}
