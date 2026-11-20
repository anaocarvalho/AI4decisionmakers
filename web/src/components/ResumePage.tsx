import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export function ResumePage({ session }: { session: Session }) {
  const [md, setMd] = useState("");
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("resume_md").eq("user_id", session.user.id).maybeSingle().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        setStatus("error");
        return;
      }
      setMd(data?.resume_md ?? "");
      setSaved(data?.resume_md ?? "");
      setStatus("idle");
    });
  }, [session.user.id]);

  async function save() {
    setStatus("saving");
    const { error } = await supabase.from("profiles").upsert({ user_id: session.user.id, resume_md: md });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setSaved(md);
      setStatus("saved");
    }
  }

  return (
    <main className="page narrow-page">
      <h1>Resume</h1>
      <p className="muted">
        Paste your resume as Markdown (or plain text). Claude uses it to score every job and to draft tailored bullets and cover
        letters. It is stored only in your Supabase database, never in GitHub.
      </p>
      <textarea className="resume" value={md} onChange={(e) => setMd(e.target.value)} disabled={status === "loading"} placeholder={"# Your Name\nEmail · LinkedIn\n\n## Education\n…"} />
      <div className="row">
        <button className="primary" onClick={save} disabled={status === "saving" || md === saved}>{status === "saving" ? "Saving…" : "Save resume"}</button>
        {status === "saved" && md === saved && <span className="muted">Saved. New scores use it from the next fetch.</span>}
        {status === "error" && <span className="error">{error}</span>}
      </div>
    </main>
  );
}
