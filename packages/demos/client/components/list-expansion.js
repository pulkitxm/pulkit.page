import { ArrowLeft, ChevronRight, FileText, FolderOpen, Image, Music } from "lucide";
import { animate } from "motion";
import { button, cn, html, icon, refs } from "../runtime/ui.ts";

const items = [
  {
    color: "bg-blue-500",
    description: "23 files, 1.2 GB",
    icon: FileText,
    id: 1,
    title: "Documents",
  },
  { color: "bg-green-500", description: "847 files, 4.8 GB", icon: Image, id: 2, title: "Photos" },
  { color: "bg-purple-500", description: "156 files, 2.1 GB", icon: Music, id: 3, title: "Music" },
  { color: "bg-orange-500", description: "12 folders", icon: FolderOpen, id: 4, title: "Projects" },
];

const fade = { duration: 0.1 };

function detailView(item) {
  return html`<div class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-neutral-200 border-b p-3 dark:border-neutral-700">
      ${button({ variant: "ghost", size: "icon", className: "size-7 cursor-pointer", label: icon(ArrowLeft, "size-4"), attrs: "data-back" })}
      <div class="${cn("flex size-6 items-center justify-center rounded text-white", item.color)}">${icon(item.icon, "size-4")}</div>
      <span class="font-medium text-sm">${item.title}</span>
    </div>
    <div class="flex flex-1 flex-col gap-3 p-4">
      <div class="text-neutral-600 text-xs dark:text-neutral-300">${item.description}</div>
      <div class="space-y-2">
        ${[1, 2, 3].map(
          () => `<div class="flex items-center gap-2 rounded-md bg-neutral-100 p-2 dark:bg-neutral-800">
            <div class="size-8 rounded bg-neutral-200 dark:bg-neutral-700"></div>
            <div class="flex-1">
              <div class="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-700"></div>
              <div class="mt-1 h-2 w-16 rounded bg-neutral-200 dark:bg-neutral-700"></div>
            </div>
          </div>`,
        )}
      </div>
    </div>
  </div>`;
}

function listButtons() {
  return items.map((item) =>
    button({
      variant: "ghost",
      className:
        "group min-h-12 justify-start gap-3 rounded-none border-neutral-200 border-b px-3 py-3 font-normal last:border-b-0",
      label: html`<div class="${cn("flex size-8 items-center justify-center rounded text-white", item.color)}">${icon(item.icon, "size-4")}</div>
        <div class="flex-1">
          <div class="font-medium text-sm">${item.title}</div>
          <div class="text-neutral-600 text-xs dark:text-neutral-300">${item.description}</div>
        </div>
        ${icon(ChevronRight, "size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5")}`,
      attrs: `data-item="${item.id}"`,
    }),
  );
}

function header(title, toggleLabel, toggleRef) {
  return html`<div class="flex items-center justify-between border-neutral-200 border-b p-2 dark:border-neutral-700">
    <span class="font-medium text-xs">${title}</span>
    ${button({ variant: "ghost", size: "sm", className: "h-6 cursor-pointer text-xs", label: toggleLabel, attrs: `data-ref="${toggleRef}"` })}
  </div>`;
}

export function mount(root) {
  let selected = null;
  let useAnimation = true;
  let current = null;
  let pending = Promise.resolve();
  root.innerHTML = html`<div data-ref="plain" class="${cn("flex h-full w-full flex-col overflow-hidden", "hidden")}">
      ${header("Without Animation", "Try Animated", "toAnimated")}
      <div data-ref="plainBody" class="contents"></div>
    </div>
    <div data-ref="animated" class="${cn("flex h-full w-full flex-col overflow-hidden")}">
      ${header("With Animation", "Try Without", "toPlain")}
    </div>`;
  const { plain, plainBody, animated, toAnimated, toPlain } = refs(root);

  function content(item) {
    const element = document.createElement("div");
    if (item) {
      element.className = "flex-1";
      element.innerHTML = detailView(item);
    } else {
      element.className = "flex flex-col";
      element.innerHTML = listButtons().join("");
    }
    return element;
  }

  function renderPlain() {
    plainBody.innerHTML = selected
      ? detailView(selected)
      : `<div class="flex flex-col">${listButtons().join("")}</div>`;
  }

  function renderAnimated() {
    const item = selected;
    pending = pending.then(async () => {
      if (current) {
        await animate(current, { opacity: 0 }, fade);
        current.remove();
      }
      const next = content(item);
      next.style.opacity = "0";
      animated.append(next);
      current = next;
      await animate(next, { opacity: 1 }, fade);
    });
  }

  function select(item) {
    selected = item;
    renderPlain();
    renderAnimated();
  }

  function setUseAnimation(next) {
    useAnimation = next;
    plain.className = cn("flex h-full w-full flex-col overflow-hidden", useAnimation && "hidden");
    animated.className = cn(
      "flex h-full w-full flex-col overflow-hidden",
      !useAnimation && "hidden",
    );
  }

  root.addEventListener("click", (event) => {
    const itemId = event.target.closest("[data-item]")?.dataset.item;
    if (itemId) {
      select(items.find((item) => String(item.id) === itemId));
    } else if (event.target.closest("[data-back]")) {
      select(null);
    }
  });
  toAnimated.addEventListener("click", () => setUseAnimation(true));
  toPlain.addEventListener("click", () => setUseAnimation(false));

  renderPlain();
  current = content(null);
  animated.append(current);
  animate(current, { opacity: 0 }, { duration: 0 });
  animate(current, { opacity: 1 }, fade);
}
