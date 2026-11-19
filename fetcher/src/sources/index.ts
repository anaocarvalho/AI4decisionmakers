import { ashby } from "./ashby.js";
import { greenhouse } from "./greenhouse.js";
import { lever } from "./lever.js";
import type { JobSource } from "./types.js";

/** Registry of all sources. Keyed sources (Adzuna, JSearch, USAJobs) are added in Milestone 5. */
export const ALL_SOURCES: JobSource[] = [greenhouse, lever, ashby];

export type { JobSource, SourceContext } from "./types.js";
