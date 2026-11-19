import type { Config, RawJob } from "@jobscout/core";
import type { Logger } from "../log.js";

export type HttpGet = (url: string, init?: RequestInit) => Promise<Response>;

export interface SourceContext {
  cfg: Config;
  http: HttpGet;                                    // retrying, rate-limited fetch
  log: Logger;
  env: Record<string, string | undefined>;          // API keys (from GitHub Secrets / .env)
  /** Record a partial failure (e.g. one board) without aborting the source. */
  reportError: (where: string, err: unknown) => void;
}

/**
 * A job source. To add one: implement this interface in `sources/<name>.ts`,
 * register it in `sources/index.ts`, and add a `sources.<name>` block to config.yaml.
 */
export interface JobSource {
  name: string;
  isEnabled(cfg: Config): boolean;
  fetch(ctx: SourceContext): Promise<RawJob[]>;
}
