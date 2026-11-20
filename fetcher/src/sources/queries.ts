import type { Config } from "@jobscout/core";

export interface SearchQuery {
  what: string;
  where?: string;   // city, e.g. "New York, NY"
  remote: boolean;
}

/** Each configured query, once per target city and once as remote (if remote_us is on), interleaved. */
export function buildQueries(cfg: Config): SearchQuery[] {
  const out: SearchQuery[] = [];
  for (const what of cfg.search.queries) {
    for (const city of cfg.locations.cities) out.push({ what, where: city.name, remote: false });
    if (cfg.locations.remote_us) out.push({ what, remote: true });
  }
  return out;
}

/** Pick `n` items, rotating the start by day so quota-limited sources cover every query over a week. */
export function rotate<T>(items: T[], n: number, day: number): T[] {
  if (items.length <= n) return items;
  const start = (day * n) % items.length;
  return Array.from({ length: n }, (_, i) => items[(start + i) % items.length]!);
}

export const dayNumber = (d = new Date()) => Math.floor(d.getTime() / 86_400_000);
