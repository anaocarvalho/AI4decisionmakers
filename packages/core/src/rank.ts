import type { Config } from "./config.js";
import type { SponsorshipInfo } from "./types.js";

/** Final ranking score: Claude's fit score, pushed down for sponsorship blockers, nudged up for OPT-friendly. */
export function adjustedScore(fit: number, sponsorship: SponsorshipInfo, cfg: Config): number {
  let s = fit;
  if (sponsorship.status === "blocked") s -= cfg.scoring.sponsorship_penalty;
  else if (sponsorship.status === "friendly") s += 5;
  if (sponsorship.everify && sponsorship.status !== "blocked") s += 2; // E-Verify matters for STEM OPT
  return Math.max(0, Math.min(100, Math.round(s)));
}
