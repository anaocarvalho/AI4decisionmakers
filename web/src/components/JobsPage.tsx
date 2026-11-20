import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JOB_STATUSES, type JobStatus, type Tables } from "../../../supabase/database.types";
import {
  DEFAULT_FILTERS, JOB_LIST_COLUMNS, STATUS_LABELS, filterJobs, pipelineCounts, relativeDate, sortJobs,
  type Filters, type JobListRow, type Sort, type SortKey,
} from "../lib/jobs";
import { supabase } from "../supabase";
import { ScoreBadge, SponsorBadge } from "./Badges";
import { JobPanel } from "./JobPanel";

const FILTERS_KEY = "jobscout.filters";
const loadFilters = (): Filters => {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_FILTERS;
  }
};

export type JobPatch = Partial<Pick<JobListRow, "interested" | "status" | "notes">>;

export function JobsPage({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<JobListRow[]>([]);
  const [lastRun, setLastRun] = useState<Tables<"fetch_runs"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [sort, setSort] = useState<Sort>({ key: "rank_score", dir: "desc" });
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [jobsRes, runRes] = await Promise.all([
      supabase.from("jobs").select(JOB_LIST_COLUMNS).order("rank_score", { ascending: false, nullsFirst: false }).limit(2000),
      supabase.from("fetch_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (jobsRes.error) setError(jobsRes.error.message);
    else setJobs(jobsRes.data as JobListRow[]);
    setLastRun(runRes.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      /* private mode: filters just won't persist */
    }
  }, [filters]);

  /** Optimistic update; reverts and shows an error if Supabase rejects it. */
  const updateJob = useCallback(async (id: string, patch: JobPatch) => {
    let before: JobListRow | undefined;
    setJobs((xs) => xs.map((j) => (j.id === id ? ((before = j), { ...j, ...patch, ...(patch.interested && j.status === "new" ? { status: "interested" as JobStatus } : {}) }) : j)));
    const { data, error } = await supabase.from("jobs").update(patch).eq("id", id).select(JOB_LIST_COLUMNS).single();
    if (error) {
      setError(`Could not save: ${error.message}`);
      if (before) setJobs((xs) => xs.map((j) => (j.id === id ? before! : j)));
    } else setJobs((xs) => xs.map((j) => (j.id === id ? (data as JobListRow) : j)));
  }, []);

  const sources = useMemo(() => [...new Set(jobs.flatMap((j) => j.sources))].sort(), [jobs]);
  const counts = useMemo(() => pipelineCounts(jobs), [jobs]);
  const visible = useMemo(() => sortJobs(filterJobs(jobs, filters), sort), [jobs, filters, sort]);
  const openJob = jobs.find((j) => j.id === openId) ?? null;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const header = (key: SortKey, label: string, className = "") => (
    <th className={className} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className="th-btn"
        onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : key === "rank_score" || key === "posted" ? "desc" : s.key === key ? "desc" : "asc" }))}
      >
        {label}
        {sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  return (
    <main className="page">
      <section className="pipeline" aria-label="Pipeline">
        {JOB_STATUSES.map((s) => (
          <button key={s} className={`chip ${filters.status === s ? "active" : ""}`} onClick={() => set("status", filters.status === s ? "active" : s)}>
            {STATUS_LABELS[s]} <b>{counts[s]}</b>
          </button>
        ))}
        <span className="spacer" />
        <span className="muted small">
          {lastRun ? `Last fetch ${relativeDate(lastRun.started_at)}` : "No fetch runs yet"}
          {lastRun && Array.isArray(lastRun.errors) && lastRun.errors.length > 0 ? ` · ${lastRun.errors.length} source warnings` : ""}
        </span>
        <button className="ghost" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </section>

      <section className="filters" aria-label="Filters">
        <input type="search" placeholder="Search title, company, location" value={filters.text} onChange={(e) => set("text", e.target.value)} />
        <select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])} aria-label="Status">
          <option value="active">Active (hide offer/rejected)</option>
          <option value="all">All statuses</option>
          {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filters.place} onChange={(e) => set("place", e.target.value as Filters["place"])} aria-label="Location">
          <option value="all">Remote + NYC</option>
          <option value="remote">Remote only</option>
          <option value="nyc">NYC only</option>
        </select>
        <select value={filters.source} onChange={(e) => set("source", e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="inline">
          Min score
          <input type="number" min={0} max={100} step={5} value={filters.minScore} onChange={(e) => set("minScore", Number(e.target.value) || 0)} />
        </label>
        <label className="inline"><input type="checkbox" checked={filters.hideBlocked} onChange={(e) => set("hideBlocked", e.target.checked)} /> Hide no-sponsorship</label>
        <label className="inline"><input type="checkbox" checked={filters.onlyInterested} onChange={(e) => set("onlyInterested", e.target.checked)} /> Interested only</label>
        <button className="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset</button>
      </section>

      {error && <p className="error" role="alert">{error} <button className="ghost" onClick={() => setError("")}>Dismiss</button></p>}

      <p className="muted small">{visible.length} of {jobs.length} jobs</p>
      <div className="table-wrap">
        <table className="jobs">
          <thead>
            <tr>
              <th className="narrow" title="Interested">★</th>
              {header("rank_score", "Fit", "narrow")}
              {header("title", "Title")}
              {header("company", "Company")}
              {header("location", "Location")}
              {header("source", "Source")}
              {header("posted", "Posted")}
              {header("sponsorship", "Sponsorship")}
              {header("status", "Status")}
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((j) => (
              <tr key={j.id} className={j.id === openId ? "selected" : ""}>
                <td className="narrow">
                  <input type="checkbox" aria-label={`Interested in ${j.title}`} checked={j.interested} onChange={(e) => updateJob(j.id, { interested: e.target.checked })} />
                </td>
                <td className="narrow"><ScoreBadge job={j} /></td>
                <td><button className="link" onClick={() => setOpenId(j.id)}>{j.title}</button></td>
                <td>{j.company}</td>
                <td>{j.location || (j.is_remote ? "Remote" : "—")}{j.is_remote && !/remote/i.test(j.location) ? " · Remote" : ""}</td>
                <td className="muted">{j.sources.join(", ")}</td>
                <td className="muted nowrap" title={j.posted_at ?? j.first_seen_at}>{relativeDate(j.posted_at ?? j.first_seen_at)}</td>
                <td><SponsorBadge job={j} /></td>
                <td>
                  <select value={j.status} aria-label={`Status of ${j.title}`} onChange={(e) => updateJob(j.id, { status: e.target.value as JobStatus })}>
                    {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="nowrap"><a href={j.url} target="_blank" rel="noopener noreferrer">Open ↗</a></td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={10} className="empty">{jobs.length ? "No jobs match these filters." : "No jobs yet. They appear after the first fetch run."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openJob && <JobPanel job={openJob} session={session} onClose={() => setOpenId(null)} onUpdate={(p) => updateJob(openJob.id, p)} />}
    </main>
  );
}
