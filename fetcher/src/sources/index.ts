import { adzuna } from "./adzuna.js";
import { ashby } from "./ashby.js";
import { greenhouse } from "./greenhouse.js";
import { jsearch } from "./jsearch.js";
import { lever } from "./lever.js";
import { usajobs } from "./usajobs.js";
import type { JobSource } from "./types.js";

/** Registry of all sources. Order matters only for logs; dedupe prefers employer boards regardless. */
export const ALL_SOURCES: JobSource[] = [greenhouse, lever, ashby, adzuna, jsearch, usajobs];

export type { JobSource, SourceContext } from "./types.js";
