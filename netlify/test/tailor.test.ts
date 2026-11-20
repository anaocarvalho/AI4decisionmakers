import { describe, expect, it, vi } from "vitest";
import { runTailorJob, type TailorDeps } from "../functions/tailor/run.js";

function deps(over: Partial<TailorDeps> = {}) {
  const updates: unknown[] = [];
  const d: TailorDeps = {
    model: "claude-opus-5-5",
    getDraft: async () => ({ id: "d1", job_id: "j1", state: "pending" }),
    getJob: async () => ({ title: "RA", company: "Urban", location: "Remote", description: "Stata", status: "interested" }),
    getResume: async () => "# Ana",
    updateDraft: async (_id, patch) => void updates.push(patch),
    markJobDrafted: vi.fn(async () => {}),
    tailor: vi.fn(async () => ({ resume_bullets_md: " - Did X \n", cover_letter_md: "Dear team" })),
    ...over,
  };
  return { d, updates };
}

describe("runTailorJob", () => {
  it("drafts materials, saves them, and advances the job status", async () => {
    const { d, updates } = deps();
    expect(await runTailorJob("d1", d)).toBe("done");
    expect(updates).toEqual([
      { state: "running", error: null, model: "claude-opus-5-5" },
      { state: "done", resume_bullets_md: "- Did X", cover_letter_md: "Dear team" },
    ]);
    expect(d.markJobDrafted).toHaveBeenCalledWith("j1");
  });

  it("does not move a job that is already Applied back to Materials drafted", async () => {
    const { d } = deps({ getJob: async () => ({ title: "RA", company: "U", location: "", description: "x", status: "applied" }) });
    await runTailorJob("d1", d);
    expect(d.markJobDrafted).not.toHaveBeenCalled();
  });

  it("is idempotent: non-pending drafts are skipped and Claude is not called", async () => {
    const { d } = deps({ getDraft: async () => ({ id: "d1", job_id: "j1", state: "done" }) });
    expect(await runTailorJob("d1", d)).toBe("skipped");
    expect(d.tailor).not.toHaveBeenCalled();
  });

  it("skips drafts it cannot see (another user's, or deleted)", async () => {
    const { d } = deps({ getDraft: async () => null });
    expect(await runTailorJob("d1", d)).toBe("skipped");
  });

  it("writes a readable error when the resume is missing", async () => {
    const { d, updates } = deps({ getResume: async () => null });
    expect(await runTailorJob("d1", d)).toBe("error");
    expect(updates.at(-1)).toEqual({ state: "error", error: "Your resume is empty. Paste it on the Resume tab first." });
    expect(d.tailor).not.toHaveBeenCalled();
  });

  it("records Claude failures on the draft instead of throwing", async () => {
    const { d, updates } = deps({ tailor: async () => { throw new Error("Claude API error 529: overloaded"); } });
    expect(await runTailorJob("d1", d)).toBe("error");
    expect(updates.at(-1)).toMatchObject({ state: "error", error: "Claude API error 529: overloaded" });
  });
});
