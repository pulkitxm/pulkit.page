type Decision = "allow" | "deny";

export interface Step {
  decision: Decision;
  detail: string;
  evicted: readonly number[];
  incomingAt: number;
  logAfter: readonly number[];
  logAfterCleanup: readonly number[];
  now: number;
  title: string;
}

export interface Attempt {
  allowed: boolean;
  t: number;
}

export const windowSeconds = 10;
export const limit = 3;
export const timelineMax = 15;
export const timelineAxisSeconds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export const trackPadPct = 6;
export const trackInnerPct = 88;

export const steps: readonly Step[] = [
  {
    decision: "allow",
    detail:
      "Window spans the last 10 seconds. The log is empty, so the request is accepted and timestamp 1 is stored.",
    evicted: [],
    incomingAt: 1,
    logAfter: [1],
    logAfterCleanup: [],
    now: 1,
    title: "First request",
  },
  {
    decision: "allow",
    detail:
      "Only one prior accepted request sits inside the sliding window. Under the limit, so timestamp 3 is appended.",
    evicted: [],
    incomingAt: 3,
    logAfter: [1, 3],
    logAfterCleanup: [1],
    now: 3,
    title: "Second request",
  },
  {
    decision: "allow",
    detail:
      "After cleanup two prior timestamps remain inside this window (there is still headroom), so timestamp 8 is accepted and stored.",
    evicted: [],
    incomingAt: 8,
    logAfter: [1, 3, 8],
    logAfterCleanup: [1, 3],
    now: 8,
    title: "Third request fills the quota",
  },
  {
    decision: "deny",
    detail:
      "After trimming entries older than t−10, three accepted timestamps remain. Adding a fourth would break 3 reqs / 10 secs, so it is denied and never logged.",
    evicted: [],
    incomingAt: 9,
    logAfter: [1, 3, 8],
    logAfterCleanup: [1, 3, 8],
    now: 9,
    title: "Fourth request rejected",
  },
  {
    decision: "allow",
    detail:
      "At t=12 the window reaches back to t=2. Timestamp 1 is outside and removed from the log. Two slots remain inside the quota, so 12 is accepted.",
    evicted: [1],
    incomingAt: 12,
    logAfter: [3, 8, 12],
    logAfterCleanup: [3, 8],
    now: 12,
    title: "Window slides, room appears",
  },
  {
    decision: "allow",
    detail:
      "Trailing edge moves to t=4. Timestamp 3 drops out of the sliding window and is trimmed from the log, then 14 is appended.",
    evicted: [3],
    incomingAt: 14,
    logAfter: [8, 12, 14],
    logAfterCleanup: [8, 12],
    now: 14,
    title: "Another eviction",
  },
  {
    decision: "deny",
    detail:
      "No timestamps expire relative to t=15; the window sits on [5, 15]. The log already carries three accepted requests, so the new arrival is rejected.",
    evicted: [],
    incomingAt: 15,
    logAfter: [8, 12, 14],
    logAfterCleanup: [8, 12, 14],
    now: 15,
    title: "Log full again",
  },
];

export const allAttempts: readonly Attempt[] = steps.map((step) => ({
  allowed: step.decision === "allow",
  t: step.incomingAt,
}));

export function trackLeftPct(t: number): number {
  const clamped = Math.min(Math.max(t, 0), timelineMax);
  return trackPadPct + (clamped / timelineMax) * trackInnerPct;
}
