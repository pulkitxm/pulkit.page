type ElementClass<T extends Element> = new () => T;

export function forEachElement<T extends Element>(
  selector: string,
  type: ElementClass<T>,
  setup: (element: T) => void,
): void {
  for (const element of document.querySelectorAll(selector)) {
    if (element instanceof type) {
      setup(element);
    }
  }
}

export function findElements<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementClass<T>,
): T[] {
  return [...root.querySelectorAll(selector)].filter(
    (element): element is T => element instanceof type,
  );
}

export function findElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementClass<T>,
): T | undefined {
  const element = root.querySelector(selector);
  return element instanceof type ? element : undefined;
}

export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementClass<T>,
): T {
  const element = findElement(root, selector, type);
  if (!element) {
    throw new Error(`Missing ${selector}`);
  }
  return element;
}
