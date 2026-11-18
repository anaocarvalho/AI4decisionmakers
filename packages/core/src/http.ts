export class HttpError extends Error {
  constructor(public status: number, public url: string, public body: string) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
  }
}

export interface RetryOptions {
  retries?: number;        // extra attempts after the first (default 3)
  baseDelayMs?: number;    // backoff base (default 500)
  maxDelayMs?: number;     // backoff cap (default 15s)
  timeoutMs?: number;      // per-attempt timeout (default 20s)
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (!Number.isNaN(secs)) return secs * 1000;
  const date = Date.parse(h);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** fetch with timeout + exponential backoff with jitter on network errors, 429 and 5xx. Honors Retry-After. */
export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: RetryOptions = {}): Promise<Response> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 15_000, timeoutMs = 20_000 } = opts;
  const doFetch = opts.fetchImpl ?? fetch;
  const wait = opts.sleep ?? sleep;
  const random = opts.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) * (0.5 + random() / 2);
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (attempt >= retries) throw err;
      await wait(backoff);
      continue;
    }
    if (res.ok) return res;
    if (!RETRYABLE.has(res.status) || attempt >= retries) {
      throw new HttpError(res.status, url, await res.text().catch(() => ""));
    }
    await wait(Math.min(maxDelayMs, retryAfterMs(res) ?? backoff));
  }
}

/** Spaces out calls that share a key (e.g. a host) by at least `minIntervalMs`. */
export class RateLimiter {
  private next = new Map<string, number>();
  constructor(
    private minIntervalMs: number,
    private now: () => number = Date.now,
    private wait: (ms: number) => Promise<void> = sleep,
  ) {}

  async take(key = "default"): Promise<void> {
    const t = this.now();
    const at = Math.max(t, this.next.get(key) ?? 0);
    this.next.set(key, at + this.minIntervalMs);
    if (at > t) await this.wait(at - t);
  }
}
