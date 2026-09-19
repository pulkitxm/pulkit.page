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
document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("[data-theme-toggle]");
  button?.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {}
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
