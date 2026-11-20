import type { JobListRow } from "../lib/jobs";

export function ScoreBadge({ job }: { job: Pick<JobListRow, "rank_score" | "fit_score" | "fit_rationale"> }) {
  if (job.rank_score === null) return <span className="score none" title="Not scored yet">—</span>;
  const tier = job.rank_score >= 70 ? "high" : job.rank_score >= 50 ? "mid" : "low";
  const tip = `Fit ${job.fit_score ?? "?"} → ranked ${job.rank_score}${job.fit_rationale ? `\n${job.fit_rationale}` : ""}`;
  return <span className={`score ${tier}`} title={tip}>{job.rank_score}</span>;
}

export function SponsorBadge({ job }: { job: Pick<JobListRow, "sponsorship_status" | "sponsorship_reasons" | "everify"> }) {
  const label = job.sponsorship_status === "blocked" ? "No sponsorship" : job.sponsorship_status === "friendly" ? "OPT-friendly" : "Not stated";
  const tip = [...job.sponsorship_reasons, job.everify ? "E-Verify employer" : ""].filter(Boolean).join(" · ") || "No sponsorship language found";
  return (
    <span className={`flag ${job.sponsorship_status}`} title={tip}>
      {label}
      {job.everify && job.sponsorship_status !== "blocked" ? " · E-Verify" : ""}
    </span>
  );
}
