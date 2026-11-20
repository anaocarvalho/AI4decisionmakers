import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline } from "./markdown";

describe("parseInline", () => {
  it("splits bold and italic runs", () => {
    expect(parseInline("Led **panel data** study in *Stata*.")).toEqual([
      { text: "Led " }, { text: "panel data", bold: true }, { text: " study in " }, { text: "Stata", italic: true }, { text: "." },
    ]);
  });
});

describe("parseBlocks", () => {
  it("parses headings, bullets and multi-line paragraphs", () => {
    const md = "# Ana\n\nDear Hiring Team,\nI am writing…\n\n- Built a **DiD** model\n* Cleaned data\n\n## Skills\nStata";
    expect(parseBlocks(md).map((b) => [b.type, b.runs.map((r) => r.text).join("")])).toEqual([
      ["h1", "Ana"],
      ["p", "Dear Hiring Team,I am writing…"],
      ["bullet", "Built a DiD model"],
      ["bullet", "Cleaned data"],
      ["h2", "Skills"],
      ["p", "Stata"],
    ]);
  });
});

describe("line breaks", () => {
  it("keeps single line breaks inside a paragraph (letter sign-offs)", () => {
    const [p] = parseBlocks("Sincerely,\nAna Carvalho");
    expect(p!.runs).toEqual([{ text: "Sincerely," }, { text: "", lineBreak: true }, { text: "Ana Carvalho" }]);
  });
});
