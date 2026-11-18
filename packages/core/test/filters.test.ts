import { describe, expect, it } from "vitest";
import { checkLocation, checkTitle } from "../src/filters.js";
import { cfg } from "./helpers.js";

describe("checkTitle", () => {
  it.each(["Data Analyst", "Research Assistant, Economic Studies", "Economic Analyst I", "Policy Analyst (Remote)", "Junior Fellow", "Data Analytics Intern"])(
    "keeps %s",
    (t) => expect(checkTitle(t, cfg)).toBeNull(),
  );
  it.each(["Senior Data Analyst", "Sr. Economist", "Lead Research Analyst", "Analytics Manager", "Director of Economics", "Research Analyst III"])(
    "drops seniority: %s",
    (t) => expect(checkTitle(t, cfg)).toBe("seniority"),
  );
  it.each(["Software Engineer", "Accountant", "Nurse Practitioner"])("drops off-target: %s", (t) => {
    expect(checkTitle(t, cfg)).not.toBeNull();
  });
  it("can exclude internships", () => {
    const noInterns = { ...cfg, search: { ...cfg.search, include_internships: false } };
    expect(checkTitle("Data Analyst Intern", noInterns)).toBe("title");
  });
});

describe("checkLocation", () => {
  const loc = (location: string, isRemote: boolean) => checkLocation({ location, isRemote }, cfg);
  it.each([
    ["New York, NY", false],
    ["Hybrid - New York City", false],
    ["Brooklyn, NY", false],
    ["Remote", true],
    ["Remote - US", true],
    ["Remote (US or Canada)", true],
    ["Washington, DC; New York, NY", false],
  ])("keeps %s", (l, r) => expect(loc(l, r)).toBeNull());
  it.each([
    ["Washington, DC", false],
    ["Remote - Canada", true],
    ["Remote, United Kingdom", true],
    ["Boston, MA", false],
  ])("drops %s", (l, r) => expect(loc(l, r)).toBe("location"));
});
