import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry, HttpError, RateLimiter } from "../src/http.js";

const res = (status: number, headers: Record<string, string> = {}) => new Response(status === 204 ? null : "body", { status, headers });

describe("fetchWithRetry", () => {
  const sleep = vi.fn(async (_ms: number) => {});
  const opts = { sleep, random: () => 1, baseDelayMs: 100 };

  it("retries 5xx then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(502)).mockResolvedValueOnce(res(200));
    const r = await fetchWithRetry("https://x", {}, { ...opts, fetchImpl: f });
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it("honors Retry-After on 429", async () => {
    sleep.mockClear();
    const f = vi.fn().mockResolvedValueOnce(res(429, { "retry-after": "2" })).mockResolvedValueOnce(res(200));
    await fetchWithRetry("https://x", {}, { ...opts, fetchImpl: f });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry 404", async () => {
    const f = vi.fn().mockResolvedValue(res(404));
    await expect(fetchWithRetry("https://x", {}, { ...opts, fetchImpl: f })).rejects.toBeInstanceOf(HttpError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries network errors and gives up after `retries`", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchWithRetry("https://x", {}, { ...opts, retries: 2, fetchImpl: f })).rejects.toThrow("fetch failed");
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("RateLimiter", () => {
  it("spaces calls per key", async () => {
    let t = 0;
    const waits: number[] = [];
    const rl = new RateLimiter(1000, () => t, async (ms) => { waits.push(ms); });
    await rl.take("a");
    await rl.take("a");
    await rl.take("b");
    t = 500;
    await rl.take("a");
    expect(waits).toEqual([1000, 1500]);
  });
});
