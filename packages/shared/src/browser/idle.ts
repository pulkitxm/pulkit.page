export function afterPageLoad(callback: () => void): void {
  const ready = () => {
    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(callback, { timeout: 1000 });
    } else {
      setTimeout(callback, 0);
    }
  };
  if (document.readyState === "complete") {
    ready();
  } else {
    globalThis.addEventListener("load", ready, { once: true });
  }
}
