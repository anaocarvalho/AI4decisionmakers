import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

const board = z.object({ company: z.string().min(1), token: z.string().min(1) });
const boardSource = z.object({ enabled: z.boolean().default(true), boards: z.array(board).default([]) });

export const configSchema = z.object({
  search: z.object({
    title_keywords: z.array(z.string()).min(1),
    title_exclude: z.array(z.string()).default([]),
    include_internships: z.boolean().default(true),
    max_years_experience: z.number().int().min(0).default(2),
    max_age_days: z.number().int().positive().default(45),
    queries: z.array(z.string()).default([]),
  }),
  locations: z.object({
    remote_us: z.boolean().default(true),
    cities: z.array(z.object({ name: z.string(), aliases: z.array(z.string()).default([]) })).default([]),
    non_us_markers: z.array(z.string()).default([]),
  }),
  scoring: z.object({
    model: z.string().default("claude-haiku-5-5"),
    max_jobs_per_run: z.number().int().positive().default(150),
    highlight_threshold: z.number().min(0).max(100).default(70),
    sponsorship_penalty: z.number().min(0).max(100).default(40),
  }),
  tailoring: z.object({ model: z.string().default("claude-opus-5-5") }),
  digest: z
    .object({
      enabled: z.boolean().default(true),
      top_n: z.number().int().positive().default(20),
      allow_public_repo: z.boolean().default(false),
    })
    .default({ enabled: true, top_n: 20, allow_public_repo: false }),
  sources: z.object({
    greenhouse: boardSource.default({ enabled: false, boards: [] }),
    lever: boardSource.default({ enabled: false, boards: [] }),
    ashby: boardSource.default({ enabled: false, boards: [] }),
    adzuna: z.object({ enabled: z.boolean().default(false), results_per_query: z.number().int().positive().default(50) }).default({ enabled: false, results_per_query: 50 }),
    jsearch: z.object({ enabled: z.boolean().default(false), max_queries_per_run: z.number().int().positive().default(8) }).default({ enabled: false, max_queries_per_run: 8 }),
    usajobs: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  }),
});

export type Config = z.infer<typeof configSchema>;

export function parseConfig(yamlText: string): Config {
  const result = configSchema.safeParse(parse(yamlText));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid config.yaml:\n${issues}`);
  }
  return result.data;
}

export async function loadConfig(path = "config.yaml"): Promise<Config> {
  return parseConfig(await readFile(path, "utf8"));
}
