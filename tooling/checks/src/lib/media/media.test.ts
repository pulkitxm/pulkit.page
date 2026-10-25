import { afterEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { readRepositoryText, repositoryRoot } from "@pulkit/shared/repository";
import sharp from "sharp";
import { optimizeMedia } from "./optimize.ts";
import { validateMedia } from "./validate.ts";
import { probeVideo } from "./video.ts";

const directories: string[] = [];
function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "media-policy-"));
  directories.push(directory);
  return directory;
}
function image(width = 80, height = 40) {
  return sharp({ create: { width, height, channels: 3, background: "#1977bb" } });
}
function ffmpeg(...args: string[]): void {
  execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], {
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("image budgets inspect the actual format, longest edge and byte size", async () => {
  const directory = fixture();
  const file = join(directory, "photo.webp");
  await image().webp().toFile(file);
  expect(await validateMedia(file)).toEqual([]);
  const original = readFileSync(file);
  expect(await optimizeMedia(file)).toBe(file);
  expect(readFileSync(file)).toEqual(original);
  writeFileSync(file, await image().png().toBuffer());
  expect((await validateMedia(file)).join("\n")).toContain("use WebP or AVIF");
  await image(40, 2050).webp().toFile(file);
  expect((await validateMedia(file)).join("\n")).toContain("2048 px");
  await optimizeMedia(file);
  expect(await validateMedia(file)).toEqual([]);
  expect((await sharp(file).metadata()).height).toBe(2048);
  writeFileSync(file, Buffer.concat([original, Buffer.alloc(512 * 1024)]));
  expect((await validateMedia(file)).join("\n")).toContain("512 KiB");
  writeFileSync(file, "invalid");
  expect(await validateMedia(file)).not.toEqual([]);
});

test("PNG conversion preserves pixels, handles sibling collisions, and supports AVIF", async () => {
  const directory = fixture();
  const file = join(directory, "diagram.png");
  const source = await image(40, 20).png().toBuffer();
  writeFileSync(file, source);
  const output = await optimizeMedia(file);
  expect(output).toBe(join(directory, "diagram.webp"));
  expect(await validateMedia(output)).toEqual([]);
  expect(await sharp(output).raw().toBuffer()).toEqual(await sharp(source).raw().toBuffer());
  expect(readFileSync(file)).toEqual(source);
  await expect(optimizeMedia(file)).rejects.toThrow("already exists");
  const avif = await optimizeMedia(file, "avif");
  expect(await validateMedia(avif)).toEqual([]);
  expect(readRepositoryText(avif)).toBeNull();
});

test("animated WebP conversion retains frames, timing and loop count", async () => {
  const directory = fixture();
  const file = join(directory, "animation.gif");
  ffmpeg("-f", "lavfi", "-i", "testsrc=size=32x32:rate=5:duration=0.4", file);
  const before = await sharp(file, { animated: true }).metadata();
  const output = await optimizeMedia(file);
  const after = await sharp(output, { animated: true }).metadata();
  expect(after.pages).toBeGreaterThan(1);
  expect(after.pages).toBe(before.pages);
  expect(after.delay).toEqual(before.delay);
  expect(after.loop).toBe(before.loop);
  expect(await validateMedia(output)).toEqual([]);
  await expect(optimizeMedia(file, "avif")).rejects.toThrow("animation encoding");
  const fast = join(directory, "fast.gif");
  writeFileSync(
    fast,
    await sharp(readFileSync(file), { animated: true })
      .gif({ delay: [10, 20] })
      .toBuffer(),
  );
  const fastBefore = await sharp(readFileSync(fast), { animated: true }).metadata();
  const fastOutput = await optimizeMedia(fast);
  const fastAfter = await sharp(readFileSync(fastOutput), { animated: true }).metadata();
  const browserDuration = (fastBefore.delay ?? []).reduce(
    (sum, delay) => sum + (delay <= 10 ? 100 : delay),
    0,
  );
  expect((fastAfter.delay ?? []).reduce((sum, delay) => sum + delay, 0)).toBe(browserDuration);
}, 30_000);

test("video optimization produces fast-start H.264 with AAC and silent bounded previews", async () => {
  const directory = fixture();
  const file = join(directory, "clip.mp4");
  ffmpeg(
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=${128}x${72}:rate=30:duration=0.4`,
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=0.4",
    "-c:v",
    "mpeg4",
    "-c:a",
    "aac",
    file,
  );
  const failures = (await validateMedia(file)).join("\n");
  expect(failures).toContain("H.264");
  expect(failures).toContain("+faststart");
  await optimizeMedia(file);
  expect(await validateMedia(file)).toEqual([]);
  expect(probeVideo(file).streams.some((entry) => entry.codec_name === "aac")).toBe(true);
  const original = readFileSync(file);
  expect(await optimizeMedia(file)).toBe(file);
  expect(readFileSync(file)).toEqual(original);
  const fullRange = join(directory, "full-range.mp4");
  ffmpeg(
    "-i",
    file,
    "-vf",
    "scale=out_range=pc",
    "-pix_fmt",
    "yuvj420p",
    "-color_range",
    "pc",
    fullRange,
  );
  expect(probeVideo(fullRange).streams[0]?.pix_fmt).toBe("yuvj420p");
  await optimizeMedia(fullRange);
  expect(await validateMedia(fullRange)).toEqual([]);
  const preview = join(directory, "clip-preview.mp4");
  ffmpeg("-i", file, "-c", "copy", preview);
  expect((await validateMedia(preview)).join("\n")).toContain("no audio");
  await optimizeMedia(preview);
  expect(await validateMedia(preview)).toEqual([]);
  expect(probeVideo(preview).streams).toHaveLength(1);
}, 30_000);

test("media CLI fails read-only for force-tracked ignored files and passes after optimization", async () => {
  const directory = fixture();
  execFileSync("git", ["init", "--quiet"], { cwd: directory });
  writeFileSync(join(directory, ".gitignore"), "photo.*\n");
  const file = join(directory, "photo.png");
  await image().png().toFile(file);
  execFileSync("git", ["add", "-f", "photo.png"], { cwd: directory });
  const source = readFileSync(file);
  const check = () =>
    spawnSync(
      process.execPath,
      [join(repositoryRoot, "tooling/checks/src/commands/check-media.ts")],
      {
        cwd: directory,
        encoding: "utf8",
      },
    );
  const failed = check();
  expect(failed.status).toBe(1);
  expect(failed.stderr).toContain("photo.png");
  expect(failed.stderr).toContain("bun run media:optimize");
  expect(readFileSync(file)).toEqual(source);
  await optimizeMedia(file);
  rmSync(file);
  execFileSync("git", ["add", "-f", "photo.webp"], { cwd: directory });
  expect(check().status).toBe(0);
});
