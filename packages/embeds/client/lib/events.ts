export type ArrowDirection = -1 | 1;

export function isPlainLeftClick(event: MouseEvent): boolean {
  return !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey);
}

export function onArrowKey(
  target: HTMLElement,
  handler: (direction: ArrowDirection) => void,
  capture = false,
): void {
  target.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      handler(event.key === "ArrowLeft" ? -1 : 1);
    },
    capture,
  );
}
