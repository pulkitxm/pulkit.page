declare global {
  interface EventMap {
    pageswap: PageSwapEvent;
    pagereveal: PageRevealEvent;
  }
}

const themeKey = "portfolio-theme";
let selectedTheme: string | null = null;
try {
  selectedTheme = localStorage.getItem(themeKey);
} catch {}
if (selectedTheme === "light" || selectedTheme === "dark") {
  document.documentElement.dataset.theme = selectedTheme;
}
function navigationType(): string | undefined {
  const [entry] = performance.getEntriesByType("navigation");
  return entry instanceof PerformanceNavigationTiming ? entry.type : undefined;
}
try {
  const arrivedFromOtherSite =
    document.referrer &&
    new URL(document.referrer).origin !== globalThis.location.origin &&
    navigationType() === "navigate";
  if (arrivedFromOtherSite) {
    document.documentElement.dataset.entry = "cross-site";
  }
} catch {}
let chosenTheme: string | null = null;
function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeKey, theme);
  } catch {}
}
function nextTheme(root: HTMLElement): string {
  const current =
    chosenTheme ??
    root.dataset.theme ??
    (globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return current === "dark" ? "light" : "dark";
}
function wipeOrigin(button: Element, event: Event): { x: number; y: number } {
  if (event instanceof MouseEvent && event.detail > 0) {
    return { x: event.clientX, y: event.clientY };
  }
  const box = button.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}
document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("[data-theme-toggle]");
  button?.addEventListener("click", (event) => {
    const root = document.documentElement;
    const theme = nextTheme(root);
    chosenTheme = theme;
    if (
      !document.startViewTransition ||
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      applyTheme(theme);
      return;
    }
    const { x, y } = wipeOrigin(button, event);
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty(
      "--theme-radius",
      `${Math.hypot(Math.max(x, globalThis.innerWidth - x), Math.max(y, globalThis.innerHeight - y))}px`,
    );
    root.dataset.themeChange = "";
    const transition = document.startViewTransition(() => applyTheme(theme));
    const clear = () => {
      delete root.dataset.themeChange;
    };
    transition.finished.then(clear, clear);
  });
});

function entryTransition(
  event: PageSwapEvent | PageRevealEvent,
  otherUrl: string | null | undefined,
) {
  const transition = event.viewTransition;
  if (!transition) {
    return;
  }
  const ignore = () => {};
  transition.ready.catch(ignore);
  transition.finished.catch(ignore);
  if (!otherUrl || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    transition.skipTransition();
    return;
  }
  const current = new URL(globalThis.location.href);
  const other = new URL(otherUrl);
  const titles = [...document.querySelectorAll<HTMLElement>("[data-title]")];
  const title =
    titles.find((candidate) => candidate.closest("a")?.href === other.href) ??
    (current.pathname.startsWith(other.pathname)
      ? titles.find((candidate) => candidate.tagName === "H1")
      : null);
  if (current.origin !== other.origin || current.pathname === other.pathname || !title) {
    transition.skipTransition();
    return;
  }
  title.style.viewTransitionName = "entry-title";
  const clear = () => title.style.removeProperty("view-transition-name");
  const captured = event.type === "pageswap" ? transition.finished : transition.ready;
  captured.then(clear, clear);
}

globalThis.addEventListener("pageswap", (event) => {
  entryTransition(event, event.activation?.entry?.url);
});
globalThis.addEventListener("pagereveal", (event) => {
  entryTransition(event, globalThis.navigation?.activation?.from?.url);
});
