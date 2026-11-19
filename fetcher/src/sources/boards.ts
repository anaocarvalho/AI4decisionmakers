import type { RawJob } from "@jobscout/core";
import type { SourceContext } from "./types.js";

type Board = { company: string; token: string };

/** Fetch every configured board; one failing board is reported and skipped. */
export async function fetchBoards(
  ctx: SourceContext,
  source: string,
  boards: Board[],
  fetchOne: (board: Board) => Promise<RawJob[]>,
): Promise<RawJob[]> {
  const out: RawJob[] = [];
  for (const board of boards) {
    try {
      const jobs = await fetchOne(board);
      ctx.log.info(`  ${source}/${board.token}: ${jobs.length} postings`);
      out.push(...jobs);
    } catch (err) {
      ctx.reportError(`${source}/${board.token}`, err);
    }
  }
  return out;
}

export const encode = encodeURIComponent;
