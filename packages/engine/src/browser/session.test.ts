import { expect, test } from "bun:test";
import { reportedProblems } from "./problems.ts";
import { recordRequestFailure, settleRequestFailures, verifiedPdfAbort } from "./session.ts";

test("only accepts aborted same-origin PDF requests with a verified PDF response", async () => {
  const requested: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      requested.push(path);
      if (path === "/valid.pdf") {
        return new Response("%PDF-1.7\nsample", {
          headers: { "content-type": "application/pdf; charset=binary" },
        });
      }
      if (path === "/invalid.pdf") {
        return new Response("Synthetic non-PDF document", {
          headers: { "content-type": "application/pdf" },
        });
      }
      if (path === "/wrong-type.pdf") {
        return new Response("%PDF-1.7\nSynthetic document", {
          headers: { "content-type": "text/plain" },
        });
      }
      if (path === "/redirect.pdf") {
        return new Response(null, { status: 302, headers: { location: "/valid.pdf" } });
      }
      return new Response("Missing synthetic document", { status: 404 });
    },
  });
  const origin = server.url.origin;
  try {
    expect(await verifiedPdfAbort(`${origin}/valid.pdf`, "net::ERR_ABORTED", origin, true)).toBe(
      true,
    );
    for (const path of ["/missing.pdf", "/invalid.pdf", "/wrong-type.pdf", "/redirect.pdf"]) {
      expect(await verifiedPdfAbort(`${origin}${path}`, "net::ERR_ABORTED", origin, true)).toBe(
        false,
      );
    }
    const count = requested.length;
    for (const error of ["net::ERR_FAILED", "net::ERR_CONNECTION_RESET", undefined]) {
      expect(await verifiedPdfAbort(`${origin}/valid.pdf`, error, origin, true)).toBe(false);
    }
    expect(await verifiedPdfAbort(`${origin}/script.js`, "net::ERR_ABORTED", origin, true)).toBe(
      false,
    );
    expect(
      await verifiedPdfAbort(
        `${origin}/valid.pdf`,
        "net::ERR_ABORTED",
        "https://example.test",
        true,
      ),
    ).toBe(false);
    expect(await verifiedPdfAbort(`${origin}/valid.pdf`, "net::ERR_ABORTED", origin, false)).toBe(
      false,
    );
    expect(requested).toHaveLength(count);
    expect(requested.filter((path) => path === "/valid.pdf")).toHaveLength(1);
  } finally {
    await server.stop(true);
  }
});

test("awaits delayed PDF verification and reports an unsuccessful response", async () => {
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<Response>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      started.resolve();
      return response.promise;
    },
  });
  const scope = "synthetic delayed PDF";
  let settled = false;
  try {
    recordRequestFailure(
      {
        url: () => `${server.url.origin}/delayed.pdf`,
        failure: () => ({ errorText: "net::ERR_ABORTED" }),
        isNavigationRequest: () => true,
      },
      server.url.origin,
      scope,
    );
    const completion = settleRequestFailures().then(() => {
      settled = true;
    });
    await started.promise;
    expect(settled).toBe(false);
    response.resolve(new Response("Missing synthetic document", { status: 404 }));
    await completion;
    expect(settled).toBe(true);
    expect(reportedProblems()).toContain(`${scope}: Request failed for /delayed.pdf`);
  } finally {
    response.resolve(new Response(null, { status: 404 }));
    await settleRequestFailures();
    await server.stop(true);
  }
});
