import { startChrome } from "./features/chrome.ts";
import { startCursor } from "./features/cursor.ts";
import { startHero } from "./features/hero.ts";
import { startMagnetic } from "./features/magnetic.ts";
import { startMarquee } from "./features/marquee.ts";
import { startMenu } from "./features/menu.ts";
import { startPreview } from "./features/preview.ts";
import { startReveal } from "./features/reveal.ts";
import { startRoll } from "./features/roll.ts";
import { startScrollEffects } from "./features/scrollfx.ts";
import { startSphere } from "./features/sphere.ts";
import { startTilt } from "./features/tilt.ts";
import { afterLoad, elements, onFirstInteraction, reducedMotion, yieldToMain } from "./lib/env.ts";
import { startScroll } from "./lib/scroll.ts";

async function start(): Promise<void> {
  startScroll();
  startHero();
  startReveal();
  startMenu();
  startChrome();
  await yieldToMain();
  startRoll();
  startCursor();
  startMagnetic();
  startMarquee();
  await yieldToMain();
  startScrollEffects();
  startSphere();
  await yieldToMain();
  startPreview();
  startTilt(
    "[data-prose] ul[data-event-grid] > li > a > span:first-child, [data-prose] [data-gallery] > a",
  );
  if (!reducedMotion() && elements("[data-scene]", HTMLElement).length > 0) {
    afterLoad(() =>
      onFirstInteraction(() => {
        import("./scene/scene.ts").then(({ startScene }) => startScene());
      }),
    );
  }
}

start();
