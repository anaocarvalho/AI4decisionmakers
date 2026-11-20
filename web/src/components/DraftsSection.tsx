import type { Session } from "@supabase/supabase-js";
import type { JobListRow } from "../lib/jobs";

/** Placeholder until Milestone 7 adds tailored drafts. */
export function DraftsSection(_props: { job: JobListRow; session: Session; onDrafted: () => void }) {
  return null;
}
