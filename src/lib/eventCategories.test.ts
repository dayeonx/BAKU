import { describe, expect, it } from "vitest";
import { categoryColor, categoryLabel, categoryMeta, EVENT_CATEGORIES } from "./eventCategories";

describe("categoryMeta / categoryLabel / categoryColor", () => {
  it("resolves the full metadata object for every known category value", () => {
    for (const c of EVENT_CATEGORIES) {
      expect(categoryMeta(c.value)).toEqual(c);
      expect(categoryLabel(c.value)).toBe(c.label);
      expect(categoryColor(c.value)).toBe(c.color);
    }
  });

  it("falls back to the 'free' category (index 1) for an unknown value", () => {
    const fallback = EVENT_CATEGORIES[1];
    expect(categoryMeta("unknown_category")).toEqual(fallback);
    expect(categoryLabel("unknown_category")).toBe(fallback.label);
    expect(categoryColor("unknown_category")).toBe(fallback.color);
  });

  it("keeps category values unique", () => {
    const values = EVENT_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
