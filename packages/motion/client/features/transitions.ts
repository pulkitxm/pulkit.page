const key = "page-origin";

export function startTransitions(): void {
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement) || link.origin !== globalThis.location.origin) {
      return;
    }
    const x = event.detail > 0 ? event.clientX : globalThis.innerWidth / 2;
    const y = event.detail > 0 ? event.clientY : globalThis.innerHeight / 2;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ x: x / globalThis.innerWidth, y: y / globalThis.innerHeight }),
      );
    } catch {}
  });
}
