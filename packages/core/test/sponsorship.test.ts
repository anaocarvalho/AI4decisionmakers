import { describe, expect, it } from "vitest";
import { detectSponsorship } from "../src/sponsorship.js";

describe("detectSponsorship", () => {
  it.each([
    "We are unable to sponsor visas for this position.",
    "This role does not offer visa sponsorship.",
    "Candidates must be authorized to work in the US without current or future sponsorship.",
    "No sponsorship available.",
    "U.S. citizens only.",
    "Applicants must be a U.S. citizen.",
    "US citizenship is required.",
    "Must be able to obtain a Secret clearance.",
    "Active TS/SCI clearance required.",
    "We will not sponsor H-1B visas.",
    "Green card holders only",
  ])("blocks: %s", (text) => {
    expect(detectSponsorship(text).status).toBe("blocked");
  });

  it.each([
    "International students on OPT or STEM OPT are welcome to apply.",
    "CPT internships available.",
    "Visa sponsorship is available for qualified candidates.",
    "We can sponsor H-1B visa transfers.",
  ])("friendly: %s", (text) => {
    expect(detectSponsorship(text).status).toBe("friendly");
  });

  it("is unknown when nothing is said, and ignores lowercase 'opt in'", () => {
    expect(detectSponsorship("Users can opt in to newsletters. Great benefits.").status).toBe("unknown");
  });

  it("detects E-Verify separately", () => {
    const r = detectSponsorship("We participate in E-Verify.");
    expect(r).toMatchObject({ status: "unknown", everify: true });
  });
});
