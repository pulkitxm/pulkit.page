import { clamp, elements, reducedMotion } from "../lib/env.ts";
import { track } from "../lib/measure.ts";
import { onVisible } from "../lib/observe.ts";
import { onScroll } from "../lib/scroll.ts";
import { splitText, splitWordsDeep } from "../lib/split.ts";
import { onTick } from "../lib/ticker.ts";

function intro(): void {
  const [paragraph] = elements("[data-section='intro'] > p:first-child", HTMLElement);
  if (!paragraph) {
    return;
  }
  const words = splitWordsDeep(paragraph);
  const position = track(paragraph);
  onScroll(({ y }) => {
    const progress = position.progress(y, 0.85, 0.55);
    const lit = progress * (words.length + 6) - 3;
    words.forEach((word, index) => {
      word.style.setProperty("--word", clamp(0.14 + (lit - index) * 0.3, 0.14, 1).toFixed(3));
    });
  });
}

function counters(): void {
  for (const value of elements("[data-section='numbers'] dd", HTMLElement)) {
    const match = /^([\d.]+)(.*)$/.exec(value.textContent ?? "");
    if (!match) {
      continue;
    }
    const target = Number(match[1]);
    const suffix = match[2] ?? "";
    const decimals = (match[1] ?? "").includes(".") ? 1 : 0;
    value.setAttribute("aria-label", value.textContent ?? "");
    value.textContent = `0${suffix}`;
    let started = false;
    onVisible(value, (visible) => {
      if (!visible || started) {
        return;
      }
      started = true;
      const begin = performance.now();
      const stop = onTick((time) => {
        const amount = clamp((time - begin) / 1800, 0, 1);
        const eased = 1 - (1 - amount) ** 4;
        value.textContent = `${(target * eased).toFixed(decimals)}${suffix}`;
        if (amount === 1) {
          stop();
        }
      });
    });
  }
}

function pin(content: HTMLElement, length: number): HTMLElement {
  const outer = document.createElement("div");
  outer.dataset.pin = "";
  outer.style.position = "relative";
  outer.style.height = `${length * 100}vh`;
  const sticky = document.createElement("div");
  sticky.style.position = "sticky";
  sticky.style.top = "0";
  sticky.style.height = "100vh";
  sticky.style.display = "flex";
  sticky.style.flexDirection = "column";
  sticky.style.justifyContent = "center";
  sticky.style.overflow = "clip";
  content.replaceWith(outer);
  sticky.append(content);
  outer.append(sticky);
  return outer;
}

function cylinder(): void {
  const [gallery] = elements("[data-section='work'] [data-gallery]", HTMLElement);
  if (!gallery) {
    return;
  }
  const cards = [...gallery.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const ring = document.createElement("div");
  ring.dataset.cylinderRing = "";
  const floor = document.createElement("div");
  floor.dataset.cylinderFloor = "";
  const step = 360 / cards.length;
  cards.forEach((card, index) => {
    card.style.setProperty("--angle", `${index * step}deg`);
    card.dataset.cursor = "zoom";
    ring.append(card);
  });
  gallery.removeAttribute("data-gallery");
  gallery.dataset.cylinder = "";
  gallery.replaceChildren(floor, ring);
  const layout = () => {
    const width = Math.min(globalThis.innerWidth * 0.62, 640);
    const height = width * 0.52;
    const radius = width / 2 / Math.tan(Math.PI / cards.length) + 24;
    gallery.style.setProperty("--card-w", `${width}px`);
    gallery.style.setProperty("--card-h", `${height}px`);
    gallery.style.setProperty("--radius", `${radius}px`);
    ring.style.setProperty("--depth", `${-radius}px`);
  };
  layout();
  globalThis.addEventListener("resize", layout);
  const outer = pin(gallery, 3.2);
  const position = track(outer);
  let angle = 0;
  let target = 0;
  let drag = 0;
  let dragging = false;
  let lastX = 0;
  gallery.dataset.cursor = "drag";
  gallery.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
  });
  document.addEventListener("pointerup", () => {
    dragging = false;
  });
  document.addEventListener("pointermove", (event) => {
    if (dragging) {
      drag += (event.clientX - lastX) * 0.25;
      lastX = event.clientX;
    }
  });
  onScroll(({ y }) => {
    target = -position.progress(y, 0, 1) * (360 - step);
  });
  onTick(() => {
    angle += (target + drag - angle) * 0.08;
    ring.style.transform = `translateZ(var(--depth)) rotateX(-6deg) rotateY(${angle}deg)`;
  });
}

function strip(): void {
  const [grid] = elements("[data-section='events'] ul[data-event-grid]", HTMLElement);
  if (!grid) {
    return;
  }
  grid.removeAttribute("data-event-grid");
  grid.dataset.strip = "";
  const outer = pin(grid, 3);
  const position = track(outer);
  const images = elements("img[data-gallery-image]", HTMLElement, grid);
  let offset = 0;
  let target = 0;
  let skew = 0;
  onScroll(({ y, velocity }) => {
    const distance = Math.max(0, grid.scrollWidth - globalThis.innerWidth);
    target = position.progress(y, 0, 1) * distance;
    skew = clamp(velocity * 0.25, -8, 8);
  });
  let currentSkew = 0;
  onTick(() => {
    offset += (target - offset) * 0.1;
    currentSkew += (skew - currentSkew) * 0.1;
    grid.style.transform = `translate3d(${-offset}px, 0, 0) skewX(${-currentSkew}deg)`;
    const width = globalThis.innerWidth;
    for (const image of images) {
      const box = image.parentElement?.getBoundingClientRect();
      if (box && box.right > -200 && box.left < width + 200) {
        const centre = (box.left + box.width / 2) / width - 0.5;
        image.style.setProperty("--shift", `${-centre * 14}%`);
      }
    }
  });
}

function colossal(): void {
  for (const element of elements("[data-colossal]", HTMLElement)) {
    const characters = splitText(element, "chars", false);
    characters.forEach((character, index) => {
      character.style.setProperty("--tilt", `${(index % 2 ? 1 : -1) * (8 + index * 2)}deg`);
    });
    const position = track(element);
    onScroll(({ y }) => {
      const progress = position.progress(y, 1, 1);
      characters.forEach((character, index) => {
        const local = clamp(progress * 1.6 - index * 0.08, 0, 1);
        character.style.setProperty("--reveal", (1 - (1 - local) ** 3).toFixed(4));
      });
    });
  }
}

function parallax(): void {
  for (const element of elements(
    "[data-page-hero] h1, [data-section] img[data-parallax]",
    HTMLElement,
  )) {
    const position = track(element);
    onScroll(({ y }) => {
      const progress = position.progress(y, 1, 0);
      element.style.translate = `0 ${(progress - 0.5) * -60}px`;
    });
  }
}

export function startScrollEffects(): void {
  if (reducedMotion()) {
    return;
  }
  colossal();
  parallax();
  if (document.documentElement.dataset.layout !== "home") {
    return;
  }
  intro();
  counters();
  cylinder();
  strip();
}
