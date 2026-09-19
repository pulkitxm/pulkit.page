import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide";
import {
  button,
  buttonClass,
  cn,
  escapeHtml,
  html,
  icon,
  prefersReducedMotion,
  refs,
} from "../runtime/ui.js";

const WINDOW_SEC = 10;
const LIMIT = 3;
const TIMELINE_MAX = 15;
const TIMELINE_AXIS_SECONDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const STEPS = [
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

const ALL_ATTEMPTS = STEPS.map((s) => ({ allowed: s.decision === "allow", t: s.incomingAt }));

const TRACK_PAD_PCT = 6;
const TRACK_INNER_PCT = 88;

function trackLeftPct(t) {
  const clamped = Math.min(Math.max(t, 0), TIMELINE_MAX);
  return TRACK_PAD_PCT + (clamped / TIMELINE_MAX) * TRACK_INNER_PCT;
}

const badgeBase =
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden";

const badgeVariants = {
  default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  destructive:
    "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
  outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
};

function badgeClass(variant, className) {
  return cn(badgeBase, badgeVariants[variant], className);
}

function badge(variant, className, content, attrs = "") {
  return `<span data-slot="badge" class="${badgeClass(variant, className)}" ${attrs}>${content}</span>`;
}

const cardClass = cn(
  "rounded-xl border bg-card text-card-foreground shadow",
  "flex min-h-0 w-full min-w-0 flex-1 flex-col border-none bg-transparent",
);
const cardHeaderClass = cn("flex flex-col space-y-1.5 p-6", "space-y-3 pb-4");
const cardTitleClass = cn(
  "font-semibold leading-none tracking-tight",
  "text-balance text-base leading-tight sm:text-lg",
);
const cardContentClass = cn("p-6 pt-0", "flex flex-1 flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6");
const separatorClass = cn(
  "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
  "bg-neutral-200 dark:bg-neutral-800",
);

const edgeLine =
  "h-[3.125rem] w-px -translate-x-1/2 border-neutral-400 border-l border-dashed dark:border-neutral-500";

function attemptClass(attempt, inWindow, isCurrent) {
  return cn(
    "relative flex size-6 items-center justify-center rounded-full border-2 font-mono text-[10px] tracking-tight sm:size-[1.75rem] sm:text-xs",
    attempt.allowed
      ? cn(
          "border-emerald-700 bg-emerald-500 text-white shadow-sm dark:border-emerald-500",
          !(inWindow || isCurrent) &&
            "border-emerald-800/45 bg-emerald-500/30 text-emerald-950 dark:bg-emerald-500/35 dark:text-emerald-50",
          inWindow && "shadow-emerald-900/25 dark:shadow-emerald-950/35",
        )
      : "border-rose-600 bg-rose-500 text-white shadow-sm dark:border-rose-600",
    isCurrent &&
      "ring-2 ring-sky-400 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-neutral-950",
  );
}

export function mount(root) {
  const reduceMotion = prefersReducedMotion();
  let stepIndex = 0;
  let isPlaying = false;
  let hasViewportAutoplayStarted = false;
  let resumeWhenVisibleAgain = false;
  let timer = 0;
  let cancelled = false;

  const windowBandEaseClass = reduceMotion
    ? ""
    : "duration-[380ms] ease-[cubic-bezier(0.33,1,0.68,1)] will-change-[left,width] motion-reduce:transition-none";
  const windowBandEdgeEaseClass = reduceMotion
    ? ""
    : "duration-[380ms] ease-[cubic-bezier(0.33,1,0.68,1)] will-change-[left] motion-reduce:transition-none";

  root.innerHTML = html`<div data-ref="container" class="flex min-h-0 w-full flex-1 items-stretch overflow-auto p-2 sm:p-3">
    <div class="${cardClass}">
      <div class="${cardHeaderClass}">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 space-y-1">
            <div class="${cardTitleClass}">Sliding window log</div>
            <p class="text-pretty text-neutral-600 text-xs leading-relaxed sm:text-sm dark:text-neutral-400">Only accepted requests are stored. Each arrival trims expired timestamps, then compares the log size to the limit.</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            ${badge("secondary", "font-mono text-[11px] sm:text-xs", `${LIMIT} req / ${WINDOW_SEC}s`)}
            ${badge("outline", "font-mono text-[11px] tabular-nums sm:text-xs", "", 'data-ref="nowBadge"')}
            ${badge("outline", "font-mono text-[11px] tabular-nums sm:text-xs", "", 'data-ref="rangeBadge"')}
          </div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-neutral-600 sm:text-xs dark:text-neutral-400">
          <span class="inline-flex items-center gap-1.5"><span class="size-2 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-1 ring-emerald-600/30"></span>Accepted (in window)</span>
          <span class="inline-flex items-center gap-1.5"><span class="size-2 shrink-0 rounded-full bg-emerald-500/35 ring-1 ring-emerald-500/40"></span>Accepted (outside window)</span>
          <span class="inline-flex items-center gap-1.5"><span class="size-2 shrink-0 rounded-full bg-rose-500 shadow-sm ring-1 ring-rose-600/40"></span>Denied</span>
          <span class="inline-flex items-center gap-1.5"><span class="h-3 w-0.5 shrink-0 rounded-full border border-sky-500/80 border-dashed bg-sky-400/25"></span>Window edge</span>
        </div>
      </div>
      <div class="${cardContentClass}">
        <div class="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <div class="relative mx-auto w-full min-w-[min(100%,300px)] max-w-2xl pb-6">
            <div
              class="rounded-xl border border-neutral-200 bg-white px-4 pt-8 pb-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-950"
              style="background-image: linear-gradient(to right, rgb(212 212 216 / 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgb(212 212 216 / 0.18) 1px, transparent 1px); background-position: ${TRACK_PAD_PCT}% 0, 0 0; background-size: ${TRACK_INNER_PCT / TIMELINE_MAX}% 100%, 100% 14px"
            >
              <div class="relative mx-auto h-[5.75rem] max-w-xl" role="presentation" aria-hidden="true">
                <div class="absolute bottom-11 h-px bg-neutral-300 dark:bg-neutral-700" style="left: ${TRACK_PAD_PCT}%; right: ${TRACK_PAD_PCT}%"></div>
                <div
                  data-ref="band"
                  class="${cn("pointer-events-none absolute bottom-14 h-[3.125rem] rounded-md bg-sky-500/10 ring-1 ring-sky-500/25 ring-inset transition-[left,width] dark:bg-sky-400/10 dark:ring-sky-400/30", windowBandEaseClass)}"
                ></div>
                <div data-ref="leftEdge" class="${cn("pointer-events-none absolute bottom-14 transition-[left]", windowBandEdgeEaseClass)}"><div class="${edgeLine}"></div></div>
                <div data-ref="rightEdge" class="${cn("pointer-events-none absolute bottom-14 transition-[left]", windowBandEdgeEaseClass)}"><div class="${edgeLine}"></div></div>
                ${TIMELINE_AXIS_SECONDS.map(
                  (
                    second,
                  ) => html`<div class="absolute bottom-9 flex w-0 flex-col items-center" style="left: ${trackLeftPct(second)}%; transform: translateX(-50%)">
                    <div class="h-2.5 w-px bg-neutral-400 dark:bg-neutral-500"></div>
                    <span class="mt-1.5 font-mono text-[10px] text-neutral-500 tabular-nums sm:text-[11px] dark:text-neutral-400">${second}</span>
                  </div>`,
                )}
                <div data-ref="attempts" class="contents"></div>
              </div>
              <p class="px-1 text-center font-mono text-[10px] text-neutral-500 sm:text-[11px] dark:text-neutral-400">Timeline axis (seconds) · shaded band = sliding window counted for this decision</p>
            </div>
          </div>
        </div>
        <div data-slot="separator-root" role="none" data-orientation="horizontal" class="${separatorClass}"></div>
        <div class="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <div data-ref="details" class="flex flex-col gap-3 lg:col-span-7"></div>
          <div class="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 lg:col-span-5 dark:border-neutral-800 dark:bg-neutral-950/60">
            <p class="font-medium font-mono text-neutral-700 text-xs sm:text-sm dark:text-neutral-200">Log (newest first)</p>
            <ul data-ref="log" class="flex flex-wrap gap-2" aria-label="Request log stamps"></ul>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100/70 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/55">
          ${button({ variant: "outline", size: "icon", className: "size-9 shrink-0", label: icon(ChevronLeft, "size-4"), attrs: 'data-ref="prev" aria-label="Previous step"' })}
          ${button({ variant: "outline", size: "icon", className: "size-9 shrink-0", label: icon(ChevronRight, "size-4"), attrs: 'data-ref="next" aria-label="Next step"' })}
          <button type="button" data-ref="play" class="${buttonClass({ variant: "secondary", size: "sm", className: "gap-1.5 px-4" })}"></button>
          ${button({ variant: "ghost", size: "sm", className: "gap-1.5", label: `${icon(RotateCcw, "size-4")}Reset`, attrs: 'data-ref="reset"' })}
          <span data-ref="stepLabel" class="ml-auto whitespace-nowrap font-mono text-[11px] text-neutral-600 tabular-nums sm:text-xs dark:text-neutral-400"></span>
        </div>
      </div>
    </div>
  </div>`;
  const el = refs(root);

  function schedule() {
    clearTimeout(timer);
    if (!isPlaying) {
      return;
    }
    if (stepIndex >= STEPS.length - 1) {
      isPlaying = false;
      render();
      return;
    }
    timer = setTimeout(() => {
      stepIndex += 1;
      update();
    }, 1250);
  }

  function update() {
    render();
    schedule();
  }

  function render() {
    const step = STEPS[Math.min(Math.max(stepIndex, 0), STEPS.length - 1)];
    const wStart = step.now - WINDOW_SEC;
    const wEnd = step.now;
    const attemptsVisible = ALL_ATTEMPTS.slice(0, stepIndex + 1);
    const vizStart = Math.max(0, wStart);
    const vizEnd = Math.min(TIMELINE_MAX, wEnd);
    const windowBandLeftPct = trackLeftPct(vizStart);
    const windowBandRightPct = trackLeftPct(vizEnd);
    const windowBandWidthPct = Math.max(0, windowBandRightPct - windowBandLeftPct);

    el.nowBadge.textContent = `now = ${step.now}s`;
    el.rangeBadge.textContent = `[${wStart}, ${wEnd}]`;
    el.band.style.left = `${windowBandLeftPct}%`;
    el.band.style.width = `${windowBandWidthPct}%`;
    el.leftEdge.style.left = `${windowBandLeftPct}%`;
    el.rightEdge.style.left = `${windowBandRightPct}%`;

    el.attempts.innerHTML = attemptsVisible
      .map((a, index) => {
        const inWindow = a.t > wStart && a.t <= wEnd;
        const isCurrent = a.t === step.incomingAt && index === attemptsVisible.length - 1;
        return html`<div class="absolute bottom-[2.45rem] flex flex-col items-center" style="left: ${trackLeftPct(a.t)}%; transform: translateX(-50%)">
          <span class="${attemptClass(a, inWindow, isCurrent)}" title="${a.allowed ? `t=${a.t} accepted` : `t=${a.t} denied`}">${a.t}</span>
        </div>`;
      })
      .join("");

    el.details.innerHTML = html`<div class="flex flex-wrap gap-2">
        ${badge(
          step.decision === "allow" ? "secondary" : "destructive",
          cn(
            "font-mono font-normal text-[11px]",
            step.decision === "allow"
              ? "bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100"
              : "",
          ),
          step.decision === "allow" ? "Accepted (logged)" : "Rejected (not logged)",
        )}
        ${badge("outline", "font-mono text-[11px] tabular-nums", `Log size after cleanup ${step.logAfterCleanup.length}`)}
      </div>
      <div>
        <h4 class="mb-1.5 font-semibold text-sm sm:text-base">${escapeHtml(step.title)}</h4>
        <p class="text-pretty text-neutral-600 text-xs leading-relaxed sm:text-sm dark:text-neutral-400">${escapeHtml(step.detail)}</p>
      </div>
      ${
        step.evicted.length > 0
          ? html`<p class="text-neutral-600 text-xs sm:text-sm dark:text-neutral-400">Removed from log: <span class="rounded bg-neutral-200 px-1 py-px font-mono tabular-nums dark:bg-neutral-800">${step.evicted.join(", ")}</span><span class="text-neutral-500"> · older than t−${WINDOW_SEC}</span></p>`
          : ""
      }`;

    const logDisplay = [...step.logAfter].reverse();
    el.log.innerHTML =
      logDisplay.length > 0
        ? logDisplay
            .map(
              (stamp) =>
                `<li class="rounded-md border border-emerald-500/35 bg-emerald-500/[0.07] px-2.5 py-1.5 font-mono text-emerald-950 text-sm tabular-nums tracking-tight dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-50">${stamp}</li>`,
            )
            .join("")
        : '<li class="text-neutral-500 text-sm dark:text-neutral-400">Empty</li>';

    el.prev.disabled = stepIndex <= 0;
    el.next.disabled = stepIndex >= STEPS.length - 1;
    el.play.innerHTML = isPlaying ? `${icon(Pause, "size-4")}Pause` : `${icon(Play, "size-4")}Play`;
    el.stepLabel.textContent = `Step ${stepIndex + 1} / ${STEPS.length}`;
  }

  el.prev.addEventListener("click", () => {
    resumeWhenVisibleAgain = false;
    stepIndex = Math.max(0, stepIndex - 1);
    update();
  });
  el.next.addEventListener("click", () => {
    resumeWhenVisibleAgain = false;
    stepIndex = Math.min(STEPS.length - 1, stepIndex + 1);
    update();
  });
  el.play.addEventListener("click", () => {
    if (isPlaying) {
      resumeWhenVisibleAgain = false;
    }
    isPlaying = !isPlaying;
    update();
  });
  el.reset.addEventListener("click", () => {
    resumeWhenVisibleAgain = false;
    stepIndex = 0;
    isPlaying = false;
    update();
  });

  const lastStep = STEPS.length - 1;
  const observer = new IntersectionObserver(
    (entries) => {
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        const entry = entries[0];
        if (!entry) {
          return;
        }
        if (!entry.isIntersecting) {
          if (isPlaying) {
            resumeWhenVisibleAgain = true;
          }
          isPlaying = false;
          update();
          return;
        }
        if (!hasViewportAutoplayStarted) {
          hasViewportAutoplayStarted = true;
          if (reduceMotion) {
            return;
          }
          stepIndex = 0;
          isPlaying = true;
          resumeWhenVisibleAgain = false;
          update();
          return;
        }
        if (reduceMotion) {
          return;
        }
        if (resumeWhenVisibleAgain && stepIndex < lastStep) {
          resumeWhenVisibleAgain = false;
          isPlaying = true;
          update();
          return;
        }
        resumeWhenVisibleAgain = false;
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
  );
  observer.observe(el.container);
  render();

  return {
    replay() {
      resumeWhenVisibleAgain = false;
      stepIndex = 0;
      isPlaying = false;
      update();
    },
    destroy() {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timer);
    },
  };
}
