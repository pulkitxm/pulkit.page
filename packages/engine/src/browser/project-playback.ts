import type { Page } from "playwright";
import { expect } from "./problems.ts";

export async function auditProjectPlayback(page: Page, label: string): Promise<void> {
  const recording = page.locator("video[data-project-recording]");
  expect(label, (await recording.count()) === 1, "Project recording is missing");
  await recording.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("[data-project-recording]");
    return Boolean(video && !video.paused && video.currentTime > 0);
  });
  expect(
    label,
    await recording.evaluate(
      (video: HTMLVideoElement) =>
        video.muted &&
        video.loop &&
        video.playsInline &&
        !video.controls &&
        video.preload === "none",
    ),
    "Project recording must autoplay as a muted inline loop without native controls",
  );
  const playback = page.locator("[data-project-playback]");
  await playback.click();
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused,
  );
  expect(
    label,
    (await playback.getAttribute("aria-label")) === "Play recording",
    "Paused recording has no accessible play control",
  );
  await playback.press("Space");
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused === false,
  );
  await page.waitForLoadState("networkidle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused,
  );
  expect(
    label,
    (await playback.getAttribute("aria-label")) === "Play recording",
    "Reduced motion has no manual playback control",
  );
  await playback.click();
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused === false,
  );
  await playback.click();
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused,
  );
}
