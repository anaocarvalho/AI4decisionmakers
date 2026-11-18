import type { SponsorshipInfo } from "./types.js";

// Phrases meaning the employer will NOT hire someone on OPT/CPT/H-1B.
const NEGATIVE: RegExp[] = [
  /\bno (?:visa |immigration |h-?1b )?sponsorship\b/i,
  /\b(?:not|unable to|cannot|can ?not|can't|won't|will not|do not|does not|don't|doesn't) (?:currently )?(?:able to )?(?:provide |offer |consider )?(?:visa |immigration |h-?1b )?sponsor(?:ship)?\b/i,
  /\bwithout (?:the need for |requiring )?(?:current or future |now or in the future )?(?:employer |visa |immigration )?sponsorship\b/i,
  /\bsponsorship (?:is )?(?:not|unavailable)\b/i,
  /\bu\.?s\.? citizens? only\b/i,
  /\bmust be (?:a )?(?:u\.?s\.?|united states) citizen\b/i,
  /\b(?:u\.?s\.?|united states) citizenship (?:is )?required\b/i,
  /\brequires? (?:u\.?s\.?|united states) citizenship\b/i,
  /\b(?:green card|permanent residents?)(?: holders?)? only\b/i,
  /\b(?:security|secret|top secret|ts\/sci|public trust) clearance\b/i,
  /\bclearance (?:is )?required\b/i,
  /\bactive clearance\b/i,
];

// Signals that international students are welcome. Checked case-sensitively for acronyms.
const POSITIVE: RegExp[] = [
  /\b(?:STEM )?OPT\b/,
  /\bCPT\b/,
  /\boptional practical training\b/i,
  /\bcurricular practical training\b/i,
  /\bH-?1B (?:sponsorship|visa|transfer)/i,
  /\b(?:visa )?sponsorship (?:is )?(?:available|provided|offered)\b/i,
  /\b(?:will|can|may|able to) sponsor\b/i,
  /\bopen to (?:international|visa)/i,
];

const EVERIFY = /\be-?verify\b/i;

export function detectSponsorship(text: string): SponsorshipInfo {
  const reasons: string[] = [];
  const collect = (res: RegExp[]) =>
    res.flatMap((re) => {
      const m = text.match(re);
      return m ? [m[0]] : [];
    });

  const negatives = collect(NEGATIVE);
  const positives = collect(POSITIVE);
  const everify = EVERIFY.test(text);

  // Negative wins: "we do not sponsor H-1B" mentions H-1B but is still a block.
  if (negatives.length) {
    reasons.push(...negatives);
    return { status: "blocked", everify, reasons };
  }
  if (positives.length) reasons.push(...positives);
  if (everify) reasons.push("E-Verify");
  return { status: positives.length ? "friendly" : "unknown", everify, reasons };
}
