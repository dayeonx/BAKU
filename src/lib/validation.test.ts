import { describe, expect, it } from "vitest";
import { isValidUsername, isValidPassword, CREDENTIAL_FORMAT_HINT } from "./validation";

describe("isValidUsername", () => {
  it("accepts alphanumeric mix within 4-20 chars", () => {
    expect(isValidUsername("abcd1234")).toBe(true);
    expect(isValidUsername("a1bc")).toBe(true);
  });

  it("rejects strings shorter than 4 chars", () => {
    expect(isValidUsername("a1c")).toBe(false);
  });

  it("rejects strings longer than 20 chars", () => {
    expect(isValidUsername("a1".repeat(11))).toBe(false); // 22 chars
  });

  it("rejects letters-only or digits-only strings", () => {
    expect(isValidUsername("abcdefgh")).toBe(false);
    expect(isValidUsername("12345678")).toBe(false);
  });

  it("rejects special characters (username disallows symbols)", () => {
    expect(isValidUsername("abc1!@#$")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts alphanumeric mix within 4-20 chars", () => {
    expect(isValidPassword("abcd1234")).toBe(true);
  });

  it("accepts allowed special characters combined with letters+digits", () => {
    expect(isValidPassword("abc123!@#")).toBe(true);
  });

  it("rejects letters-only or digits-only strings", () => {
    expect(isValidPassword("abcdefgh")).toBe(false);
    expect(isValidPassword("12345678")).toBe(false);
  });

  it("rejects strings shorter than 4 or longer than 20 chars", () => {
    expect(isValidPassword("a1c")).toBe(false);
    expect(isValidPassword("a1".repeat(11))).toBe(false);
  });

  it("rejects disallowed special characters", () => {
    expect(isValidPassword("abc123()")).toBe(false);
  });
});

describe("CREDENTIAL_FORMAT_HINT", () => {
  it("is a non-empty guidance string", () => {
    expect(CREDENTIAL_FORMAT_HINT.length).toBeGreaterThan(0);
  });
});
