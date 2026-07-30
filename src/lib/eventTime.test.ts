import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEventOver } from "./eventTime";

describe("isEventOver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not over when event_date is in the future (no end_time)", () => {
    expect(isEventOver({ event_date: "2026-08-01", end_date: null, end_time: null })).toBe(false);
  });

  it("is over when event_date is in the past and no end_date/end_time given (defaults to 23:59:59 of event_date)", () => {
    expect(isEventOver({ event_date: "2026-07-29", end_date: null, end_time: null })).toBe(true);
  });

  it("is NOT over on the event_date itself before 23:59:59 when no end_time given", () => {
    expect(isEventOver({ event_date: "2026-07-30", end_date: null, end_time: null })).toBe(false);
  });

  it("uses end_date over event_date when both are present", () => {
    // event started 7/29 but explicitly ends 8/1 -> not over yet
    expect(isEventOver({ event_date: "2026-07-29", end_date: "2026-08-01", end_time: null })).toBe(false);
  });

  it("uses end_time (minute precision) as the cutoff when provided", () => {
    // now is 12:00:00 on 7/30
    expect(isEventOver({ event_date: "2026-07-30", end_date: null, end_time: "11:59" })).toBe(true);
    expect(isEventOver({ event_date: "2026-07-30", end_date: null, end_time: "13:00" })).toBe(false);
  });

  it("is over exactly one second after the computed cutoff", () => {
    vi.setSystemTime(new Date("2026-07-30T13:00:01"));
    expect(isEventOver({ event_date: "2026-07-30", end_date: null, end_time: "13:00" })).toBe(true);
  });
});
