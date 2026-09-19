import type { Scheduler } from "./scheduler.ts";

export interface CopyFeedback {
  copy(text: string): Promise<void>;
  readonly copied: boolean;
}

export function createCopyFeedback(
  scheduler: Scheduler,
  onChange: (copied: boolean) => void,
  duration = 2000,
): CopyFeedback {
  const reset = scheduler.slot();
  let copied = false;
  return {
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return;
      }
      copied = true;
      onChange(true);
      reset.later(() => {
        copied = false;
        onChange(false);
      }, duration);
    },
    get copied() {
      return copied;
    },
  };
}
