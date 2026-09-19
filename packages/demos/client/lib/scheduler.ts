import type { Cancel } from "./dom.ts";

export interface Slot {
  later(callback: () => void, delay: number): void;
  frame(callback: FrameRequestCallback): void;
  interval(callback: () => void, delay: number): void;
  cancel(): void;
  readonly active: boolean;
}

export interface Scheduler {
  later(callback: () => void, delay: number): Cancel;
  frame(callback: FrameRequestCallback): Cancel;
  interval(callback: () => void, delay: number): Cancel;
  slot(): Slot;
  add(cleanup: Cancel): void;
  dispose(): void;
}

const noop: Cancel = () => {};

export function createScheduler(): Scheduler {
  const pending = new Set<Cancel>();

  function track(cancel: Cancel): Cancel {
    const once = () => {
      if (pending.delete(once)) {
        cancel();
      }
    };
    pending.add(once);
    return once;
  }

  function later(callback: () => void, delay: number): Cancel {
    const cancel = track(() => clearTimeout(timer));
    const timer = setTimeout(() => {
      pending.delete(cancel);
      callback();
    }, delay);
    return cancel;
  }

  function frame(callback: FrameRequestCallback): Cancel {
    const cancel = track(() => cancelAnimationFrame(handle));
    const handle = requestAnimationFrame((time) => {
      pending.delete(cancel);
      callback(time);
    });
    return cancel;
  }

  function interval(callback: () => void, delay: number): Cancel {
    const timer = setInterval(callback, delay);
    return track(() => clearInterval(timer));
  }

  function slot(): Slot {
    let current = noop;
    let active = false;
    const replace = (start: (settle: () => void) => Cancel) => {
      current();
      active = true;
      current = start(() => {
        active = false;
      });
    };
    return {
      later(callback, delay) {
        replace((settle) =>
          later(() => {
            settle();
            callback();
          }, delay),
        );
      },
      frame(callback) {
        replace((settle) =>
          frame((time) => {
            settle();
            callback(time);
          }),
        );
      },
      interval(callback, delay) {
        replace(() => interval(callback, delay));
      },
      cancel() {
        current();
        current = noop;
        active = false;
      },
      get active() {
        return active;
      },
    };
  }

  return {
    later,
    frame,
    interval,
    slot,
    add(cleanup) {
      track(cleanup);
    },
    dispose() {
      for (const cancel of [...pending]) {
        cancel();
      }
    },
  };
}
