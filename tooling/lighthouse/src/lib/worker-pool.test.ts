import { expect, test } from "bun:test";
import { ChildProcess } from "node:child_process";
import type { Result } from "lighthouse";
import type { AuditJob, WorkerReply } from "./audit.ts";
import { startWorker } from "./worker-pool.ts";

const job: AuditJob = {
  url: "https://example.test/document/",
  formFactor: "mobile",
  categories: ["performance"],
  reportPath: "/tmp/sample-report.html",
};
const success: WorkerReply = {
  lhr: { categories: { performance: { score: 0.5 } } } as unknown as Result,
};

function mockWorker(onSend: (worker: ChildProcess) => void, startupCrash = false) {
  const child = new ChildProcess();
  Object.defineProperty(child, "connected", { value: true, writable: true });
  let disconnects = 0;
  child.send = (() => {
    queueMicrotask(() => onSend(child));
    return true;
  }) as ChildProcess["send"];
  child.disconnect = () => {
    disconnects += 1;
    Object.defineProperty(child, "connected", { value: false, writable: true });
    queueMicrotask(() => child.emit("exit", 0, null));
  };
  child.kill = () => {
    queueMicrotask(() => child.emit("exit", null, "SIGKILL"));
    return true;
  };
  queueMicrotask(() =>
    child.emit(startupCrash ? "exit" : "message", startupCrash ? 1 : { ready: true }, null),
  );
  return { child, disconnects: () => disconnects };
}

test("crashed jobs retry once in a fresh process and preserve low scores", async () => {
  const created: ChildProcess[] = [];
  const worker = startWorker(() => {
    const index = created.length;
    const mock = mockWorker((child) =>
      child.emit(index === 0 ? "exit" : "message", index === 0 ? 1 : success, null),
    );
    created.push(mock.child);
    return mock.child;
  });
  expect(await worker.ready).toEqual({ ready: true });
  expect(await worker.run(job)).toEqual(success);
  expect(created).toHaveLength(2);
  await worker.stop();
});

test("a second crash stays fatal with the active route and form factor", async () => {
  let created = 0;
  const worker = startWorker(() => {
    created += 1;
    return mockWorker((child) => child.emit("exit", 2, null)).child;
  });
  expect(await worker.run(job)).toEqual({
    error: `${job.url} mobile: worker exited with code 2 after one retry`,
  });
  expect(created).toBe(2);
  await worker.stop();
});

test("ordinary Lighthouse audit errors never retry", async () => {
  let created = 0;
  const worker = startWorker(() => {
    created += 1;
    return mockWorker((child) => child.emit("message", { error: "audit failed" })).child;
  });
  expect(await worker.run(job)).toEqual({ error: "audit failed" });
  expect(created).toBe(1);
  await worker.stop();
});

test("cleanup is idempotent and stopped jobs settle", async () => {
  const mock = mockWorker(() => {});
  const worker = startWorker(() => mock.child);
  await worker.ready;
  await Promise.all([worker.stop(), worker.stop()]);
  expect(mock.disconnects()).toBe(1);
  expect(await worker.run(job)).toEqual({ error: `${job.url} mobile: worker stopped` });
});

test("startup crashes retry once and remain fatal after the retry", async () => {
  let created = 0;
  const worker = startWorker(() => {
    created += 1;
    return mockWorker(() => {}, true).child;
  });
  expect(await worker.ready).toEqual({
    error: "Lighthouse startup: worker exited with code 1 after one retry",
  });
  expect(created).toBe(2);
  await worker.stop();
});

test("child errors and synchronous send failures settle and retry", async () => {
  for (const event of ["error", "throw"]) {
    let created = 0;
    const worker = startWorker(() => {
      const first = created++ === 0;
      const mock = mockWorker((child) => child.emit("message", success));
      if (first) {
        mock.child.send = (() => {
          if (event === "throw") {
            throw new Error("send failed");
          }
          queueMicrotask(() => mock.child.emit("error", new Error("channel failed")));
          return false;
        }) as ChildProcess["send"];
      }
      return mock.child;
    });
    expect(await worker.run(job)).toEqual(success);
    expect(created).toBe(2);
    await worker.stop();
  }
});

test("asynchronous IPC send failures settle and retry", async () => {
  let created = 0;
  const worker = startWorker(() => {
    const first = created++ === 0;
    const mock = mockWorker((child) => child.emit("message", success));
    if (first) {
      mock.child.send = ((_message: unknown, callback: (error: Error | null) => void) => {
        queueMicrotask(() => callback(new Error("IPC send failed")));
        return false;
      }) as ChildProcess["send"];
    }
    return mock.child;
  });
  expect(await worker.run(job)).toEqual(success);
  expect(created).toBe(2);
  await worker.stop();
});

test("stopping a pending audit settles without restarting", async () => {
  let created = 0;
  const worker = startWorker(() => {
    created += 1;
    return mockWorker(() => {}).child;
  });
  await worker.ready;
  const pending = worker.run(job);
  await Promise.resolve();
  await worker.stop();
  expect(await pending).toEqual({ error: `${job.url} mobile: worker stopped` });
  expect(created).toBe(1);
});
