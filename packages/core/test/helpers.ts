import { readFileSync } from "node:fs";
import { parseConfig } from "../src/config.js";
import type { RawJob } from "../src/types.js";

export const cfg = parseConfig(readFileSync(new URL("../../../config.yaml", import.meta.url), "utf8"));

export const raw = (o: Partial<RawJob> = {}): RawJob => ({
  source: "greenhouse",
  sourceId: "1",
  title: "Data Analyst",
  company: "Urban Institute",
  location: "Remote - US",
  url: "https://boards.greenhouse.io/urban/jobs/1",
  description: "Analyze data. 0-2 years of experience.",
  postedAt: "2026-11-10",
  ...o,
});
