import type { IncomingMessage, ServerResponse } from "node:http";
import process from "node:process";
import { formatDuration } from "@pulkit/shared/duration";
import { developmentLog } from "./log.ts";

interface RequestLog {
  summary: () => string | undefined;
  timing: "total" | "response";
  reportAborted?: () => boolean;
}

export function logRequest(
  request: IncomingMessage,
  response: ServerResponse,
  { summary, timing, reportAborted }: RequestLog,
): void {
  const startedAt = performance.now();
  const target = `${request.method} ${request.url}`;
  response.once("finish", () => {
    const result = summary();
    if (result !== undefined) {
      developmentLog(
        `${target} | ${response.statusCode} | ${result} | ${timing} ${formatDuration(performance.now() - startedAt)}`,
      );
    }
  });
  if (reportAborted) {
    response.once("close", () => {
      if (!response.writableFinished && reportAborted()) {
        developmentLog(`${target} | connection closed before completion`, startedAt);
      }
    });
  }
}

interface ClosableServer {
  close(): Promise<void>;
}

export function closeOnSignals(server: ClosableServer, beforeClose: () => void = () => {}): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      beforeClose();
      await server.close();
      process.exit(0);
    });
  }
}

export function localServerUrl(urls: { local: string[] } | null): string {
  const local = urls?.local[0];
  if (local === undefined) {
    throw new Error("The server did not report a local URL");
  }
  return local;
}
