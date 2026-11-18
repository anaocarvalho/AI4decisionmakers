import { describe, expect, it } from "vitest";
import { minYearsExperience } from "../src/experience.js";

describe("minYearsExperience", () => {
  it.each([
    ["0-2 years of experience in data analysis", 0],
    ["1 to 3 years of relevant experience", 1],
    ["3+ years of professional experience", 3],
    ["At least 5 years of experience with SQL", 5],
    ["Minimum of two years experience", 2],
    ["5 or more years of experience", 5],
    ["Bachelor's and 4 years of experience, or Master's and 2 years of experience", 2],
  ])("%s → %s", (text, n) => {
    expect(minYearsExperience(text)).toBe(n);
  });

  it("returns null when no requirement is stated", () => {
    expect(minYearsExperience("Recent graduates encouraged to apply.")).toBeNull();
  });

  it("ignores years not tied to experience and implausible numbers", () => {
    expect(minYearsExperience("A 2 year fellowship. We have served clients for over 50 years.")).toBeNull();
  });
});
