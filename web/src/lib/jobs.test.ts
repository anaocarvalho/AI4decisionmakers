import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterJobs, pipelineCounts, relativeDate, sortJobs, type JobListRow } from "./jobs";

const job = (o: Partial<JobListRow>): JobListRow => ({
  id: o.id ?? "1", title: "Data Analyst", company: "Acme", location: "Remote", is_remote: true, url: "https://x",
  source: "greenhouse", sources: ["greenhouse"], posted_at: "2026-11-10T00:00:00Z", first_seen_at: "2026-11-10T00:00:00Z",
  fit_score: 70, rank_score: 70, fit_rationale: null, sponsorship_status: "unknown", sponsorship_reasons: [], everify: false,
  interested: false, status: "new", notes: "", min_years_experience: null, ...o,
});

const jobs = [
  job({ id: "a", rank_score: 90, location: "New York, NY", is_remote: false }),
  job({ id: "b", rank_score: 40, sponsorship_status: "blocked" }),
  job({ id: "c", rank_score: null, status: "rejected" }),
  job({ id: "d", rank_score: 75, interested: true, status: "interested", source: "jsearch", sources: ["jsearch", "adzuna"], title: "Policy Analyst" }),
];
const ids = (xs: JobListRow[]) => xs.map((j) => j.id);

describe("filterJobs", () => {
  it("hides rejected/offer jobs by default ('active')", () => {
    expect(ids(filterJobs(jobs, DEFAULT_FILTERS))).toEqual(["a", "b", "d"]);
  });
  it("filters by score, place, sponsorship, interest, source and text", () => {
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, minScore: 70 }))).toEqual(["a", "d"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, place: "nyc" }))).toEqual(["a"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, place: "remote" }))).toEqual(["b", "d"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, hideBlocked: true }))).toEqual(["a", "d"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, onlyInterested: true }))).toEqual(["d"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, source: "adzuna" }))).toEqual(["d"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, text: "policy" }))).toEqual(["d"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, status: "rejected" }))).toEqual(["c"]);
    expect(ids(filterJobs(jobs, { ...DEFAULT_FILTERS, status: "all" }))).toHaveLength(4);
  });
});

describe("sortJobs", () => {
  it("sorts by score descending with unscored last", () => {
    expect(ids(sortJobs(jobs, { key: "rank_score", dir: "desc" }))).toEqual(["a", "d", "b", "c"]);
    expect(ids(sortJobs(jobs, { key: "rank_score", dir: "asc" }))).toEqual(["b", "d", "a", "c"]);
  });
  it("sorts text columns case-insensitively and is stable", () => {
    expect(ids(sortJobs(jobs, { key: "title", dir: "asc" }))).toEqual(["a", "b", "c", "d"]);
  });
  it("orders sponsorship friendly → unknown → blocked", () => {
    expect(ids(sortJobs(jobs, { key: "sponsorship", dir: "asc" })).at(-1)).toBe("b");
  });
});

describe("helpers", () => {
  it("counts the pipeline", () => {
    expect(pipelineCounts(jobs)).toMatchObject({ new: 2, interested: 1, rejected: 1, applied: 0 });
  });
  it("formats relative dates", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(relativeDate("2026-11-20T01:00:00Z", now)).toBe("today");
    expect(relativeDate("2026-11-19T01:00:00Z", now)).toBe("yesterday");
    expect(relativeDate("2026-11-10T00:00:00Z", now)).toBe("10d ago");
    expect(relativeDate(null, now)).toBe("—");
  });
});
