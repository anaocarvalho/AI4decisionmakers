import type { ScorableJob, Tailored } from "@jobscout/core";

export type DraftState = "pending" | "running" | "done" | "error";

/** Everything the tailoring job touches, injected so it can be tested without Netlify/Supabase/Claude. */
export interface TailorDeps {
  getDraft(draftId: string): Promise<{ id: string; job_id: string; state: DraftState } | null>;
  getJob(jobId: string): Promise<(ScorableJob & { status: string }) | null>;
  getResume(): Promise<string | null>;
  updateDraft(draftId: string, patch: Partial<{ state: DraftState; resume_bullets_md: string; cover_letter_md: string; error: string | null; model: string }>): Promise<void>;
  markJobDrafted(jobId: string): Promise<void>;
  tailor(job: ScorableJob, resumeMd: string): Promise<Tailored>;
  model: string;
}

export type TailorOutcome = "done" | "error" | "skipped";

/**
 * Process one pending draft. Idempotent: a draft that is not `pending` is left alone (protects against
 * double clicks and platform retries). Every failure is written to the draft row so the app can show it.
 */
export async function runTailorJob(draftId: string, deps: TailorDeps): Promise<TailorOutcome> {
  const draft = await deps.getDraft(draftId);
  if (!draft || draft.state !== "pending") return "skipped";
  await deps.updateDraft(draftId, { state: "running", error: null, model: deps.model });
  try {
    const [job, resume] = await Promise.all([deps.getJob(draft.job_id), deps.getResume()]);
    if (!job) throw new Error("Job not found.");
    if (!resume) throw new Error("Your resume is empty. Paste it on the Resume tab first.");
    if (!job.description.trim()) throw new Error("This posting has no description to tailor against.");
    const out = await deps.tailor(job, resume);
    await deps.updateDraft(draftId, { state: "done", resume_bullets_md: out.resume_bullets_md.trim(), cover_letter_md: out.cover_letter_md.trim() });
    if (job.status === "new" || job.status === "interested") await deps.markJobDrafted(draft.job_id);
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.updateDraft(draftId, { state: "error", error: message.slice(0, 500) });
    return "error";
  }
}
