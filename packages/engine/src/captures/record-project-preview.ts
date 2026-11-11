#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  chromium,
  type Page,
} from "playwright";

const GL_ARGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

const CONFIG = {
  viewport: { width: 1280, height: 800 },
  scroll: {
    secondsPerScreen: 4.0,
    downMin: 9,
    downMax: 21,
    upRatio: 0.6,
    upMin: 6,
    upMax: 13,
    holdTop: 0.8,
    holdBottom: 1.0,
    holdEnd: 0.6,
  },

  scrollableThreshold: 0.15,
};

const args: Record<string, string | undefined> = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string | undefined][]>((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      acc.push([cur.slice(2), arr[i + 1]]);
    }
    return acc;
  }, []),
);

const captureUrl = args.url ?? "";
if (
  !captureUrl ||
  new globalThis.URL(captureUrl).protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(new globalThis.URL(captureUrl).hostname)
) {
  throw new Error("Only the verified local build may be captured");
}
const OUT = args.out ?? "";
const TMP = args.tmp || path.join(process.env.TMPDIR || "/tmp", "demo-rec");
const { width: VW, height: VH } = CONFIG.viewport;

if (!OUT) {
  console.error("Missing required --out <demo.mp4>");
  process.exit(2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

async function settleLoad(page: Page) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 12000 });
  } catch {}
  try {
    await Promise.race([
      page.evaluate(async () => {
        try {
          await document.fonts.ready;
        } catch {}
        return true;
      }),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
  } catch {}
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollHeight: Math.max(
        document.body.scrollHeight,
        doc.scrollHeight,
        document.body.offsetHeight,
        doc.offsetHeight,
      ),
      innerHeight: window.innerHeight,
    };
  });

async function stabilize(page: Page) {
  let m = await measure(page);
  let stable = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const n = await measure(page);
    if (n.scrollHeight === m.scrollHeight) {
      if (++stable >= 3) {
        break;
      }
    } else {
      stable = 0;
    }
    m = n;
  }
  return m;
}

function resetTmp() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
}

async function recordScrollable(browser: Browser) {
  resetTmp();
  const ctx = await captureContext(browser, {
    viewport: { width: VW, height: VH },
    recordVideo: { dir: TMP, size: { width: VW, height: VH } },
  });
  const started = Date.now();
  const page = await ctx.newPage();
  await page.goto(captureUrl, { waitUntil: "load", timeout: 60000 });
  await settleLoad(page);
  const m = await stabilize(page);
  await page.addStyleTag({ content: "*, html, body { scroll-behavior: auto !important; }" });
  const distance = Math.max(0, m.scrollHeight - m.innerHeight);
  const screens = distance / m.innerHeight;
  const s = CONFIG.scroll;
  const down = clamp(screens * s.secondsPerScreen, s.downMin, s.downMax);
  const up = clamp(down * s.upRatio, s.upMin, s.upMax);
  const offset = (Date.now() - started) / 1000;
  await sleep(s.holdTop * 1000);
  const scroll = (origin: number, destination: number, duration: number) =>
    page.evaluate(
      ({ from, to, seconds }) =>
        new Promise<void>((resolve) => {
          const start = performance.now();
          const frame = (now: number) => {
            const progress = Math.min(1, (now - start) / (seconds * 1000));
            scrollTo(0, from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * progress)));
            if (progress < 1) {
              requestAnimationFrame(frame);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(frame);
        }),
      { from: origin, to: destination, seconds: duration },
    );
  await scroll(0, distance, down);
  await sleep(s.holdBottom * 1000);
  await scroll(distance, 0, up);
  await sleep(s.holdEnd * 1000);
  const video = page.video();
  await closeContext(ctx);
  if (!video) {
    throw new Error("Project recording is missing");
  }
  const videoPath = await video.path();
  encode([
    "-ss",
    String(offset),
    "-i",
    videoPath,
    "-t",
    String(s.holdTop + down + s.holdBottom + up + s.holdEnd),
    "-r",
    "30",
    "-an",
  ]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log("Preview captured (scroll sequence)");
}

async function recordStatic(browser: Browser) {
  resetTmp();
  const ctx = await captureContext(browser, {
    viewport: { width: VW, height: VH },
    recordVideo: { dir: TMP, size: { width: VW, height: VH } },
  });
  const page = await ctx.newPage();
  await page.goto(captureUrl, { waitUntil: "load", timeout: 60000 });
  await settleLoad(page);
  await stabilize(page);
  await sleep(2000);
  console.log("STATIC: holding to capture animations");
  await page.mouse.move(VW * 0.3, VH * 0.5, { steps: 1 });
  await sleep(2500);
  await page.mouse.move(VW * 0.7, VH * 0.45, { steps: 1 });
  await sleep(2500);
  await page.mouse.move(VW * 0.5, VH * 0.5, { steps: 1 });
  await sleep(3500);
  await closeContext(ctx);

  const webm = fs
    .readdirSync(TMP)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => ({ f, t: fs.statSync(path.join(TMP, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0];
  if (!webm) {
    console.error("No webm produced");
    process.exit(3);
  }

  encode(["-sseof", "-13", "-i", path.join(TMP, webm.f), "-t", "13", "-r", "30", "-an"]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log("Preview captured (static)");
}

function encode(inputArgs: string[]) {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      ...inputArgs,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "24",
      "-maxrate",
      "1200k",
      "-bufsize",
      "2400k",
      "-movflags",
      "+faststart",
      OUT,
    ],
    { stdio: "inherit" },
  );
}

const observations: {
  page_errors: string[];
  failed_requests: string[];
  blocked_external_requests: string[];
  bad_responses: { path: string; status: number }[];
  viewports: {
    width: number;
    overflow: number;
    text: number;
    canvas: number;
    svg: number;
    nonzero_graphics: boolean;
  }[];
  mode?: string;
  browser?: string;
} = {
  page_errors: [],
  failed_requests: [],
  blocked_external_requests: [],
  bad_responses: [],
  viewports: [],
};
const targetOrigin = new globalThis.URL(captureUrl).origin;
const closing = new WeakSet<BrowserContext>();
async function closeContext(context: BrowserContext) {
  closing.add(context);
  await context.close();
}
async function captureContext(browser: Browser, options: BrowserContextOptions) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    ...options,
    serviceWorkers: "block",
  });
  await context.routeWebSocket("**/*", (socket) => {
    const url = new URL(socket.url());
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    if (url.origin !== targetOrigin) {
      observations.blocked_external_requests.push(url.origin + url.pathname);
      socket.close();
      return;
    }
    socket.connectToServer();
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new globalThis.URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== targetOrigin) {
      observations.blocked_external_requests.push(url.origin + url.pathname);
      await route.abort();
      return;
    }
    await route.continue();
  });
  context.on("page", (page) => {
    page.on("pageerror", (error) => observations.page_errors.push(error.message));
    page.on("requestfailed", (request) => {
      const url = new globalThis.URL(request.url());
      if (url.origin === targetOrigin && !closing.has(context)) {
        observations.failed_requests.push(url.pathname);
      }
    });
    page.on("response", (response) => {
      const url = new globalThis.URL(response.url());
      if (response.status() >= 400 && url.pathname !== "/favicon.ico") {
        observations.bad_responses.push({ path: url.pathname, status: response.status() });
      }
    });
  });
  return context;
}
async function inspectResponsive(browser: Browser) {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    const context = await captureContext(browser, { viewport });
    const page = await context.newPage();
    await page.goto(captureUrl, { waitUntil: "load", timeout: 60000 });
    await settleLoad(page);
    await sleep(1200);
    const graphics = await page.screenshot({ type: "png" });
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      text: document.body.innerText.trim().length,
      canvas: document.querySelectorAll("canvas").length,
      svg: document.querySelectorAll("svg").length,
    }));
    const { default: sharp } = await import("sharp");
    const stats = await sharp(graphics).stats();
    observations.viewports.push({
      ...metrics,
      nonzero_graphics: stats.channels.some((channel) => channel.stdev > 3),
    });
    await closeContext(context);
  }
}
async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: GL_ARGS,
  });

  const warm = await captureContext(browser, {
    viewport: { width: VW, height: VH },
  });
  const wp = await warm.newPage();
  await wp.goto(captureUrl, { waitUntil: "load", timeout: 60000 });
  await sleep(1500);
  try {
    await wp.reload({ waitUntil: "load", timeout: 60000 });
  } catch {}
  await settleLoad(wp);
  const metrics = await stabilize(wp);
  await closeContext(warm);

  const distance = metrics.scrollHeight - metrics.innerHeight;
  const scrollable = distance > metrics.innerHeight * CONFIG.scrollableThreshold;

  observations.mode = scrollable ? "scroll-sequence" : "animation-hold";
  observations.browser = browser.version();
  await inspectResponsive(browser);
  if (scrollable) {
    await recordScrollable(browser);
  } else {
    await recordStatic(browser);
  }

  await browser.close();
  fs.writeFileSync(
    path.join(path.dirname(OUT), "observations.json"),
    `${JSON.stringify(observations, null, 2)}\n`,
  );
  if (
    observations.page_errors.length > 0 ||
    observations.failed_requests.length > 0 ||
    observations.blocked_external_requests.length > 0 ||
    observations.bad_responses.length > 0 ||
    observations.viewports.some((item) => !item.nonzero_graphics || item.overflow > 1)
  ) {
    throw new Error("Preview runtime checks require manual review");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
