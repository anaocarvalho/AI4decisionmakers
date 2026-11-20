import { describe, expect, it } from "vitest";
import { normalizeFit, scoringSystemPrompt, scoringUserPrompt } from "../src/claude/score.js";
import { TAILOR_SYSTEM_PROMPT, tailorUserPrompt } from "../src/claude/tailor.js";

const job = { title: "Research Assistant", company: "Urban Institute", location: "Remote", description: "Stata and R. " + "x".repeat(20_000) };

describe("scoring prompts", () => {
  it("puts the resume in the (cacheable) system prompt and the job in the user turn", () => {
    const sys = scoringSystemPrompt("# Ana\nStata, R, econometrics\n");
    expect(sys).toContain("<resume>\n# Ana\nStata, R, econometrics\n</resume>");
    expect(sys).toMatch(/Ignore visa or sponsorship/);
    const user = scoringUserPrompt(job);
    expect(user).toContain('title="Research Assistant" company="Urban Institute"');
    expect(user.length).toBeLessThan(8_200); // description truncated to bound cost
  });

  it("is deterministic so prompt caching can hit across jobs", () => {
    expect(scoringSystemPrompt("r")).toBe(scoringSystemPrompt("r"));
  });
});

describe("normalizeFit", () => {
  it("clamps and rounds scores", () => {
    expect(normalizeFit({ fit_score: 104.6, rationale: " ok ", entry_level: true })).toEqual({ fit_score: 100, rationale: "ok", entry_level: true });
    expect(normalizeFit({ fit_score: -3, rationale: "", entry_level: true }).fit_score).toBe(0);
  });
  it("caps roles Claude judges not entry-level", () => {
    expect(normalizeFit({ fit_score: 90, rationale: "senior", entry_level: false }).fit_score).toBe(45);
  });
});

describe("tailoring prompt", () => {
  it("forbids invented facts and visa talk, and includes resume + job", () => {
    expect(TAILOR_SYSTEM_PROMPT).toMatch(/Never invent/);
    expect(TAILOR_SYSTEM_PROMPT).toMatch(/Do not mention visa/);
    const p = tailorUserPrompt(job, "# Ana");
    expect(p).toContain("<resume>\n# Ana\n</resume>");
    expect(p).toContain('company="Urban Institute"');
  });
});
