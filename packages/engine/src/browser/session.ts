import type { Browser, BrowserContext, BrowserContextOptions, Page, Request } from "playwright";
import { defaultViewport } from "./audit-config.ts";
import { report } from "./problems.ts";

export interface Session {
  context: BrowserContext;
  page: Page;
}

const pendingFailures = new Set<Promise<void>>();

export async function verifiedPdfAbort(
  url: string,
  error: string | undefined,
  origin: string,
  navigation: boolean,
): Promise<boolean> {
  const target = new URL(url);
  if (
    !navigation ||
    error !== "net::ERR_ABORTED" ||
    target.origin !== origin ||
    !target.pathname.toLowerCase().endsWith(".pdf")
  ) {
    return false;
  }
  try {
    const response = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (
      response.status !== 200 ||
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
        "application/pdf"
    ) {
      return false;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  } catch {
    return false;
  }
}

export async function settleRequestFailures(): Promise<void> {
  while (pendingFailures.size > 0) {
    await Promise.all(pendingFailures);
  }
}

export function recordRequestFailure(
  request: Pick<Request, "url" | "failure" | "isNavigationRequest">,
  origin: string,
  scope: string,
): void {
  if (new URL(request.url()).origin !== origin) {
    return;
  }
  const verification = verifiedPdfAbort(
    request.url(),
    request.failure()?.errorText,
    origin,
    request.isNavigationRequest(),
  )
    .then((verified) => {
      if (!verified) {
        report(scope, `Request failed for ${new URL(request.url()).pathname}`);
      }
    })
    .finally(() => pendingFailures.delete(verification));
  pendingFailures.add(verification);
}

export async function openSession(
  browser: Browser,
  origin: string,
  label: string,
  options: BrowserContextOptions = {},
  initScripts: readonly (() => void)[] = [],
): Promise<Session> {
  const context = await browser.newContext({
    viewport: defaultViewport,
    colorScheme: "light",
    ...options,
  });
  for (const script of initScripts) {
    await context.addInitScript(script);
  }
  const page = await context.newPage();
  const scope = () => `${label} ${new URL(page.url()).pathname}`;
  const embedded = (source: string | undefined) =>
    Boolean(source) && /^https?:\/\//.test(source ?? "") && !source?.startsWith(origin);
  page.on("pageerror", (error) => {
    if (!embedded(/https?:\/\/[^\s)]+/.exec(error.stack ?? "")?.[0])) {
      report(scope(), `Uncaught error: ${error.message}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !embedded(message.location().url)) {
      report(scope(), `Console error: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) {
      report(scope(), `HTTP ${response.status()} for ${new URL(response.url()).pathname}`);
    }
  });
  page.on("requestfailed", (request) => {
    recordRequestFailure(request, origin, scope());
  });
  return { context, page };
}

export async function waitForImages(page: Page): Promise<void> {
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) {
      if (image instanceof HTMLImageElement) {
        image.loading = "eager";
      }
    }
  });
  await page.waitForFunction(
    () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => document.fonts.ready);
}
