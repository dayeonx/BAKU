import { describe, expect, it } from "vitest";
import { initialCredentialFor, STUDENT_EMAIL_DOMAIN } from "./temp-password";

describe("initialCredentialFor", () => {
  it("returns the student id unchanged when already trimmed", () => {
    expect(initialCredentialFor("2021123456")).toBe("2021123456");
  });

  it("trims surrounding whitespace", () => {
    expect(initialCredentialFor("  2021123456  ")).toBe("2021123456");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(initialCredentialFor("   ")).toBe("");
  });
});

describe("STUDENT_EMAIL_DOMAIN", () => {
  it("is the expected internal domain constant", () => {
    expect(STUDENT_EMAIL_DOMAIN).toBe("@baku.internal");
  });
});
