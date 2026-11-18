const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const NUM = String.raw`(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)`;
const toNum = (s: string) => (s in WORDS ? WORDS[s]! : Number(s));

// Each pattern captures the MINIMUM years in group 1, and must be followed by "experience" nearby.
const PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b${NUM}\s*(?:-|–|to)\s*${NUM}\+?\s*(?:years?|yrs?)\b(?=[^.\n]{0,60}experience)`, "gi"),
  new RegExp(String.raw`\b(?:at least|minimum(?: of)?|min\.?)\s*${NUM}\+?\s*(?:years?|yrs?)\b(?=[^.\n]{0,60}experience)`, "gi"),
  new RegExp(String.raw`\b${NUM}\s*(?:\+|or more|plus)?\s*(?:years?|yrs?)\b(?=[^.\n]{0,60}experience)`, "gi"),
];

/**
 * Smallest "N years of experience" requirement mentioned, or null if none.
 * We take the minimum so alternatives like "5 years with a BA or 2 with an MA" don't drop a job wrongly.
 */
export function minYearsExperience(text: string): number | null {
  const lower = text.toLowerCase();
  const found: number[] = [];
  for (const re of PATTERNS) {
    for (const m of lower.matchAll(re)) {
      const n = toNum(m[1]!);
      if (n <= 15) found.push(n); // ignore "over 50 years serving our clients"
    }
  }
  return found.length ? Math.min(...found) : null;
}
