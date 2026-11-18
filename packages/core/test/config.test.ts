import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("config", () => {
  it("parses the repo's config.yaml", () => {
    const cfg = parseConfig(readFileSync(new URL("../../../config.yaml", import.meta.url), "utf8"));
    expect(cfg.search.max_years_experience).toBe(2);
    expect(cfg.scoring.model).toBe("claude-haiku-5-5");
    expect(cfg.locations.cities[0]?.name).toBe("New York, NY");
  });

  it("rejects an invalid config with a readable message", () => {
    expect(() => parseConfig("search:\n  title_keywords: []\n")).toThrow(/search.title_keywords/);
  });
});
