import {
  Check,
  Code,
  Copy,
  Eye,
  GripVertical,
  Menu,
  RotateCw,
  SidebarClose,
  SidebarOpen,
  WrapText,
} from "lucide";
import { button, cn, escapeHtml, icon } from "./ui.js";

const fullHeightClass = "min-h-[min(92svh,52rem)] h-[min(92svh,52rem)]";
const minCodeWidth = 200;
const minPreviewWidth = 200;
const wrapKey = "code-wrap-enabled";
const wrapListeners = new Set();

function readWrap() {
  try {
    return JSON.parse(localStorage.getItem(wrapKey) ?? "false") === true;
  } catch {
    return false;
  }
}

function writeWrap(value) {
  try {
    localStorage.setItem(wrapKey, JSON.stringify(value));
  } catch {}
  for (const listener of wrapListeners) {
    listener(value);
  }
}

function tabs(id) {
  const tab = (key, label, node, index) =>
    `<button type="button" role="tab" id="tab-${key}-${id}" data-tab="${key}" data-index="${index}" class="px-3 py-2 text-sm z-10 inline-flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none">${icon(node, "mr-2 h-4 w-4")}<span class="hidden sm:inline">${label}</span><span class="sm:hidden">${label}</span></button>`;
  return `<div class="border-(--frame-border) border-b p-1.5 lg:hidden [&>div]:mb-0"><div class="relative mb-6"><div role="tablist" aria-label="Tabs" class="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">${tab("code", "Code", Code, 0)}${tab("preview", "Preview", Eye, 1)}<div data-ref="indicator" class="absolute inset-y-1 left-1 z-0 rounded-md border border-border bg-card shadow-sm transition-transform ease-out motion-reduce:transition-none" style="width: calc(50% - 2px)"></div></div></div></div>`;
}

function replayButton(className, variant = "ghost") {
  return button({
    variant,
    size: "icon",
    className: cn("rounded-none", className),
    label: icon(RotateCw, "size-4"),
    attrs: 'data-action="replay" title="Replay animation"',
  });
}

function linkFiles(markup, filenames) {
  if (!markup || filenames.length <= 1) {
    return markup;
  }
  let result = markup;
  for (const filename of filenames) {
    const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const base = filename.replace(/\.[^.]+$/, "");
    const patterns =
      base === filename
        ? [escapePattern(filename)]
        : [escapePattern(filename), escapePattern(base)];
    for (const pattern of patterns) {
      result = result.replace(
        new RegExp(`(?<=>)([^<]*?)(${pattern})([^<]*?)(?=<)`, "g"),
        (_, before, match, after) =>
          `${before}<span class="file-link" data-filename="${filename}">${match}</span>${after}`,
      );
    }
  }
  return result;
}

export function mountFrame(shadow, { frame, files, id }) {
  const hasFiles = files.length > 0;
  const heightClass = frame.fullHeight
    ? fullHeightClass
    : cn("h-80", frame.bitBigger ? "sm:h-102 lg:h-128" : "sm:h-96 lg:h-112");
  const fileButtons = files
    .map((file, index) =>
      button({
        variant: index === 0 ? "secondary" : "ghost",
        className:
          "whitespace-nowrap rounded-none border-(--frame-border) border-r font-mono text-xs",
        label: escapeHtml(file.filename),
        attrs: `data-file="${index}"`,
      }),
    )
    .join("");
  const codePanel = hasFiles
    ? `<div data-ref="code" class="relative h-full min-w-0 border-(--frame-border) border-b bg-(--code-bg) lg:border-b-0"><div class="flex w-full flex-1 flex-col overflow-hidden"><div class="flex items-center justify-between border-(--frame-border) border-b"><div class="flex flex-1 items-center overflow-hidden">${button({ variant: "ghost", size: "icon", className: "hidden shrink-0 rounded-none border-(--frame-border) border-r lg:flex", label: icon(SidebarClose, "size-4"), attrs: 'data-action="hide-code" title="Hide code panel"' })}<div class="flex w-full items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">${fileButtons}</div></div><div class="flex shrink-0 items-center">${button({ variant: "ghost", size: "icon", className: "rounded-none border-l-2", label: `${icon(WrapText, "size-4")}${icon(Menu, "size-4")}`, attrs: 'data-action="wrap"' })}${button({ variant: "ghost", size: "icon", className: "rounded-none border-l-2", label: `${icon(Check, "size-4")}${icon(Copy, "size-4")}`, attrs: 'data-action="copy" title="Copy code"' })}</div></div><div data-ref="scroller" tabindex="0" class="flex-1 overflow-auto p-4 [scrollbar-width:none]"><div data-ref="highlighted"></div></div></div></div>`
    : "";
  const previewBar = hasFiles
    ? `<div class="hidden items-center justify-between border-(--frame-border) border-b lg:flex">${button({ variant: "ghost", size: "icon", className: "rounded-none transition-none", label: icon(SidebarOpen, "size-4"), attrs: 'data-action="show-code" title="Show code"' })}${frame.replayButton ? replayButton("rounded-none") : ""}</div>`
    : "";
  shadow.innerHTML = `<div class="relative my-6 overflow-hidden rounded-md border border-(--frame-border) bg-(--frame-bg)">${frame.replayButton && !hasFiles ? replayButton("absolute right-4 bottom-4 z-2 rounded-md", "secondary") : ""}${hasFiles ? tabs(id) : ""}<div data-ref="container" class="${cn("flex flex-col lg:flex-row", heightClass)}">${codePanel}<button type="button" data-ref="handle" aria-label="Resize panels" class="group hidden h-full w-6 cursor-col-resize items-center justify-center border-(--frame-border) border-l hover:bg-(--handle-hover)">${icon(GripVertical, "size-4 text-(--grip) group-hover:text-(--grip-hover)")}</button><div data-ref="previewColumn">${previewBar}<div data-ref="preview" class="${cn("relative flex flex-1 overflow-auto", frame.fullHeight ? "min-h-0 items-stretch" : "items-center justify-center")}"></div></div></div></div>`;

  const find = (name) => shadow.querySelector(`[data-ref="${name}"]`);
  const container = find("container");
  const code = find("code");
  const handle = find("handle");
  const previewColumn = find("previewColumn");
  const state = {
    expanded: false,
    desktop: true,
    width: 50,
    active: 0,
    wrap: readWrap(),
    copied: false,
    modifier: false,
  };
  const filenames = files.map((file) => file.filename);

  function renderCode() {
    if (!hasFiles) {
      return;
    }
    const file = files[state.active] ?? files[0];
    const highlighted = find("highlighted");
    highlighted.className = cn(
      "text-(--site-fg) [&_pre]:m-0",
      state.wrap &&
        "[&_code]:wrap-break-word [&_pre]:wrap-break-word [&_code]:whitespace-pre-wrap [&_pre]:whitespace-pre-wrap",
      state.modifier && "[&_.file-link:hover]:underline [&_.file-link]:cursor-pointer",
    );
    highlighted.innerHTML = linkFiles(file.html, filenames);
    for (const [index, element] of shadow.querySelectorAll("[data-file]").entries()) {
      element.className = cn(
        button({ variant: index === state.active ? "secondary" : "ghost" }).match(
          /class="([^"]*)"/,
        )[1],
        "whitespace-nowrap rounded-none border-(--frame-border) border-r font-mono text-xs",
      );
    }
  }

  function render() {
    if (hasFiles) {
      code.className = cn(
        "relative h-full min-w-0 border-(--frame-border) border-b bg-(--code-bg) lg:border-b-0",
        !state.expanded && "hidden",
        state.expanded && "flex flex-col lg:border-r",
      );
      code.style.flex = state.expanded && state.desktop ? `0 0 ${state.width}%` : "";
      const selected = state.expanded ? 0 : 1;
      for (const tab of shadow.querySelectorAll("[data-tab]")) {
        const active = Number(tab.dataset.index) === selected;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        tab.classList.toggle("text-foreground", active);
        tab.classList.toggle("text-muted-foreground", !active);
      }
      find("indicator").style.transform = `translateX(${selected * 100}%)`;
      const show = shadow.querySelector('[data-action="show-code"]');
      show.classList.toggle("pointer-events-none", state.expanded);
      show.classList.toggle("opacity-0", state.expanded);
      const [wrapIcon, menuIcon] = shadow
        .querySelector('[data-action="wrap"]')
        .querySelectorAll("svg");
      wrapIcon.classList.toggle("hidden", !state.wrap);
      menuIcon.classList.toggle("hidden", state.wrap);
      shadow.querySelector('[data-action="wrap"]').title = state.wrap
        ? "Disable word wrap"
        : "Enable word wrap";
      const [checkIcon, copyIcon] = shadow
        .querySelector('[data-action="copy"]')
        .querySelectorAll("svg");
      checkIcon.classList.toggle("hidden", !state.copied);
      copyIcon.classList.toggle("hidden", state.copied);
    }
    handle.className = cn(
      "group hidden h-full w-6 cursor-col-resize items-center justify-center border-(--frame-border) border-l hover:bg-(--handle-hover)",
      state.expanded ? "lg:flex" : "lg:hidden",
    );
    previewColumn.className = cn(
      "flex h-full flex-1 flex-col",
      state.expanded && "hidden lg:flex",
      !state.expanded && "flex",
    );
    renderCode();
  }

  function measure() {
    state.desktop = innerWidth >= 1024;
    state.expanded = innerWidth >= 1200 && hasFiles && frame.focusCode;
    render();
  }

  addEventListener("resize", measure);
  const onWrap = (value) => {
    state.wrap = value;
    render();
  };
  wrapListeners.add(onWrap);
  measure();

  shadow.addEventListener("click", async (event) => {
    const target = event.target;
    const tab = target.closest("[data-tab]");
    if (tab) {
      state.expanded = tab.dataset.tab === "code";
      render();
      return;
    }
    const file = target.closest("[data-file]");
    if (file) {
      state.active = Number(file.dataset.file);
      render();
      return;
    }
    const link = target.closest(".file-link");
    if (link && (event.ctrlKey || event.metaKey)) {
      const index = filenames.indexOf(link.dataset.filename);
      if (index !== -1) {
        state.active = index;
        render();
      }
      return;
    }
    const action = target.closest("[data-action]")?.dataset.action;
    if (action === "hide-code") {
      state.expanded = false;
      render();
    } else if (action === "show-code") {
      state.expanded = !state.expanded;
      render();
    } else if (action === "wrap") {
      writeWrap(!state.wrap);
    } else if (action === "copy") {
      try {
        await navigator.clipboard.writeText(files[state.active].code);
        state.copied = true;
        render();
        setTimeout(() => {
          state.copied = false;
          render();
        }, 2000);
      } catch {}
    }
  });

  shadow.addEventListener("keydown", (event) => {
    const tab = event.target.closest?.("[data-tab]");
    if (!tab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
      return;
    }
    event.preventDefault();
    state.expanded = !state.expanded;
    render();
    setTimeout(
      () => shadow.querySelector(`[data-tab="${state.expanded ? "code" : "preview"}"]`)?.focus(),
      0,
    );
  });

  const modifierDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && !state.modifier) {
      state.modifier = true;
      renderCode();
    }
  };
  const modifierUp = (event) => {
    if (!(event.ctrlKey || event.metaKey) && state.modifier) {
      state.modifier = false;
      renderCode();
    }
  };
  const blur = () => {
    if (state.modifier) {
      state.modifier = false;
      renderCode();
    }
  };
  if (files.length > 1) {
    addEventListener("keydown", modifierDown);
    addEventListener("keyup", modifierUp);
    addEventListener("blur", blur);
  }

  handle.addEventListener("mousedown", () => {
    const move = (event) => {
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

  return find("preview");
}
