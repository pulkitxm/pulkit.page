export function formatDuration(milliseconds) {
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

export function logDuration(label, startedAt) {
  console.log(`${label} (${formatDuration(performance.now() - startedAt)})`);
}
