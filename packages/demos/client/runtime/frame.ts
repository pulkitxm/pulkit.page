import { readStoredJson, writeStoredJson } from "@pulkit/shared/storage";
import { createCopyFeedback } from "../lib/clipboard.ts";
import { closestTarget, queryAll, ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import type { FrameOptions, HighlightedSource } from "../types.ts";
import {
  codeHeightClass,
  fileButtonClass,
  frameMarkup,
  handleClass,
  linkFiles,
} from "./frame-markup.ts";
import { buttonClass, cn } from "./ui.ts";

const minCodeWidth = 200;
const minPreviewWidth = 200;
const wrapKey = "code-wrap-enabled";
const wrapListeners = new Set<(value: boolean) => void>();
const desktopQuery = matchMedia("(min-width: 1024px)");
const wideQuery = matchMedia("(min-width: 1200px)");

export interface FrameMount {
  frame: FrameOptions;
  files: readonly HighlightedSource[];
  id: number;
}

export interface Frame {
  preview: HTMLElement;
  destroy(): void;
}

function readWrap(): boolean {
  return readStoredJson(wrapKey) === true;
}

function writeWrap(value: boolean): void {
  writeStoredJson(wrapKey, value);
  for (const listener of wrapListeners) {
    listener(value);
  }
}

function swapIcons(button: Element, showFirst: boolean): void {
  const [first, second] = button.querySelectorAll("svg");
  first?.classList.toggle("hidden", !showFirst);
  second?.classList.toggle("hidden", showFirst);
}

export function mountFrame(shadow: ShadowRoot, { frame, files, id }: FrameMount): Frame {
  const hasFiles = files.length > 0;
  shadow.innerHTML = frameMarkup(frame, files, id);
  const container = ref(shadow, "container", HTMLElement);
  const handle = ref(shadow, "handle", HTMLButtonElement);
  const previewColumn = ref(shadow, "previewColumn", HTMLElement);
  const state = {
    expanded: false,
    desktop: true,
    width: 50,
    active: 0,
    wrap: readWrap(),
    modifier: false,
  };
  const filenames = files.map((file) => file.filename);
  const scheduler = createScheduler();
  const clipboard = createCopyFeedback(scheduler, () => render());

  function renderCode() {
    if (!hasFiles) {
      return;
    }
    const file = files[state.active] ?? files[0];
    const highlighted = ref(shadow, "highlighted", HTMLElement);
    highlighted.className = cn(
      "text-(--site-fg) [&_pre]:m-0",
      state.wrap &&
        "[&_code]:wrap-break-word [&_pre]:wrap-break-word [&_code]:whitespace-pre-wrap [&_pre]:whitespace-pre-wrap",
      state.modifier && "[&_.file-link:hover]:underline [&_.file-link]:cursor-pointer",
    );
    highlighted.innerHTML = linkFiles(file?.html ?? "", filenames);
    for (const [index, element] of queryAll(shadow, "[data-file]", HTMLElement).entries()) {
      element.className = cn(
        buttonClass({ variant: index === state.active ? "secondary" : "ghost" }),
        fileButtonClass,
      );
    }
  }

  function renderCodePanel() {
    const code = ref(shadow, "code", HTMLElement);
    code.className = cn(
      "relative min-w-0 border-(--frame-border) border-b bg-(--code-bg) lg:border-b-0",
      codeHeightClass(frame),
      !state.expanded && "hidden",
      state.expanded && "flex flex-col lg:border-r",
    );
    code.style.flex = state.expanded && state.desktop ? `0 0 ${state.width}%` : "";
    const selected = state.expanded ? 0 : 1;
    for (const tab of queryAll(shadow, "[data-tab]", HTMLElement)) {
      const active = Number(tab.dataset.index) === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("text-foreground", active);
      tab.classList.toggle("text-muted-foreground", !active);
    }
    ref(shadow, "indicator", HTMLElement).style.transform = `translateX(${selected * 100}%)`;
    const show = closestAction("show-code");
    show.classList.toggle("pointer-events-none", state.expanded);
    show.classList.toggle("opacity-0", state.expanded);
    const wrap = closestAction("wrap");
    swapIcons(wrap, state.wrap);
    wrap.title = state.wrap ? "Disable word wrap" : "Enable word wrap";
    swapIcons(closestAction("copy"), clipboard.copied);
  }

  function closestAction(action: string): HTMLElement {
    const [element] = queryAll(shadow, `[data-action="${action}"]`, HTMLElement);
    if (element === undefined) {
      throw new Error(`Missing frame action "${action}"`);
    }
    return element;
  }

  function render() {
    if (hasFiles) {
      renderCodePanel();
    }
    handle.className = cn(handleClass, state.expanded ? "lg:flex" : "lg:hidden");
    previewColumn.className = cn(
      "flex h-full flex-1 flex-col",
      state.expanded && "hidden lg:flex",
      !state.expanded && "flex",
    );
    renderCode();
  }

  function measure() {
    state.desktop = desktopQuery.matches;
    state.expanded = wideQuery.matches && hasFiles && frame.focusCode;
    render();
  }

  desktopQuery.addEventListener("change", measure);
  wideQuery.addEventListener("change", measure);
  scheduler.add(() => desktopQuery.removeEventListener("change", measure));
  scheduler.add(() => wideQuery.removeEventListener("change", measure));
  const onWrap = (value: boolean) => {
    state.wrap = value;
    render();
  };
  wrapListeners.add(onWrap);
  scheduler.add(() => wrapListeners.delete(onWrap));
  measure();

  function selectFile(index: number) {
    state.active = index;
    render();
  }

  function onClick(event: Event) {
    const tab = closestTarget(event, "[data-tab]", HTMLElement);
    if (tab) {
      state.expanded = tab.dataset.tab === "code";
      render();
      return;
    }
    const file = closestTarget(event, "[data-file]", HTMLElement);
    if (file) {
      selectFile(Number(file.dataset.file));
      return;
    }
    const link = closestTarget(event, ".file-link", HTMLElement);
    if (link && event instanceof MouseEvent && (event.ctrlKey || event.metaKey)) {
      const index = filenames.indexOf(link.dataset.filename ?? "");
      if (index !== -1) {
        selectFile(index);
      }
      return;
    }
    const action = closestTarget(event, "[data-action]", HTMLElement)?.dataset.action;
    if (action === "hide-code") {
      state.expanded = false;
      render();
    } else if (action === "show-code") {
      state.expanded = !state.expanded;
      render();
    } else if (action === "wrap") {
      writeWrap(!state.wrap);
    } else if (action === "copy") {
      const source = files[state.active];
      if (source) {
        void clipboard.copy(source.code);
      }
    }
  }

  function onKeydown(event: Event) {
    const tab = closestTarget(event, "[data-tab]", HTMLElement);
    if (
      !(tab && event instanceof KeyboardEvent) ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }
    event.preventDefault();
    state.expanded = !state.expanded;
    render();
    scheduler.later(() => {
      const [next] = queryAll(
        shadow,
        `[data-tab="${state.expanded ? "code" : "preview"}"]`,
        HTMLElement,
      );
      next?.focus();
    }, 0);
  }

  shadow.addEventListener("click", onClick);
  shadow.addEventListener("keydown", onKeydown);
  scheduler.add(() => shadow.removeEventListener("click", onClick));
  scheduler.add(() => shadow.removeEventListener("keydown", onKeydown));

  function setModifier(value: boolean) {
    if (state.modifier !== value) {
      state.modifier = value;
      renderCode();
    }
  }
  const modifierDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      setModifier(true);
    }
  };
  const modifierUp = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) {
      setModifier(false);
    }
  };
  const blur = () => setModifier(false);
  if (files.length > 1) {
    globalThis.addEventListener("keydown", modifierDown);
    globalThis.addEventListener("keyup", modifierUp);
    globalThis.addEventListener("blur", blur);
    scheduler.add(() => globalThis.removeEventListener("keydown", modifierDown));
    scheduler.add(() => globalThis.removeEventListener("keyup", modifierUp));
    scheduler.add(() => globalThis.removeEventListener("blur", blur));
  }

  handle.addEventListener("mousedown", () => {
    const move = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const next = ((event.clientX - rect.left) / rect.width) * 100;
      const min = (minCodeWidth / rect.width) * 100;
      const max = 100 - (minPreviewWidth / rect.width) * 100;
      state.width = Math.min(Math.max(next, min), max);
      render();
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  return {
    preview: ref(shadow, "preview", HTMLElement),
    destroy() {
      scheduler.dispose();
    },
  };
}
