import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { bundleBrowserScripts } from "./bundle.ts";

function runModule(path: string): { value: number; sameMarker: boolean } {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "-e",
        `const entry = await import(${JSON.stringify(pathToFileURL(path).href)}); const loaded = await entry.lazy(); console.log(JSON.stringify({ value: loaded.value, sameMarker: loaded.marker === entry.marker }));`,
      ],
      { encoding: "utf8" },
    ),
  );
}

test("native entry hashes keep lazy backlinks consistent and change when source changes", async () => {
  const root = mkdtempSync(join(tmpdir(), "versioned-browser-bundle-"));
  const entrypoint = join(root, "example.ts");
  const output = join(root, "dist");
  const source = (value: number) =>
    `export let value = ${value}; export const marker = {}; export async function lazy() { return (await import("./lazy.ts")).read(); }`;
  try {
    writeFileSync(entrypoint, source(1));
    writeFileSync(
      join(root, "lazy.ts"),
      'import { value, marker } from "./example.ts"; export function read() { return { value, marker }; }',
    );
    mkdirSync(output);
    const first = await bundleBrowserScripts({
      entrypoints: [entrypoint],
      outdir: output,
      minify: true,
      label: "synthetic browser fixture",
      fingerprint: true,
    });
    const firstName = first.get("example.js");
    expect(firstName).toMatch(/^example-[a-z0-9]+\.js$/);
    for (const file of readdirSync(output)) {
      expect(readFileSync(join(output, file), "utf8")).not.toContain('"./example.js"');
    }
    expect(runModule(join(output, firstName ?? ""))).toEqual({ value: 1, sameMarker: true });
    writeFileSync(entrypoint, source(2));
    const second = await bundleBrowserScripts({
      entrypoints: [entrypoint],
      outdir: output,
      minify: true,
      label: "synthetic browser fixture",
      fingerprint: true,
    });
    expect(second.get("example.js")).not.toBe(firstName);
    expect(runModule(join(output, second.get("example.js") ?? ""))).toEqual({
      value: 2,
      sameMarker: true,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
