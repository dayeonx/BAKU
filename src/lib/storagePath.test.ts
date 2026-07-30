import { describe, expect, it } from "vitest";
import { safeFileName } from "./storagePath";

describe("safeFileName", () => {
  it("keeps plain ASCII filenames unchanged", () => {
    expect(safeFileName("photo.jpg")).toBe("photo.jpg");
  });

  it("strips Korean characters and preserves the extension", () => {
    expect(safeFileName("사진.png")).toBe("file.png");
  });

  it("replaces spaces with underscores", () => {
    expect(safeFileName("my photo file.jpg")).toBe("my_photo_file.jpg");
  });

  it("handles mixed Korean + spaces + English (leaves a leading underscore artifact where Korean text was stripped before whitespace collapse)", () => {
    expect(safeFileName("행사 사진 event photo.jpeg")).toBe("_event_photo.jpeg");
  });

  it("strips disallowed special characters from the base name", () => {
    expect(safeFileName("a!@#$b.png")).toBe("ab.png");
  });

  it("falls back to 'file' when the sanitized base name is empty", () => {
    expect(safeFileName("사진.png")).toBe("file.png");
    expect(safeFileName("....jpg")).toBe("file.jpg"); // dotIndex resolves to last dot; base collapses
  });

  it("handles filenames without an extension", () => {
    expect(safeFileName("README")).toBe("README");
  });

  it("handles filenames with a leading dot (dotfiles) as having no extension", () => {
    // lastIndexOf(".") === 0 is not > 0, so the whole name is treated as the base
    expect(safeFileName(".gitignore")).toBe("gitignore");
  });

  it("sanitizes non-alphanumeric characters out of the extension", () => {
    expect(safeFileName("file.j@p!g")).toBe("file.jpg");
  });

  it("preserves case and digits", () => {
    expect(safeFileName("IMG_20240101.JPG")).toBe("IMG_20240101.JPG");
  });
});
