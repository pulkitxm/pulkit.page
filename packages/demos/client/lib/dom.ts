export type ElementType<T extends Element> = abstract new (...args: never[]) => T;
export type Cancel = () => void;

export function expectElement<T extends Element>(value: unknown, type: ElementType<T>): T {
  if (!(value instanceof type)) {
    throw new TypeError(`Expected a ${type.name}`);
  }
  return value;
}

function optionalQuery<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementType<T>,
): T | undefined {
  const element = root.querySelector(selector);
  if (element === null) {
    return undefined;
  }
  if (!(element instanceof type)) {
    throw new TypeError(`"${selector}" is not a ${type.name}`);
  }
  return element;
}

export function query<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementType<T>,
): T {
  const element = optionalQuery(root, selector, type);
  if (element === undefined) {
    throw new Error(`Missing element "${selector}"`);
  }
  return element;
}

export function optionalRef<T extends Element>(
  root: ParentNode,
  name: string,
  type: ElementType<T>,
): T | undefined {
  return optionalQuery(root, `[data-ref="${name}"]`, type);
}

export function ref<T extends Element>(root: ParentNode, name: string, type: ElementType<T>): T {
  return query(root, `[data-ref="${name}"]`, type);
}

export function queryAll<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementType<T>,
): T[] {
  return [...root.querySelectorAll(selector)].filter(
    (element): element is T => element instanceof type,
  );
}

export function closestTarget<T extends Element>(
  event: Event,
  selector: string,
  type: ElementType<T>,
): T | undefined {
  const target = event.target;
  const element = target instanceof Element ? target.closest(selector) : null;
  return element instanceof type ? element : undefined;
}

export function listenWindow<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): Cancel {
  globalThis.addEventListener(type, handler, options);
  return () => globalThis.removeEventListener(type, handler, options);
}

export function remount<T extends Element>(element: T, type: ElementType<T>): T {
  const fresh = element.cloneNode(false);
  if (!(fresh instanceof type)) {
    throw new TypeError(`Cloned element is not a ${type.name}`);
  }
  fresh.removeAttribute("style");
  element.replaceWith(fresh);
  return fresh;
}
