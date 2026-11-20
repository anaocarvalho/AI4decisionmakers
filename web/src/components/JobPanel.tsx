import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { JOB_STATUSES, type JobStatus } from "../../../supabase/database.types";
import { STATUS_LABELS, relativeDate, type JobListRow } from "../lib/jobs";
import { supabase } from "../supabase";
import { ScoreBadge, SponsorBadge } from "./Badges";
import { DraftsSection } from "./DraftsSection";
import type { JobPatch } from "./JobsPage";

export function JobPanel({ job, session, onClose, onUpdate }: { job: JobListRow; session: Session; onClose: () => void; onUpdate: (p: JobPatch) => void }) {
  const [description, setDescription] = useState<string | null>(null);
  const [notes, setNotes] = useState(job.notes);

  useEffect(() => {
    setNotes(job.notes);
    setDescription(null);
    supabase.from("jobs").select("description").eq("id", job.id).single().then(({ data }) => setDescription(data?.description ?? ""));
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="panel" role="dialog" aria-label={`${job.title} at ${job.company}`}>
      <div className="panel-head">
        <div>
          <h2>{job.title}</h2>
          <p className="muted">{job.company} · {job.location || (job.is_remote ? "Remote" : "")} · seen via {job.sources.join(", ")} · posted {relativeDate(job.posted_at ?? job.first_seen_at)}</p>
        </div>
        <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="panel-body">
        <div className="row wrap">
          <ScoreBadge job={job} />
          <SponsorBadge job={job} />
          {job.min_years_experience !== null && <span className="flag unknown">{job.min_years_experience}+ yrs asked</span>}
        </div>
        {job.fit_rationale && <p className="rationale">{job.fit_rationale}</p>}

        <div className="row wrap">
          <label className="inline"><input type="checkbox" checked={job.interested} onChange={(e) => onUpdate({ interested: e.target.checked })} /> Interested</label>
          <select value={job.status} aria-label="Status" onChange={(e) => onUpdate({ status: e.target.value as JobStatus })}>
            {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          {/* Human in the loop: JobScout never submits anything. This only opens the posting. */}
          <a className="button primary" href={job.url} target="_blank" rel="noopener noreferrer">Open application ↗</a>
          {job.status !== "applied" && (
            <button className="ghost" onClick={() => onUpdate({ status: "applied" })}>I applied</button>
          )}
        </div>

        <DraftsSection job={job} session={session} onDrafted={() => job.status === "new" || job.status === "interested" ? onUpdate({ status: "materials_drafted" }) : undefined} />

        <label className="stack">
          <span className="label">Notes</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== job.notes && onUpdate({ notes })} placeholder="Contacts, deadlines, referral…" />
        </label>

        <details open>
          <summary>Job description</summary>
          <pre className="description">{description ?? "Loading…"}</pre>
        </details>
      </div>
    </aside>
  );
}
