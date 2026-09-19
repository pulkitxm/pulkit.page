export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }
  if (milliseconds < 60_000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = ((milliseconds % 60_000) / 1000).toFixed(1);
  return [hours && `${hours} h`, minutes && `${minutes} min`, `${seconds} s`]
    .filter(Boolean)
    .join(" ");
}

export function logDuration(label: string, startedAt: number): void {
  console.log(`${label} (${formatDuration(performance.now() - startedAt)})`);
}

type StepLabel<T> = string | ((result: T) => string);

function labelFor<T>(label: StepLabel<T>, result: T): string {
  return typeof label === "string" ? label : label(result);
}

export function timed<T>(label: StepLabel<T>, action: () => T): T {
  const startedAt = performance.now();
  const result = action();
  logDuration(labelFor(label, result), startedAt);
  return result;
}

export async function timedAsync<T>(label: StepLabel<T>, action: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  const result = await action();
  logDuration(labelFor(label, result), startedAt);
  return result;
}
