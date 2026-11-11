import { expect, test } from "bun:test";
import { galleryLicenses } from "./gallery-licenses.ts";

test("gallery notices retain applicable license and attribution terms without unused font text", () => {
  const notices = galleryLicenses();
  for (const required of [
    "fuse.js 7.5.0",
    "Apache License",
    "zod 4.6.7",
    "lucide 1.49.0",
    "Feather",
    "# Icons: CC BY 4.0 License",
    "# Code: MIT License",
    "Copyright 2026 Fonticons, Inc.",
    "# Attribution",
    "# Brand Icons",
    "Font-only OFL text omitted because no Font Awesome font files are distributed.",
    "Upstream license file SHA-256:",
  ]) {
    expect(notices).toContain(required);
  }
  expect(notices).not.toContain("# Fonts: SIL OFL 1.1 License");
  expect([...notices].some((character) => character.codePointAt(0) === 8212)).toBe(false);
});
