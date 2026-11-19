/** A posting as returned by a source, normalized to one shape. */
export interface RawJob {
  source: string;             // "greenhouse", "adzuna", ...
  sourceId: string;           // id within that source
  title: string;
  company: string;
  location: string;           // free text as given ("New York, NY", "Remote - US", ...)
  remote?: boolean;           // set when the source says so explicitly
  country?: string;           // ISO-ish country code when the source provides one ("US")
  url: string;                // application / posting URL
  description: string;        // plain text or HTML
  postedAt?: string;          // ISO date
}

export type SponsorshipStatus = "blocked" | "friendly" | "unknown";

export interface SponsorshipInfo {
  status: SponsorshipStatus;
  everify: boolean;
  reasons: string[];          // matched phrases, for display
}

/** A deduped, filtered job ready for scoring/storage. */
export interface Job extends RawJob {
  dedupeKey: string;
  isRemote: boolean;
  sources: string[];          // every source the posting was seen on
  sponsorship: SponsorshipInfo;
  minYearsExperience: number | null;
}

export type RejectReason = "title" | "seniority" | "experience" | "location" | "stale";
