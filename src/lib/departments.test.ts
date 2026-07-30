import { describe, expect, it } from "vitest";
import { DEPARTMENTS, departmentLabel } from "./departments";

describe("departmentLabel", () => {
  it("returns the Korean label for every known department value", () => {
    for (const d of DEPARTMENTS) {
      expect(departmentLabel(d.value)).toBe(d.label);
    }
  });

  it("falls back to the raw value for an unknown department", () => {
    expect(departmentLabel("nonexistent")).toBe("nonexistent");
  });

  it("returns an empty string fallback for an empty value", () => {
    expect(departmentLabel("")).toBe("");
  });
});
