/** Minimal logger. In GitHub Actions, errors become ::warning:: annotations (visible on the run page) without failing the job. */
export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

const errText = (err: unknown) => (err instanceof Error ? err.message : err === undefined ? "" : String(err));

export function createLogger(env: NodeJS.ProcessEnv = process.env): Logger {
  const gha = env.GITHUB_ACTIONS === "true";
  return {
    info: (m) => console.log(m),
    warn: (m) => console.warn(gha ? `::warning::${m}` : `WARN ${m}`),
    error: (m, err) => console.error(gha ? `::warning::${m} ${errText(err)}` : `ERROR ${m} ${errText(err)}`),
  };
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
