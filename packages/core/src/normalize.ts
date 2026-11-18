const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML → plain text, collapsing whitespace. Good enough for keyword matching and prompts. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? (e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : m))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COMPANY_SUFFIXES = /\b(inc|llc|ltd|corp|corporation|co|company|lp|llp|plc|the)\b/g;

export function normCompany(s: string): string {
  return normText(s).replace(COMPANY_SUFFIXES, " ").replace(/\s+/g, " ").trim();
}

export function normTitle(s: string): string {
  return normText(
    s
      .replace(/\([^)]*\)/g, " ")                       // "(Remote)", "(Hybrid - NYC)"
      .replace(/\s[-–|]\s*(remote|hybrid|on-?site).*$/i, " "), // "Data Analyst - Remote"
  );
}

const REMOTE_RE = /\b(remote|anywhere|work from home|wfh|distributed)\b/i;

export function looksRemote(location: string, title = ""): boolean {
  return REMOTE_RE.test(location) || /\bremote\b/i.test(title);
}

/** Location component of the dedupe key: "remote" or the first comma part (city). */
export function normLocationKey(location: string, isRemote: boolean): string {
  if (isRemote) return "remote";
  return normText(location.split(/[,;/]/)[0] ?? "");
}

/** Canonical URL for dedupe: drop query, hash and trailing slash. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
