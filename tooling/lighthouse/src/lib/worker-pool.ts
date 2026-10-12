import { type ChildProcess, fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { errorMessage } from "@pulkit/shared/failures";
import type { AuditJob, WorkerReply } from "./audit.ts";
import { isWorkerReply } from "./audit.ts";

export interface AuditWorker {
  ready: Promise<WorkerReply>;
  run: (job: AuditJob) => Promise<WorkerReply>;
  stop: () => Promise<void>;
}

type ProcessReply = WorkerReply | { crash: string };
type WorkerFactory = () => ChildProcess;

function connectWorker(create: WorkerFactory) {
  const worker = create();
  let settle: ((reply: ProcessReply) => void) | undefined;
  let failure: string | undefined;
  let exited = false;
  let stopping: Promise<void> | undefined;
  let finishExit: () => void = () => {};
  const exit = new Promise<void>((resolve) => {
    finishExit = resolve;
  });
  const fail = (message: string) => {
    failure = message;
    settle?.({ crash: message });
    settle = undefined;
  };
  worker.on("message", (message: unknown) => {
    if (isWorkerReply(message)) {
      settle?.(message);
      settle = undefined;
    }
  });
  worker.on("error", (error) => fail(errorMessage(error)));
  worker.on("exit", (code, signal) => {
    exited = true;
    fail(`worker exited with ${signal ? `signal ${signal}` : `code ${code}`}`);
    finishExit();
  });
  worker.on("close", () => {
    exited = true;
    finishExit();
  });
  const next = () =>
    new Promise<ProcessReply>((resolve) => {
      if (failure) {
        resolve({ crash: failure });
      } else {
        settle = resolve;
      }
    });
  return {
    ready: next(),
    run(job: AuditJob) {
      const result = next();
      if (!failure) {
        try {
          worker.send(job, (error: Error | null) => {
            if (error) {
              fail(errorMessage(error));
            }
          });
        } catch (error) {
          fail(errorMessage(error));
        }
      }
      return result;
    },
    stop() {
      if (stopping) {
        return stopping;
      }
      stopping = (async () => {
        if (exited) {
          return;
        }
        try {
          if (worker.connected) {
            worker.disconnect();
          }
        } catch {
          worker.kill();
        }
        const timeout = setTimeout(() => {
          worker.kill("SIGKILL");
          finishExit();
        }, 5000);
        timeout.unref();
        try {
          await exit;
        } finally {
          clearTimeout(timeout);
        }
      })();
      return stopping;
    },
  };
}

export function startWorker(
  create: WorkerFactory = () =>
    fork(fileURLToPath(new URL("../commands/worker.ts", import.meta.url))),
): AuditWorker {
  let worker = connectWorker(create);
  let stopped = false;
  const ready = (async (): Promise<WorkerReply> => {
    let reply = await worker.ready;
    if ("crash" in reply) {
      await worker.stop();
      if (stopped) {
        return { error: "Lighthouse worker stopped" };
      }
      console.warn(`Lighthouse startup: ${reply.crash}; retrying with a fresh worker`);
      worker = connectWorker(create);
      reply = await worker.ready;
    }
    return "crash" in reply
      ? { error: `Lighthouse startup: ${reply.crash} after one retry` }
      : reply;
  })();
  return {
    ready,
    async run(job) {
      const initial = await ready;
      if ("error" in initial) {
        return { error: `${job.url} ${job.formFactor}: ${initial.error}` };
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (stopped) {
          return { error: `${job.url} ${job.formFactor}: worker stopped` };
        }
        const startup = await worker.ready;
        const reply = "ready" in startup ? await worker.run(job) : startup;
        if (!("crash" in reply)) {
          return reply;
        }
        await worker.stop();
        if (attempt === 1) {
          return { error: `${job.url} ${job.formFactor}: ${reply.crash} after one retry` };
        }
        if (stopped) {
          return { error: `${job.url} ${job.formFactor}: worker stopped` };
        }
        console.warn(`${job.url} ${job.formFactor}: ${reply.crash}; retrying with a fresh worker`);
        worker = connectWorker(create);
      }
      return { error: `${job.url} ${job.formFactor}: worker recovery failed` };
    },
    stop() {
      stopped = true;
      return worker.stop();
    },
  };
}
