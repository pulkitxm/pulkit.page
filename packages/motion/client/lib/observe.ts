const callbacks = new WeakMap<Element, (visible: boolean) => void>();

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      callbacks.get(entry.target)?.(entry.isIntersecting);
    }
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0 },
);

export function onVisible(element: Element, callback: (visible: boolean) => void): void {
  callbacks.set(element, callback);
  observer.observe(element);
}

export function revealOnce(element: HTMLElement): void {
  onVisible(element, (visible) => {
    if (visible) {
      element.dataset.in = "";
      observer.unobserve(element);
    }
  });
}
