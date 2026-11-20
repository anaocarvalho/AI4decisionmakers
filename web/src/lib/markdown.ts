/** Tiny Markdown subset used by drafts: #/## headings, - or * bullets, paragraphs, **bold** and *italic*. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  lineBreak?: boolean; // a line break inside a paragraph (e.g. "Sincerely,\nAna")
}
export type Block =
  | { type: "h1" | "h2" | "p"; runs: Run[] }
  | { type: "bullet"; runs: Run[] };

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) runs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    runs.push(tok.startsWith("**") ? { text: tok.slice(2, -2), bold: true } : { text: tok.slice(1, -1), italic: true });
    last = m.index! + tok.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", runs: para.flatMap((line, i) => [...(i ? [{ text: "", lineBreak: true }] : []), ...parseInline(line)]) });
    para = [];
  };
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const b = line.match(/^[-*•]\s+(.*)$/);
    if (h) { flush(); blocks.push({ type: h[1]!.length === 1 ? "h1" : "h2", runs: parseInline(h[2]!) }); }
    else if (b) { flush(); blocks.push({ type: "bullet", runs: parseInline(b[1]!) }); }
    else para.push(line);
  }
  flush();
  return blocks;
}
