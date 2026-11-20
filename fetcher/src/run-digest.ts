/**
 * Weekly digest → GitHub Issue.   npm run digest  (prints instead of posting when GITHUB_TOKEN is absent)
 */
import { loadConfig } from "@jobscout/core";
import { createClient } from "@supabase/supabase-js";
import { buildDigest, digestTitle, STATUSES, type DigestJob, type Status } from "./digest.js";

const env = process.env;
const cfg = await loadConfig("config.yaml");
if (!cfg.digest.enabled) {
  console.log("Digest disabled in config.yaml");
  process.exit(0);
}
const ownerId = env.JOBSCOUT_OWNER_ID;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !ownerId) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and JOBSCOUT_OWNER_ID must be set");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

const [newRes, topRes, statusRes, appliedRes] = await Promise.all([
  db.from("jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("first_seen_at", weekAgo),
  db.from("jobs").select("title,company,location,is_remote,url,rank_score,sponsorship_status,fit_rationale")
    .eq("owner_id", ownerId).gte("first_seen_at", weekAgo).gte("rank_score", cfg.scoring.highlight_threshold)
    .order("rank_score", { ascending: false }).limit(cfg.digest.top_n),
  db.from("jobs").select("status").eq("owner_id", ownerId),
  db.from("jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "applied").gte("status_updated_at", weekAgo),
]);
for (const r of [newRes, topRes, statusRes, appliedRes]) if (r.error) throw new Error(`Supabase query failed: ${r.error.message}`);

const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
for (const row of (statusRes.data ?? []) as { status: Status }[]) statusCounts[row.status]++;

const input = {
  weekEnding: now,
  newJobsCount: newRes.count ?? 0,
  topJobs: (topRes.data ?? []) as DigestJob[],
  statusCounts,
  appliedThisWeek: appliedRes.count ?? 0,
  siteUrl: env.JOBSCOUT_SITE_URL || undefined,
};
const title = digestTitle(input);
const body = buildDigest(input, cfg);

const repo = env.GITHUB_REPOSITORY;
const token = env.GITHUB_TOKEN;
if (!repo || !token) {
  console.log(`# ${title}\n\n${body}\n\n(GITHUB_TOKEN/GITHUB_REPOSITORY not set: printed instead of posting)`);
  process.exit(0);
}

const gh = (path: string, init: RequestInit = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "jobscout-digest", ...init.headers },
  });

const repoInfo = (await (await gh(`/repos/${repo}`)).json()) as { private?: boolean };
if (repoInfo.private !== true && !cfg.digest.allow_public_repo) {
  console.log(`::warning::Digest not posted: ${repo} is public, so the issue would be public. Make the repo private, or set digest.allow_public_repo: true in config.yaml.`);
  process.exit(0);
}

const res = await gh(`/repos/${repo}/issues`, { method: "POST", body: JSON.stringify({ title, body, labels: ["jobscout-digest"] }) });
if (!res.ok) throw new Error(`GitHub issue creation failed: ${res.status} ${await res.text()}`);
const issue = (await res.json()) as { html_url: string };
console.log(`Posted digest: ${issue.html_url}`);
