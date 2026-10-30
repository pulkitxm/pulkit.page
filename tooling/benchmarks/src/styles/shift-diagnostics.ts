import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { profiles } from "./config.ts";
import { fixtureServers } from "./server.ts";

interface ShiftObservation {
  time?: number;
  value?: number;
  recentInput?: boolean;
  sources?: { tag: string; previous: number[]; current: number[] }[];
  fontsLoadedAt?: number;
}
interface ShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
}
export interface ShiftDiagnostic {
  variant: string;
  shifts: ShiftObservation[];
  paints: { name: string; time: number }[];
  fonts: { path: string; start: number; end: number }[];
}
declare global {
  var styleBenchmarkShifts: ShiftObservation[];
}

export async function diagnoseShifts(output: string): Promise<void> {
  const profile = profiles.find((item) => item.id === "severe");
  if (!profile) {
    throw new Error("Missing constrained profile");
  }
  const servers = fixtureServers(output, ["utilities", "composed", "pruned", "direct"]);
  const browser = await chromium.launch();
  const results: ShiftDiagnostic[] = [];
  try {
    for (const [variant, server] of servers) {
      server.setLatency(profile.latency);
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dpr,
        hasTouch: true,
        isMobile: true,
        colorScheme: "light",
        serviceWorkers: "block",
      });
      await context.addInitScript(() => {
        const events: ShiftObservation[] = [];
        globalThis.styleBenchmarkShifts = events;
        new PerformanceObserver((list) => {
          for (const item of list.getEntries()) {
            const entry = item as ShiftEntry;
            events.push({
              time: entry.startTime,
              value: entry.value,
              recentInput: entry.hadRecentInput,
              sources: entry.sources.map((source) => ({
                tag: source.node instanceof Element ? source.node.tagName : "#text",
                previous: [
                  source.previousRect.x,
                  source.previousRect.y,
                  source.previousRect.width,
                  source.previousRect.height,
                ],
                current: [
                  source.currentRect.x,
                  source.currentRect.y,
                  source.currentRect.width,
                  source.currentRect.height,
                ],
              })),
            });
          }
        }).observe({ type: "layout-shift", buffered: true });
        document.fonts.addEventListener("loadingdone", () =>
          events.push({ fontsLoadedAt: performance.now() }),
        );
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
      await session.send("Network.enable");
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: (profile.download * 1000000) / 8,
        uploadThroughput: (profile.upload * 1000000) / 8,
      });
      await page.goto(server.url, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const captured = await page.evaluate(() => ({
        shifts: globalThis.styleBenchmarkShifts,
        paints: performance
          .getEntriesByType("paint")
          .map((entry) => ({ name: entry.name, time: entry.startTime })),
        fonts: (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .filter((entry) => entry.name.includes(".woff2"))
          .map((entry) => ({
            path: new URL(entry.name).pathname,
            start: entry.startTime,
            end: entry.responseEnd,
          })),
      }));
      if (errors.length > 0 || server.counters().missing > 0) {
        throw new Error(`Diagnostic visit failed: ${errors.join(", ")}`);
      }
      results.push({ variant, ...captured });
      console.log(
        `${variant}: captured ${captured.shifts.filter((entry) => entry.value !== undefined).length} raw shifts`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    for (const server of servers.values()) {
      server.close();
    }
  }
  writeFileSync(join(output, "shift-diagnostics.json"), `${JSON.stringify(results, null, 2)}\n`);
}
