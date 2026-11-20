import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Login } from "./components/Login";
import { JobsPage } from "./components/JobsPage";
import { ResumePage } from "./components/ResumePage";
import { supabase, supabaseConfigured } from "./supabase";

type Tab = "jobs" | "resume";

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>(() => (location.hash === "#resume" ? "resume" : "jobs"));

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    history.replaceState(null, "", tab === "resume" ? "#resume" : location.pathname);
  }, [tab]);

  if (!supabaseConfigured) {
    return (
      <main className="center-card">
        <h1>JobScout</h1>
        <p>
          The app isn't connected to Supabase yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in
          Netlify (Project configuration → Environment variables), then redeploy.
        </p>
      </main>
    );
  }
  if (session === undefined) return <main className="center-card muted">Loading…</main>;
  if (!session) return <Login />;

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">🔎 JobScout</strong>
        <nav className="tabs" aria-label="Sections">
          <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>Jobs</button>
          <button className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}>Resume</button>
        </nav>
        <span className="spacer" />
        <span className="muted small hide-narrow">{session.user.email}</span>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      {tab === "jobs" ? <JobsPage session={session} /> : <ResumePage session={session} />}
    </div>
  );
}
