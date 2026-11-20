import type { JobStatus, Tables } from "../../../supabase/database.types";

/** Columns loaded for the table (descriptions are fetched only when a job is opened). */
export type JobListRow = Pick<
  Tables<"jobs">,
  | "id" | "title" | "company" | "location" | "is_remote" | "url" | "source" | "sources" | "posted_at" | "first_seen_at"
  | "fit_score" | "rank_score" | "fit_rationale" | "sponsorship_status" | "sponsorship_reasons" | "everify"
  | "interested" | "status" | "notes" | "min_years_experience"
>;

export const JOB_LIST_COLUMNS =
  "id,title,company,location,is_remote,url,source,sources,posted_at,first_seen_at,fit_score,rank_score,fit_rationale,sponsorship_status,sponsorship_reasons,everify,interested,status,notes,min_years_experience";

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  interested: "Interested",
  materials_drafted: "Materials drafted",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type StatusFilter = "active" | "all" | JobStatus;
export type PlaceFilter = "all" | "remote" | "nyc";

export interface Filters {
  text: string;
  status: StatusFilter;
  minScore: number;
  place: PlaceFilter;
  hideBlocked: boolean;
  onlyInterested: boolean;
  source: string; // "" = any
}

export const DEFAULT_FILTERS: Filters = {
  text: "",
  status: "active",
  minScore: 0,
  place: "all",
  hideBlocked: false,
  onlyInterested: false,
  source: "",
};

const NYC = /\b(new york|nyc|manhattan|brooklyn|queens|bronx)\b/i;

export function filterJobs(jobs: JobListRow[], f: Filters): JobListRow[] {
  const needle = f.text.trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.status === "active" && (j.status === "rejected" || j.status === "offer")) return false;
    if (f.status !== "active" && f.status !== "all" && j.status !== f.status) return false;
    if (f.minScore > 0 && (j.rank_score ?? -1) < f.minScore) return false;
    if (f.place === "remote" && !j.is_remote) return false;
    if (f.place === "nyc" && !NYC.test(j.location)) return false;
    if (f.hideBlocked && j.sponsorship_status === "blocked") return false;
    if (f.onlyInterested && !j.interested) return false;
    if (f.source && !j.sources.includes(f.source) && j.source !== f.source) return false;
    if (needle && !`${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export type SortKey = "rank_score" | "title" | "company" | "location" | "source" | "posted" | "status" | "sponsorship";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

const STATUS_ORDER = Object.keys(STATUS_LABELS) as JobStatus[];
const SPONSOR_ORDER: Record<string, number> = { friendly: 0, unknown: 1, blocked: 2 };

function sortValue(j: JobListRow, key: SortKey): string | number | null {
  switch (key) {
    case "rank_score": return j.rank_score;
    case "posted": return j.posted_at ?? j.first_seen_at;
    case "status": return STATUS_ORDER.indexOf(j.status);
    case "sponsorship": return SPONSOR_ORDER[j.sponsorship_status] ?? 1;
    default: return (j[key] ?? "").toString().toLowerCase();
  }
}

/** Stable sort; nulls (e.g. not yet scored) always go last. */
export function sortJobs(jobs: JobListRow[], s: Sort): JobListRow[] {
  const mul = s.dir === "asc" ? 1 : -1;
  return jobs
    .map((j, i) => ({ j, i, v: sortValue(j, s.key) }))
    .sort((a, b) => {
      if (a.v === null && b.v !== null) return 1;
      if (b.v === null && a.v !== null) return -1;
      if (a.v !== null && b.v !== null && a.v !== b.v) return (a.v < b.v ? -1 : 1) * mul;
      return a.i - b.i;
    })
    .map((x) => x.j);
}

export function pipelineCounts(jobs: Pick<JobListRow, "status">[]): Record<JobStatus, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const j of jobs) counts[j.status]++;
  return counts;
}

export function relativeDate(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
