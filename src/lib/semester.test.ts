import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentSemesterLabel, semesterDateRange, semesterLabel } from "./semester";

describe("semesterLabel", () => {
  it("labels March through August as the 1st semester of that year", () => {
    expect(semesterLabel("2026-03-01")).toBe("2026-1학기");
    expect(semesterLabel("2026-06-15")).toBe("2026-1학기");
    expect(semesterLabel("2026-08-31")).toBe("2026-1학기");
  });

  it("labels September through December as the 2nd semester of that year", () => {
    expect(semesterLabel("2026-09-01")).toBe("2026-2학기");
    expect(semesterLabel("2026-12-31")).toBe("2026-2학기");
  });

  it("labels January and February as the 2nd semester of the PREVIOUS year", () => {
    expect(semesterLabel("2026-01-15")).toBe("2025-2학기");
    expect(semesterLabel("2026-02-28")).toBe("2025-2학기");
  });
});

describe("currentSemesterLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives the label from today's date by default", () => {
    vi.setSystemTime(new Date("2026-07-30T12:00:00Z"));
    expect(currentSemesterLabel()).toBe("2026-1학기");
  });

  it("derives the label from an explicitly passed date", () => {
    expect(currentSemesterLabel(new Date("2026-11-01T00:00:00Z"))).toBe("2026-2학기");
  });
});

describe("semesterDateRange", () => {
  it("returns Mar 1 (inclusive) - Sep 1 (exclusive) for a 1st-semester label", () => {
    expect(semesterDateRange("2026-1학기")).toEqual({ start: "2026-03-01", endExclusive: "2026-09-01" });
  });

  it("returns Sep 1 (inclusive) - next year's Mar 1 (exclusive) for a 2nd-semester label", () => {
    expect(semesterDateRange("2026-2학기")).toEqual({ start: "2026-09-01", endExclusive: "2027-03-01" });
  });

  it("round-trips with semesterLabel for representative dates", () => {
    const label = semesterLabel("2026-05-10");
    const range = semesterDateRange(label);
    expect(range).toEqual({ start: "2026-03-01", endExclusive: "2026-09-01" });
  });
});
