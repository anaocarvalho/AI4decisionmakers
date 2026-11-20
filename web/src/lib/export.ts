import DOMPurify from "dompurify";
import { marked } from "marked";
import { parseBlocks, type Block } from "./markdown";

export interface ExportDoc {
  title: string;              // e.g. "Cover letter — Research Assistant, Urban Institute"
  filename: string;           // without extension
  sections: { heading?: string; markdown: string }[];
}

/** Markdown → sanitized HTML (drafts come from an LLM, so never inject unsanitized). */
export function markdownToSafeHtml(md: string): string {
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Opens a clean, print-ready page and the browser's print dialog ("Save as PDF"). */
export function exportPdf(doc: ExportDoc): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups for this site to export a PDF.");
    return;
  }
  const body = doc.sections
    .map((s) => `${s.heading ? `<h2>${escapeHtml(s.heading)}</h2>` : ""}${markdownToSafeHtml(s.markdown)}`)
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.filename)}</title>
<style>
  @page { margin: 0.9in; }
  body { font: 11pt/1.45 Georgia, "Times New Roman", serif; color: #111; max-width: 6.8in; margin: 0 auto; }
  h1 { font-size: 16pt; margin: 0 0 8pt; } h2 { font-size: 12.5pt; margin: 14pt 0 6pt; }
  ul { padding-left: 18pt; } li { margin-bottom: 4pt; } p { margin: 0 0 9pt; }
</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

/** Builds a .docx in the browser and downloads it. The docx library is loaded only when needed. */
export async function exportDocx(doc: ExportDoc): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const toParagraph = (b: Block) => {
    const children = b.runs.map((r) => (r.lineBreak ? new TextRun({ break: 1 }) : new TextRun({ text: r.text, bold: r.bold, italics: r.italic })));
    if (b.type === "h1") return new Paragraph({ heading: HeadingLevel.HEADING_1, children });
    if (b.type === "h2") return new Paragraph({ heading: HeadingLevel.HEADING_2, children });
    if (b.type === "bullet") return new Paragraph({ bullet: { level: 0 }, children });
    return new Paragraph({ children, spacing: { after: 160 } });
  };
  const children = doc.sections.flatMap((s) => [
    ...(s.heading ? [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.heading)] })] : []),
    ...parseBlocks(s.markdown).map(toParagraph),
  ]);
  const file = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(file);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.filename}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export const safeFilename = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "draft";
