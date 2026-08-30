import { describe, expect, test } from "bun:test";
import { kindForFile, scanText } from "./check-comments.mjs";

describe("comment classification", () => {
  test("recognizes current and future web sources", () => {
    expect(kindForFile("theme.js")).toBe("babel");
    expect(kindForFile("component.tsx")).toBe("babel");
    expect(kindForFile("post.mdx")).toBe("html");
    expect(kindForFile("workflow.yml")).toBe("yaml");
    expect(kindForFile("script.py")).toBe("hash");
    expect(kindForFile("Package.swift")).toBe("slash");
  });
});

describe("comment detection", () => {
  test("finds JavaScript comments without treating URLs as comments", () => {
    const text = 'const url = "https://pulkit.page";\nconst value = 1; // remove';
    expect(scanText("file.js", text)).toHaveLength(1);
  });

  test("finds HTML and CSS comments", () => {
    expect(scanText("index.html", "<main><!-- remove --></main>")).toHaveLength(1);
    expect(scanText("styles.css", "a { color: red; } /* remove */")).toHaveLength(1);
  });

  test("finds YAML and script comments without rejecting shebangs", () => {
    expect(scanText("ci.yml", "name: CI # remove")).toHaveLength(1);
    expect(scanText("task.sh", "#!/bin/sh\nprintf ok # remove")).toHaveLength(1);
  });

  test("allows functional directives", () => {
    expect(
      scanText("file.ts", "// biome-ignore lint: generated value\nconst value = 1;"),
    ).toHaveLength(0);
    expect(
      scanText("Package.swift", "// swift-tools-version: 6.0\nimport PackageDescription"),
    ).toHaveLength(0);
  });
});
