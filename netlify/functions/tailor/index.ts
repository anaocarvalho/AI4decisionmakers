/**
 * POST /.netlify/functions/tailor   { draftId }   Authorization: Bearer <Supabase access token>
 *
 * Background function: Netlify answers 202 immediately and this keeps running (up to 15 minutes).
 * The Anthropic key stays server-side. Supabase is accessed AS THE SIGNED-IN USER (their JWT), so
 * row-level security still applies; no service-role key is needed or present on Netlify.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Config } from "@netlify/functions";
import { tailorMaterials } from "@jobscout/core";
import type { Database } from "../../../supabase/database.types";
import { runTailorJob, type DraftState } from "./run";

const DEFAULT_MODEL = "claude-opus-5-5"; // keep in sync with config.yaml → tailoring.model; override with TAILOR_MODEL

export default async (req: Request): Promise<void> => {
  const env = (k: string) => process.env[k];
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
  const apiKey = env("ANTHROPIC_API_KEY");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const draftId = await req.json().then((b: { draftId?: unknown }) => (typeof b?.draftId === "string" ? b.draftId : null)).catch(() => null);

  if (!url || !anonKey || !token || !draftId) {
    console.error("tailor: missing config, auth token or draftId");
    return;
  }

  const db = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) {
    console.error("tailor: invalid session", authError?.message);
    return;
  }
  const userId = auth.user.id;
  const model = env("TAILOR_MODEL") ?? DEFAULT_MODEL;

  const outcome = await runTailorJob(draftId, {
    model,
    async getDraft(id) {
      const { data } = await db.from("drafts").select("id,job_id,state").eq("id", id).maybeSingle();
      return data ? { ...data, state: data.state as DraftState } : null;
    },
    async getJob(id) {
      const { data } = await db.from("jobs").select("title,company,location,description,status").eq("id", id).maybeSingle();
      return data;
    },
    async getResume() {
      const { data } = await db.from("profiles").select("resume_md").eq("user_id", userId).maybeSingle();
      return data?.resume_md?.trim() || null;
    },
    async updateDraft(id, patch) {
      const { error } = await db.from("drafts").update(patch).eq("id", id);
      if (error) console.error("tailor: draft update failed", error.message);
    },
    async markJobDrafted(id) {
      await db.from("jobs").update({ status: "materials_drafted" }).eq("id", id);
    },
    async tailor(job, resumeMd) {
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in Netlify environment variables.");
      try {
        return await tailorMaterials({ job, resumeMd, model, apiKey });
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) throw new Error("The Anthropic API key in Netlify is invalid.");
        if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is rate-limiting requests. Try again in a minute.");
        if (err instanceof Anthropic.APIError) throw new Error(`Claude API error ${err.status ?? ""}: ${err.message}`);
        throw err;
      }
    },
  });
  console.log(`tailor: draft ${draftId} → ${outcome}`);
};

export const config: Config = {
  background: true,
  method: "POST",
};
