import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AuditJob, WorkerReply } from "./audit.ts";
import { isWorkerReply } from "./audit.ts";

export interface AuditWorker {
  ready: Promise<WorkerReply>;
  run: (job: AuditJob) => Promise<WorkerReply>;
  stop: () => void;
}

export function startWorker(): AuditWorker {
  const worker = fork(fileURLToPath(new URL("../commands/worker.ts", import.meta.url)));
  let settle: ((reply: WorkerReply) => void) | undefined;
  worker.on("message", (message: unknown) => {
    if (isWorkerReply(message)) {
      settle?.(message);
    }
  });
  worker.on("exit", (code) => settle?.({ error: `Lighthouse worker exited with code ${code}` }));
  const next = () =>
    new Promise<WorkerReply>((resolve) => {
      settle = resolve;
    });
  const ready = next();
  return {
    ready,
    run(job) {
      const reply = next();
      worker.send(job);
      return reply;
    },
    stop: () => worker.disconnect(),
  };
}
