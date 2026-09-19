import { formatDuration } from "@pulkit/shared/duration";

export function developmentLog(message, startedAt) {
  const now = new Date();
  const time = `${now.toLocaleTimeString("en-GB", { hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;
  const elapsed =
    startedAt === undefined ? "" : ` (${formatDuration(performance.now() - startedAt)})`;
  console.log(`[${time}] ${JSON.stringify(message).slice(1, -1)}${elapsed}`);
}
