import { escapeAttribute } from "@pulkit/shared/html";
import { Check } from "lucide";
import {
  type Cancel,
  closestTarget,
  expectElement,
  listenWindow,
  queryAll,
} from "../../lib/dom.ts";
import type { Scheduler } from "../../lib/scheduler.ts";
import { cn, icon } from "../../runtime/ui.ts";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectOptions {
  trigger: HTMLButtonElement;
  options: readonly SelectOption[];
  value: string;
  scheduler: Scheduler;
  onValueChange: (value: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface OpenMenu {
  wrapper: HTMLDivElement;
  content: HTMLDivElement;
  stopListening: Cancel;
}

export const triggerClass = cn(
  "flex h-11 w-fit cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-md",
  "border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
  "transition-[color,box-shadow]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  "motion-reduce:transition-none",
  "data-placeholder:text-muted-foreground",
  "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
  "dark:bg-input/30 dark:hover:bg-input/50",
  "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
  "h-9 w-full",
);

const contentClass = cn(
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-10001 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) cursor-pointer overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
  "data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
);

const viewportClass = cn(
  "p-1",
  "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width) scroll-my-1",
);

const itemClass =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2";

export const presenceStyles =
  "@keyframes select-enter{from{opacity:0;transform:translate3d(0,var(--select-enter-y,0),0) scale3d(.95,.95,.95)}}@keyframes select-exit{to{opacity:0;transform:translate3d(0,var(--select-enter-y,0),0) scale3d(.95,.95,.95)}}[data-select-content][data-state=open]{animation:select-enter .15s ease}[data-select-content][data-state=closed]{animation:select-exit .15s ease}[data-select-content][data-side=bottom]{--select-enter-y:-.5rem}[data-select-content][data-side=top]{--select-enter-y:.5rem}";

const keyMoves: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
const openKeys = ["Enter", " ", "ArrowDown", "ArrowUp"];

function optionMarkup(option: SelectOption, selected: string | undefined): string {
  const checked = option.value === selected;
  return `<div role="option" data-slot="select-item" data-value="${escapeAttribute(option.value)}" aria-selected="${checked}" data-state="${checked ? "checked" : "unchecked"}" tabindex="-1" class="${itemClass}"><span class="absolute right-2 flex size-3.5 items-center justify-center">${checked ? `<span aria-hidden="true">${icon(Check, "size-4")}</span>` : ""}</span><span>${escapeAttribute(option.label)}</span></div>`;
}

function menuHost(trigger: Element): ParentNode {
  const host = trigger.getRootNode();
  return host instanceof ShadowRoot ? host : document.body;
}

export function createSelect({
  trigger,
  options,
  value,
  scheduler,
  onValueChange,
}: SelectOptions): Cancel {
  let menu: OpenMenu | undefined;
  let pointerStart: Point | undefined;
  let highlighted = -1;

  function place({ wrapper, content }: OpenMenu) {
    const rect = trigger.getBoundingClientRect();
    const below = innerHeight - rect.bottom;
    const above = rect.top;
    const height = content.offsetHeight;
    const side = height > below && above > below ? "top" : "bottom";
    const y = side === "bottom" ? rect.bottom : rect.top - height;
    wrapper.style.transform = `translate(${rect.left}px, ${y}px)`;
    content.dataset.side = side;
    content.style.setProperty("--radix-select-trigger-width", `${rect.width}px`);
    content.style.setProperty("--radix-select-trigger-height", `${rect.height}px`);
    content.style.setProperty(
      "--radix-select-content-available-height",
      `${side === "bottom" ? below : above}px`,
    );
    content.style.setProperty(
      "--radix-select-content-transform-origin",
      side === "bottom" ? "0% 0px" : "0% 100%",
    );
  }

  function items(): HTMLDivElement[] {
    return menu ? queryAll(menu.content, "[role=option]", HTMLDivElement) : [];
  }

  function highlight(index: number) {
    const list = items();
    highlighted = Math.max(0, Math.min(list.length - 1, index));
    for (const [position, item] of list.entries()) {
      if (position === highlighted) {
        item.dataset.highlighted = "";
        item.focus({ preventScroll: true });
      } else {
        delete item.dataset.highlighted;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const move = keyMoves[event.key];
    if (move !== undefined) {
      highlight(highlighted + move);
    } else if (event.key === "Home") {
      highlight(0);
    } else if (event.key === "End") {
      highlight(items().length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      select(items()[highlighted]?.dataset.value);
    } else if (event.key === "Escape" || event.key === "Tab") {
      close();
    } else {
      return;
    }
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent) {
    const item = closestTarget(event, "[role=option]", HTMLDivElement);
    if (!item) {
      return;
    }
    if (
      pointerStart &&
      Math.abs(event.clientX - pointerStart.x) <= 10 &&
      Math.abs(event.clientY - pointerStart.y) <= 10
    ) {
      pointerStart = undefined;
      return;
    }
    select(item.dataset.value);
  }

  function listen(content: HTMLDivElement): Cancel {
    content.addEventListener("pointermove", (event) => {
      const item = closestTarget(event, "[role=option]", HTMLDivElement);
      if (item) {
        highlight(items().indexOf(item));
      }
    });
    content.addEventListener("pointerleave", () => menu?.content.focus({ preventScroll: true }));
    content.addEventListener("pointerup", onPointerUp);
    content.addEventListener("pointerdown", () => {
      pointerStart = undefined;
    });
    content.addEventListener("keydown", onKeyDown);
    const cancels = [
      listenWindow("pointerdown", outside, { capture: true }),
      listenWindow("resize", close),
      listenWindow("scroll", reposition, { capture: true }),
    ];
    return () => {
      for (const cancel of cancels) {
        cancel();
      }
    };
  }

  function open(fromPointer: Point | undefined) {
    if (menu) {
      return;
    }
    trigger.dataset.state = "open";
    trigger.setAttribute("aria-expanded", "true");
    const wrapper = document.createElement("div");
    wrapper.dataset.radixPopperContentWrapper = "";
    wrapper.style.cssText =
      "position: fixed; left: 0px; top: 0px; min-width: max-content; z-index: 10001;";
    wrapper.innerHTML = `<div role="listbox" data-select-content data-slot="select-content" data-state="open" data-side="bottom" data-align="start" dir="ltr" tabindex="-1" class="${contentClass}" style="box-sizing: border-box; display: flex; flex-direction: column; outline: none; pointer-events: auto;"><div role="presentation" data-radix-select-viewport class="${viewportClass}" style="position: relative; flex: 1 1 0%; overflow: hidden auto;">${options
      .map((option) => optionMarkup(option, trigger.dataset.value))
      .join("")}</div></div>`;
    const content = expectElement(wrapper.firstElementChild, HTMLDivElement);
    menuHost(trigger).append(wrapper);
    menu = { wrapper, content, stopListening: () => {} };
    place(menu);
    highlight(
      Math.max(
        0,
        items().findIndex((item) => item.dataset.state === "checked"),
      ),
    );
    pointerStart = fromPointer;
    menu.stopListening = listen(content);
  }

  function reposition() {
    if (menu) {
      place(menu);
    }
  }

  function outside(event: PointerEvent) {
    if (!event.composedPath().some((node) => node === menu?.wrapper || node === trigger)) {
      close();
    }
  }

  function select(next: string | undefined) {
    if (next === undefined) {
      return;
    }
    const changed = next !== trigger.dataset.value;
    trigger.dataset.value = next;
    close();
    if (changed) {
      onValueChange(next);
    }
  }

  function close() {
    if (!menu) {
      return;
    }
    const { wrapper, content, stopListening } = menu;
    menu = undefined;
    stopListening();
    trigger.dataset.state = "closed";
    trigger.setAttribute("aria-expanded", "false");
    content.dataset.state = "closed";
    content.style.pointerEvents = "none";
    content.addEventListener("animationend", () => wrapper.remove(), { once: true });
    scheduler.later(() => wrapper.remove(), 300);
    trigger.focus({ preventScroll: true });
  }

  trigger.dataset.value = value;
  trigger.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.ctrlKey) {
      return;
    }
    if (event.pointerType === "mouse") {
      event.preventDefault();
      if (menu) {
        close();
      } else {
        trigger.focus({ preventScroll: true });
        open({ x: event.clientX, y: event.clientY });
      }
    }
  });
  trigger.addEventListener("click", (event) => {
    if (event.pointerType && event.pointerType !== "mouse" && !menu) {
      open(undefined);
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (openKeys.includes(event.key)) {
      event.preventDefault();
      open(undefined);
    }
  });

  return () => {
    if (menu) {
      menu.stopListening();
      menu.wrapper.remove();
      menu = undefined;
    }
  };
}
