import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** What Claude returns for one posting. */
export const FitSchema = z.object({
  fit_score: z.number().int().describe("0-100: how well the candidate fits this posting"),
  rationale: z.string().describe("At most 2 short sentences: the main match and the main gap"),
  entry_level: z.boolean().describe("true if a candidate with 0-2 years of experience is realistic for this role"),
});
export type Fit = z.infer<typeof FitSchema>;

export interface ScorableJob {
  title: string;
  company: string;
  location: string;
  description: string;
}

const MAX_DESCRIPTION_CHARS = 8_000; // bounds cost per posting

/** Stable across the whole run, so it can be prompt-cached. The resume goes here, the job goes in the user turn. */
export function scoringSystemPrompt(resumeMd: string): string {
  return [
    "You screen job postings for one candidate and rate fit from 0 to 100.",
    "",
    "Scoring guide:",
    "- 85-100: the role's core duties match the candidate's training and skills; entry level; apply today.",
    "- 70-84: strong match with one or two gaps the candidate could close or frame well.",
    "- 50-69: partial match; adjacent field or several missing requirements.",
    "- below 50: different field, clearly senior, or requires credentials the candidate lacks (e.g. PhD, CPA, active license).",
    "Judge only role fit and seniority. Ignore visa or sponsorship statements; they are handled separately.",
    "Base everything on the resume below. Do not assume skills it does not show.",
    "",
    "<resume>",
    resumeMd.trim(),
    "</resume>",
  ].join("\n");
}

export function scoringUserPrompt(job: ScorableJob): string {
  return [
    `<job title="${job.title}" company="${job.company}" location="${job.location}">`,
    job.description.slice(0, MAX_DESCRIPTION_CHARS),
    "</job>",
  ].join("\n");
}

export function normalizeFit(fit: Fit): Fit {
  const score = Math.max(0, Math.min(100, Math.round(fit.fit_score)));
  return {
    // A posting Claude judges not entry-level can't rank as a top fit.
    fit_score: fit.entry_level ? score : Math.min(score, 45),
    rationale: fit.rationale.trim().slice(0, 400),
    entry_level: fit.entry_level,
  };
}

export type ScoreFn = (job: ScorableJob) => Promise<Fit>;

/**
 * Claude-backed scorer. Low effort on a small model: each posting is a short, bounded judgment.
 * The SDK retries 429/5xx/network errors itself (maxRetries).
 */
export function createClaudeScorer(opts: { resumeMd: string; model: string; apiKey?: string; client?: Anthropic }): ScoreFn {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 4 });
  const system = scoringSystemPrompt(opts.resumeMd);
  return async (job) => {
    const response = await client.messages.parse({
      model: opts.model,
      max_tokens: 2000,
      cache_control: { type: "ephemeral" },
      system,
      messages: [{ role: "user", content: scoringUserPrompt(job) }],
      output_config: { effort: "low", format: zodOutputFormat(FitSchema) },
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to score this posting");
    if (!response.parsed_output) throw new Error(`No structured score returned (stop_reason=${response.stop_reason})`);
    return normalizeFit(response.parsed_output);
  };
}
