import type { Browser, CDPSession, Page } from "playwright";
import type { NavigationSample, Profile, Variant } from "./config.ts";
import { clickPaintProbe, installObservers, navigationMetrics, styleStress } from "./observers.ts";
import type { FixtureServer } from "./server.ts";

async function metrics(session: CDPSession | null): Promise<Record<string, number>> {
  if (!session) {
    return {};
  }
  const result = await session.send("Performance.getMetrics");
  return Object.fromEntries(result.metrics.map((entry) => [entry.name, entry.value]));
}

function difference(
  before: Record<string, number>,
  after: Record<string, number>,
  name: string,
  factor = 1,
): number | null {
  const a = before[name];
  const b = after[name];
  return a !== undefined && b !== undefined && b >= a ? (b - a) * factor : null;
}

async function interaction(
  page: Page,
  session: CDPSession | null,
): Promise<Record<string, number | null>> {
  await page.evaluate(clickPaintProbe);
  await page.locator("[data-theme-toggle]").click();
  await page.waitForFunction(
    () =>
      typeof (globalThis as typeof globalThis & { styleBenchmarkClick?: number })
        .styleBenchmarkClick === "number",
    undefined,
    { timeout: 15000 },
  );
  const click = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & { styleBenchmarkClick?: number }).styleBenchmarkClick ??
      null,
  );
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-change"));
  const events = await page.evaluate(() => [...globalThis.styleBenchmarkObservations.events]);
  const before = await metrics(session);
  const stress = await page.evaluate(styleStress);
  const after = await metrics(session);
  return {
    themePaintMs: click,
    clickEventMs: events.length > 0 ? Math.max(...events) : null,
    styleFlushMs: stress,
    stressStyleMs: difference(before, after, "RecalcStyleDuration", 1000),
    stressLayoutMs: difference(before, after, "LayoutDuration", 1000),
  };
}

export async function sampleVisit(
  browser: Browser,
  engine: string,
  profile: Profile,
  variant: Variant,
  round: number,
  server: FixtureServer,
): Promise<NavigationSample[]> {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    hasTouch: profile.mobile,
    colorScheme: "light",
    reducedMotion: "no-preference",
    serviceWorkers: "block",
    ...(engine === "chromium" ? { isMobile: profile.mobile } : {}),
  });
  await context.addInitScript(installObservers);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on("request", (request) => {
    if (!request.url().startsWith(server.url)) {
      errors.push(`External request attempted: ${new URL(request.url()).hostname}`);
    }
  });
  const session = engine === "chromium" ? await context.newCDPSession(page) : null;
  const rows: NavigationSample[] = [];
  try {
    if (session) {
      await session.send("Performance.enable");
      await session.send("Network.enable");
      await session.send("Network.setCacheDisabled", { cacheDisabled: false });
      await session.send("Network.setBypassServiceWorker", { bypass: true });
      await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: profile.latency,
        downloadThroughput: profile.download ? (profile.download * 1000000) / 8 : -1,
        uploadThroughput: profile.upload ? (profile.upload * 1000000) / 8 : -1,
      });
    }
    for (const cache of ["cold", "warm"] as const) {
      if (cache === "warm") {
        await page.goto("about:blank");
      }
      const before = await metrics(session);
      const traffic = server.counters();
      await page.goto(server.url, { waitUntil: "load", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const observed = await page.evaluate(navigationMetrics);
      const after = await metrics(session);
      const finished = server.counters();
      const measured: NavigationSample = {
        variant,
        profile: `${engine}:${profile.id}`,
        round,
        cache,
        metrics: {
          ...observed.metrics,
          serverBodyBytes: finished.bodyBytes - traffic.bodyBytes,
          serverRequests: finished.requests - traffic.requests,
          revalidations: finished.revalidations - traffic.revalidations,
          styleMs: difference(before, after, "RecalcStyleDuration", 1000),
          layoutMs: difference(before, after, "LayoutDuration", 1000),
          scriptMs: difference(before, after, "ScriptDuration", 1000),
          taskMs: difference(before, after, "TaskDuration", 1000),
          styleRecalculations: difference(before, after, "RecalcStyleCount"),
          layouts: difference(before, after, "LayoutCount"),
          jsHeapMiB: after.JSHeapUsedSize === undefined ? null : after.JSHeapUsedSize / 1048576,
          nodes: after.Nodes ?? null,
        },
        lcpTarget: observed.lcpTarget,
        unsupported: observed.unsupported,
        errors: [...errors],
      };
      rows.push(measured);
      if (cache === "warm") {
        Object.assign(measured.metrics, await interaction(page, session));
      }
    }
    if (server.counters().missing > 0) {
      throw new Error("The fixture served a missing resource");
    }
  } catch (error) {
    rows.push({
      variant,
      profile: `${engine}:${profile.id}`,
      round,
      cache: rows.length > 0 ? "warm" : "cold",
      metrics: {},
      errors: [...errors, error instanceof Error ? error.message : String(error)],
    });
  } finally {
    await context.close();
  }
  return rows;
}
