import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ScorableJob } from "./score.js";

export const TailoredSchema = z.object({
  resume_bullets_md: z.string().describe("Markdown: 5-8 tailored resume bullets, each starting with '- '"),
  cover_letter_md: z.string().describe("Markdown: the cover letter body, 250-350 words, greeting through sign-off"),
});
export type Tailored = z.infer<typeof TailoredSchema>;

const MAX_DESCRIPTION_CHARS = 15_000;

export const TAILOR_SYSTEM_PROMPT = [
  "You help one job seeker prepare application materials. They will review and edit everything before applying themselves.",
  "",
  "Write two things for the posting:",
  "1. Resume bullets: rewrite and reorder the candidate's existing experience and projects so the most relevant evidence comes first and uses the posting's vocabulary where it is truthful. Start each bullet with a strong verb and keep numbers that appear in the resume.",
  "2. A cover letter: specific to this employer and role, 250-350 words, plain professional tone, no clichés. Connect two or three concrete resume items to the role's main duties.",
  "",
  "Rules:",
  "- Use only facts from the resume. Never invent employers, degrees, tools, metrics or dates. If the posting asks for something the resume lacks, don't claim it; lean on adjacent strengths instead.",
  "- Do not mention visa, OPT, CPT or immigration status.",
  "- If the candidate's name or contact details are in the resume, use them for the sign-off; otherwise sign off with [Your Name].",
  "- Markdown only, no preamble.",
].join("\n");

export function tailorUserPrompt(job: ScorableJob, resumeMd: string): string {
  return [
    "<resume>",
    resumeMd.trim(),
    "</resume>",
    "",
    `<job title="${job.title}" company="${job.company}" location="${job.location}">`,
    job.description.slice(0, MAX_DESCRIPTION_CHARS),
    "</job>",
  ].join("\n");
}

export class TailorRefusedError extends Error {}

/**
 * One tailoring request. Runs inside a Netlify Background Function (15-minute limit), so a single
 * non-streaming call with a generous max_tokens is fine. Server-side refusal fallbacks are on.
 */
export async function tailorMaterials(opts: {
  job: ScorableJob;
  resumeMd: string;
  model: string;
  apiKey?: string;
  client?: Anthropic;
}): Promise<Tailored> {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 3 });
  const response = await client.beta.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: TAILOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: tailorUserPrompt(opts.job, opts.resumeMd) }],
    output_config: { effort: "medium", format: betaZodOutputFormat(TailoredSchema) },
  });
  if (response.stop_reason === "refusal") throw new TailorRefusedError("Claude declined to draft materials for this posting");
  if (!response.parsed_output) throw new Error(`No structured draft returned (stop_reason=${response.stop_reason})`);
  return response.parsed_output;
}
