import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Tables } from "../../../supabase/database.types";
import { exportDocx, exportPdf, safeFilename } from "../lib/export";
import type { JobListRow } from "../lib/jobs";
import { supabase } from "../supabase";

type Draft = Tables<"drafts">;
const STALE_AFTER_MS = 6 * 60_000; // a draft "running" longer than this is treated as stuck

export function DraftsSection({ job, session, onDrafted }: { job: JobListRow; session: Session; onDrafted: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bullets, setBullets] = useState("");
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const notified = useRef<string | null>(null);

  const apply = useCallback((d: Draft | null) => {
    setDraft(d);
    if (d?.state === "done") {
      setBullets(d.resume_bullets_md ?? "");
      setLetter(d.cover_letter_md ?? "");
      if (notified.current !== d.id) {
        notified.current = d.id;
        onDrafted();
      }
    }
  }, [onDrafted]);

  // Load the latest draft for this job.
  useEffect(() => {
    setDraft(null);
    setError("");
    notified.current = null;
    supabase.from("drafts").select("*").eq("job_id", job.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data?.state === "done") notified.current = data.id; // already drafted earlier: don't re-trigger status change
        apply(data ?? null);
      });
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a draft is in progress: listen for Realtime updates, and poll every 5 s as a fallback.
  const inProgress = draft?.state === "pending" || draft?.state === "running";
  useEffect(() => {
    if (!draft || !inProgress) return;
    const channel = supabase
      .channel(`draft-${draft.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drafts", filter: `id=eq.${draft.id}` }, (p) => apply(p.new as Draft))
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase.from("drafts").select("*").eq("id", draft.id).maybeSingle();
      if (data && data.state !== draft.state) apply(data);
    }, 5000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [draft?.id, draft?.state, inProgress, apply]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setBusy(true);
    setError("");
    const { data: created, error: insertError } = await supabase
      .from("drafts")
      .insert({ owner_id: session.user.id, job_id: job.id, state: "pending" })
      .select("*")
      .single();
    if (insertError || !created) {
      setError(insertError?.message ?? "Could not create a draft.");
      setBusy(false);
      return;
    }
    apply(created);
    const res = await fetch("/.netlify/functions/tailor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ draftId: created.id }),
    }).catch((e: unknown) => ({ ok: false, status: 0, statusText: String(e) }) as Response);
    if (!res.ok && res.status !== 202) {
      setError(`Couldn't start drafting (${res.status || "network"} ${res.statusText}). Is the site running on Netlify or netlify dev?`);
      await supabase.from("drafts").update({ state: "error", error: "Function call failed" }).eq("id", created.id);
    }
    setBusy(false);
  }

  async function saveEdits() {
    if (!draft) return;
    const { error } = await supabase.from("drafts").update({ resume_bullets_md: bullets, cover_letter_md: letter }).eq("id", draft.id);
    if (error) setError(error.message);
    else setDraft({ ...draft, resume_bullets_md: bullets, cover_letter_md: letter });
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  const stuck = inProgress && draft && Date.now() - new Date(draft.updated_at).getTime() > STALE_AFTER_MS;
  const base = `${job.title} - ${job.company}`;
  const edited = draft?.state === "done" && (bullets !== (draft.resume_bullets_md ?? "") || letter !== (draft.cover_letter_md ?? ""));

  if (!job.interested && !draft) {
    return <p className="muted small">Tick <b>Interested</b> to draft tailored resume bullets and a cover letter with Claude.</p>;
  }

  return (
    <section className="drafts" aria-label="Tailored materials">
      <div className="row wrap">
        <strong>Tailored materials</strong>
        <span className="spacer" />
        <button className="primary" onClick={generate} disabled={busy || (inProgress && !stuck)}>
          {inProgress && !stuck ? "Drafting…" : draft ? "Regenerate" : "Draft resume bullets + cover letter"}
        </button>
      </div>

      {inProgress && !stuck && <p className="muted">Claude is drafting. This usually takes under a minute; you can keep browsing.</p>}
      {stuck && <p className="error">This draft seems stuck. Click Regenerate to try again.</p>}
      {draft?.state === "error" && <p className="error">Drafting failed: {draft.error}</p>}
      {error && <p className="error">{error}</p>}

      {draft?.state === "done" && (
        <>
          <label className="stack">
            <span className="row"><span className="label">Resume bullets</span><span className="spacer" />
              <button className="ghost" onClick={() => copy("bullets", bullets)}>{copied === "bullets" ? "Copied ✓" : "Copy"}</button>
              <button className="ghost" onClick={() => exportDocx({ title: base, filename: safeFilename(`Resume bullets ${base}`), sections: [{ markdown: bullets }] })}>DOCX</button>
              <button className="ghost" onClick={() => exportPdf({ title: base, filename: safeFilename(`Resume bullets ${base}`), sections: [{ markdown: bullets }] })}>PDF</button>
            </span>
            <textarea value={bullets} onChange={(e) => setBullets(e.target.value)} />
          </label>
          <label className="stack">
            <span className="row"><span className="label">Cover letter</span><span className="spacer" />
              <button className="ghost" onClick={() => copy("letter", letter)}>{copied === "letter" ? "Copied ✓" : "Copy"}</button>
              <button className="ghost" onClick={() => exportDocx({ title: base, filename: safeFilename(`Cover letter ${base}`), sections: [{ markdown: letter }] })}>DOCX</button>
              <button className="ghost" onClick={() => exportPdf({ title: base, filename: safeFilename(`Cover letter ${base}`), sections: [{ markdown: letter }] })}>PDF</button>
            </span>
            <textarea value={letter} onChange={(e) => setLetter(e.target.value)} />
          </label>
          <div className="row wrap">
            <button onClick={saveEdits} disabled={!edited}>{edited ? "Save edits" : "Saved"}</button>
            <span className="muted small">Drafted by {draft.model ?? "Claude"}. Review every line before using it; then click <b>Open application ↗</b> and apply yourself.</span>
          </div>
        </>
      )}
    </section>
  );
}
