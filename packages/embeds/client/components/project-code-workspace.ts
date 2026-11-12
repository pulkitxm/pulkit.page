import { escapeHtml } from "@pulkit/shared/html";
import { lucideSvg } from "@pulkit/shared/icons";
import {
  type ProjectSourceBundle,
  projectSourceSchema,
  projectSourceUrl,
} from "@pulkit/shared/project-source";
import { readStoredJson, writeStoredJson } from "@pulkit/shared/storage";
import { Check, ChevronRight, Copy, FileCode2, Folder, FolderOpen, WrapText } from "lucide";
import { highlightProjectCode } from "../lib/code-highlight.ts";
import { findElement, findElements, requireElement } from "../lib/dom.ts";

type SourceFile = ProjectSourceBundle["files"][number];

export interface ProjectSourceNode {
  name: string;
  path: string;
  children?: ProjectSourceNode[];
}

const iconButton =
  "inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-muted no-underline transition-colors hover:bg-surface hover:text-fg";
const wrapKey = "project-code-wrap";
const maximumResponseBytes = 26 * 1024 * 1024;

export function projectSourceTree(files: readonly Pick<SourceFile, "path">[]): ProjectSourceNode[] {
  const roots: ProjectSourceNode[] = [];
  for (const file of files) {
    let nodes = roots;
    const parts = file.path.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index];
      if (!name) {
        continue;
      }
      const path = parts.slice(0, index + 1).join("/");
      let node = nodes.find((entry) => entry.path === path);
      if (!node) {
        node = { name, path };
        if (index < parts.length - 1) {
          node.children = [];
        }
        nodes.push(node);
      }
      if (node.children) {
        nodes = node.children;
      }
    }
  }
  const sort = (nodes: ProjectSourceNode[]): ProjectSourceNode[] => {
    nodes.sort((left, right) => {
      const folders = Number(Boolean(right.children)) - Number(Boolean(left.children));
      return folders || left.name.localeCompare(right.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sort(node.children);
      }
    }
    return nodes;
  };
  return sort(roots);
}

export async function verifiedProjectSource(
  value: unknown,
  expected: { revision: string; project: string },
): Promise<ProjectSourceBundle> {
  const bundle = projectSourceSchema.parse(value);
  if (bundle.revision !== expected.revision || bundle.project !== expected.project) {
    throw new Error("Project source does not match this page");
  }
  await Promise.all(
    bundle.files.map(async (file) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(file.content));
      const actual = [...new Uint8Array(digest)]
        .map((part) => part.toString(16).padStart(2, "0"))
        .join("");
      if (actual !== file.sha256) {
        throw new Error("Project source integrity check failed");
      }
    }),
  );
  return bundle;
}

function fileSize(content: string): string {
  const bytes = new TextEncoder().encode(content).byteLength;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function initialFile(files: readonly SourceFile[]): SourceFile | undefined {
  for (const preferred of [
    "index.html",
    "src/App.tsx",
    "src/App.jsx",
    "src/main.ts",
    "package.json",
  ]) {
    const file = files.find((entry) => entry.path === preferred);
    if (file) {
      return file;
    }
  }
  return files[0];
}

export function setupProjectCodeWorkspace(root: HTMLElement): () => void {
  const workspace = findElement(root, "[data-code-workspace]", HTMLElement);
  const preview = findElement(root, '[data-project-panel="preview"]', HTMLElement);
  const panel = findElement(root, '[data-project-panel="code"]', HTMLElement);
  const buttons = findElements(root, "[data-project-view]", HTMLButtonElement);
  if (!workspace || !preview || !panel || buttons.length !== 2) {
    return () => {};
  }
  const filesPanel = requireElement(workspace, "[data-project-files]", HTMLElement);
  const codePanel = requireElement(workspace, "[data-project-code]", HTMLElement);
  const video = findElement(preview, "[data-project-recording]", HTMLVideoElement);
  const revision = workspace.dataset.sourceRevision ?? "";
  const project = workspace.dataset.sourceProject ?? "";
  const sourceUrl = workspace.dataset.sourceUrl ?? "";
  let expectedUrl: string;
  try {
    expectedUrl = projectSourceUrl(project);
  } catch {
    return () => {};
  }
  const controller = new AbortController();
  const expanded = new Set<string>();
  let bundle: ProjectSourceBundle | undefined;
  let loading: Promise<void> | undefined;
  let selected = "";
  let selection = 0;
  let disposed = false;
  let wrapping = readStoredJson(wrapKey) === true;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const treeHtml = (nodes: ProjectSourceNode[], depth = 0): string =>
    nodes
      .map((node) => {
        if (node.children) {
          const open = expanded.has(node.path);
          return `<div><button class="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent py-1.5 pr-2 text-left text-md text-muted [font:inherit] transition-colors hover:bg-surface hover:text-fg" style="padding-left:${depth * 12 + 8}px" type="button" aria-expanded="${open}" data-source-folder="${escapeHtml(node.path)}">${lucideSvg(ChevronRight, `size-3 shrink-0 transition-transform${open ? " rotate-90" : ""}`)}${lucideSvg(open ? FolderOpen : Folder, "size-4 shrink-0")}<span class="truncate">${escapeHtml(node.name)}</span></button>${open ? treeHtml(node.children, depth + 1) : ""}</div>`;
        }
        const active = node.path === selected;
        return `<button class="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] border-0 py-1.5 pr-2 text-left text-md [font:inherit] transition-colors ${active ? "bg-surface font-medium text-fg" : "bg-transparent text-muted hover:bg-surface/60 hover:text-fg"}" style="padding-left:${depth * 12 + 26}px" type="button" aria-pressed="${active}" data-source-file="${escapeHtml(node.path)}">${lucideSvg(FileCode2, "size-4 shrink-0")}<span class="truncate">${escapeHtml(node.name)}</span></button>`;
      })
      .join("");

  const renderTree = (): void => {
    if (bundle) {
      filesPanel.innerHTML = treeHtml(projectSourceTree(bundle.files));
    }
  };

  const selectFile = async (path: string): Promise<void> => {
    const file = bundle?.files.find((entry) => entry.path === path);
    if (!file || disposed) {
      return;
    }
    selected = path;
    selection += 1;
    const current = selection;
    clearTimeout(copyTimer);
    const focusFile = filesPanel.contains(document.activeElement);
    renderTree();
    if (focusFile) {
      findElements(filesPanel, "[data-source-file]", HTMLButtonElement)
        .find((entry) => entry.dataset.sourceFile === path)
        ?.focus();
    }
    codePanel.innerHTML = `<div class="flex items-center justify-between gap-4 border-b border-fg/10 bg-fg/5 px-4 py-2.5"><p class="m-0 truncate font-mono text-xs text-fg/80">${escapeHtml(path)}</p><div class="flex shrink-0 items-center gap-3"><span class="text-xs text-muted">${fileSize(file.content)}</span><button class="${iconButton}" type="button" aria-label="Wrap lines" aria-pressed="${wrapping}" data-source-wrap>${lucideSvg(WrapText, "size-4")}</button><button class="${iconButton}" type="button" aria-label="Copy file" data-source-copy>${lucideSvg(Copy, "size-4")}</button></div></div><p class="sr-only" role="status" data-source-message></p><pre class="m-0 h-105 overflow-auto bg-transparent p-4 font-mono text-md leading-relaxed min-[64rem]:h-auto min-[64rem]:min-h-0 min-[64rem]:flex-1${wrapping ? " whitespace-pre-wrap wrap-break-word" : " whitespace-pre"}" tabindex="0" aria-label="${escapeHtml(path)} source code" data-source-pre><code data-source-content></code></pre>`;
    const content = requireElement(codePanel, "[data-source-content]", HTMLElement);
    content.textContent = file.content;
    try {
      const html = await highlightProjectCode(file.content, file.language);
      if (!disposed && current === selection) {
        content.innerHTML = html;
      }
    } catch {
      if (!disposed && current === selection) {
        content.textContent = file.content;
      }
    }
  };

  const loadSource = (): Promise<void> => {
    loading ??= (async () => {
      const message = document.createElement("p");
      message.className = "m-0 p-4 text-md text-muted";
      message.setAttribute("role", "status");
      message.textContent = "Loading project files...";
      codePanel.replaceChildren(message);
      try {
        if (sourceUrl !== expectedUrl || !/^[a-f0-9]{40}$/.test(revision)) {
          throw new Error("Invalid project source location");
        }
        const response = await fetch(sourceUrl, {
          signal: controller.signal,
          credentials: "same-origin",
          redirect: "error",
        });
        const advertised = Number(response.headers.get("content-length") ?? 0);
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json") ||
          advertised > maximumResponseBytes
        ) {
          throw new Error("Project source is unavailable");
        }
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > maximumResponseBytes) {
          throw new Error("Project source exceeds the preview limit");
        }
        const source = await verifiedProjectSource(JSON.parse(text), { revision, project });
        if (disposed) {
          return;
        }
        bundle = source;
        const file = initialFile(source.files);
        if (!file) {
          throw new Error("Project source contains no files");
        }
        const parts = file.path.split("/");
        for (let index = 1; index < parts.length; index += 1) {
          expanded.add(parts.slice(0, index).join("/"));
        }
        await selectFile(file.path);
      } catch {
        if (!disposed) {
          filesPanel.replaceChildren();
          codePanel.innerHTML =
            '<div class="p-4"><p class="mt-0 text-md text-muted" role="status">Project files could not be loaded.</p><button class="cursor-pointer rounded-[6px] border border-line bg-bg px-3 py-2 text-md text-fg [font:inherit] hover:bg-surface" type="button" data-source-retry>Try again</button></div>';
        }
      }
    })().finally(() => {
      if (!bundle) {
        loading = undefined;
      }
    });
    return loading;
  };

  const show = (view: "preview" | "code", updateUrl: boolean): void => {
    preview.hidden = view === "code";
    panel.hidden = view !== "code";
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.projectView === view));
    }
    if (video) {
      if (view === "code") {
        video.pause();
      }
      video.dispatchEvent(new CustomEvent("project-viewchange", { detail: { view } }));
    }
    if (view === "code") {
      void loadSource();
    }
    if (updateUrl) {
      const url = new URL(globalThis.location.href);
      if (view === "code") {
        url.searchParams.set("view", "code");
      } else {
        url.searchParams.delete("view");
      }
      globalThis.history.replaceState(null, "", url);
    }
  };

  const click = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest("button");
    if (!(button instanceof HTMLButtonElement) || !root.contains(button)) {
      return;
    }
    const view = button.dataset.projectView;
    if (view === "preview" || view === "code") {
      show(view, true);
      return;
    }
    const folder = button.dataset.sourceFolder;
    if (folder) {
      if (expanded.has(folder)) {
        expanded.delete(folder);
      } else {
        expanded.add(folder);
      }
      renderTree();
      findElements(filesPanel, "[data-source-folder]", HTMLButtonElement)
        .find((entry) => entry.dataset.sourceFolder === folder)
        ?.focus();
      return;
    }
    const path = button.dataset.sourceFile;
    if (path) {
      void selectFile(path);
      return;
    }
    if (button.hasAttribute("data-source-retry")) {
      void loadSource();
      return;
    }
    if (button.hasAttribute("data-source-wrap")) {
      wrapping = !wrapping;
      writeStoredJson(wrapKey, wrapping);
      button.setAttribute("aria-pressed", String(wrapping));
      const pre = requireElement(codePanel, "[data-source-pre]", HTMLElement);
      pre.classList.toggle("whitespace-pre-wrap", wrapping);
      pre.classList.toggle("wrap-break-word", wrapping);
      pre.classList.toggle("whitespace-pre", !wrapping);
      return;
    }
    if (button.hasAttribute("data-source-copy")) {
      const file = bundle?.files.find((entry) => entry.path === selected);
      if (!file) {
        return;
      }
      const message = requireElement(codePanel, "[data-source-message]", HTMLElement);
      void Promise.resolve()
        .then(() => {
          if (!navigator.clipboard) {
            throw new Error("Clipboard is unavailable");
          }
          return navigator.clipboard.writeText(file.content);
        })
        .then(
          () => {
            if (!disposed && selected === file.path) {
              button.innerHTML = lucideSvg(Check, "size-4 text-green-600 dark:text-green-400");
              button.setAttribute("aria-label", "Copied");
              message.textContent = "File copied to clipboard.";
              clearTimeout(copyTimer);
              copyTimer = setTimeout(() => {
                button.innerHTML = lucideSvg(Copy, "size-4");
                button.setAttribute("aria-label", "Copy file");
                message.textContent = "";
              }, 1500);
            }
          },
          () => {
            if (!disposed && selected === file.path) {
              message.classList.remove("sr-only");
              message.classList.add("m-0", "px-4", "py-2", "text-xs", "text-muted");
              message.textContent = "Copy failed. Select the code and copy it manually.";
            }
          },
        );
    }
  };

  const popstate = (): void => {
    show(
      new URL(globalThis.location.href).searchParams.get("view") === "code" ? "code" : "preview",
      false,
    );
  };
  root.addEventListener("click", click);
  globalThis.addEventListener("popstate", popstate);
  popstate();
  return () => {
    disposed = true;
    controller.abort();
    selection += 1;
    clearTimeout(copyTimer);
    root.removeEventListener("click", click);
    globalThis.removeEventListener("popstate", popstate);
  };
}
