const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML → plain text, collapsing whitespace. Good enough for keyword matching and prompts. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/<[a-z/][^>]*$/i, " "), // dangling, unterminated tag
  )
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

const TRACKING_PARAM = /^(utm_.*|gh_src|src|source|ref|referrer|lever-source.*|lever-origin|trk|trackingid|fbclid|gclid)$/i;

/** Canonical URL for dedupe: drop hash, tracking params and trailing slash; keep identifying params (e.g. gh_jid). */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING_PARAM.test(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const base = `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
    return params ? `${base}?${params}` : base;
  } catch {
    return url.trim().toLowerCase();
  }
}
