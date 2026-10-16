import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { escapeHtml } from "@pulkit/shared/html";
import { faSvg, lucideSvg } from "@pulkit/shared/icons";
import { readStoredJson, writeStoredJson } from "@pulkit/shared/storage";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  Folder,
  FolderOpen,
  Menu,
  WrapText,
} from "lucide";
import { highlight, languageOf } from "../lib/code-highlight.ts";

interface FileNode {
  name: string;
  path: string;
  size: number;
  children?: FileNode[];
}

const repository = "pulkitxm/claude-directory";
const maxPreview = 300 * 1024;
const maxHighlight = 100 * 1024;
const wrapKey = "claude-directory-code-wrap";
const preferred = ["prompt.md", "index.html", "package.json", "README.md"];
const excludedFiles = new Set([
  "demo.mp4",
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
]);
const excludedDirs = new Set(["screenshots", "scripts", "node_modules", "dist", ".git"]);
const binary = new Set(
  "png jpg jpeg gif webp avif ico mp4 webm mov mp3 wav woff woff2 ttf otf eot pdf zip wasm".split(
    " ",
  ),
);
const skeleton = [
  "w-1/3",
  "w-2/3",
  "w-1/2",
  "w-3/4",
  "w-2/5",
  "w-5/6",
  "w-1/2",
  "w-3/5",
  "w-2/3",
  "w-1/3",
  "w-4/5",
  "w-1/2",
];
const iconButton =
  "inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-muted no-underline transition-colors hover:bg-surface hover:text-fg";

function included(path: string): boolean {
  const segments = path.split("/");
  const name = segments.at(-1) ?? "";
  return (
    !excludedFiles.has(name) &&
    !segments.slice(0, -1).some((directory) => excludedDirs.has(directory)) &&
    !binary.has(name.split(".").at(-1)?.toLowerCase() ?? "")
  );
}

function isEntry(value: unknown): value is { path: string; type: string; size?: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fields: Record<string, unknown> = { ...value };
  return typeof fields.path === "string" && typeof fields.type === "string";
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => Number(!a.children) - Number(!b.children) || a.name.localeCompare(b.name));
  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children);
    }
  }
  return nodes;
}

async function loadTree(project: string): Promise<FileNode[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/git/trees/main:${project}?recursive=1`,
  );
  const body: unknown = response.ok ? await response.json() : undefined;
  const entries =
    typeof body === "object" && body !== null && "tree" in body && Array.isArray(body.tree)
      ? body.tree.filter(isEntry)
      : undefined;
  if (!entries) {
    throw new Error(`File listing replied ${response.status}`);
  }
  const root: FileNode[] = [];
  const directories = new Map<string, FileNode[]>([["", root]]);
  const childrenOf = (path: string): FileNode[] => {
    const existing = directories.get(path);
    if (existing) {
      return existing;
    }
    const segments = path.split("/");
    const node: FileNode = { name: segments.at(-1) ?? path, path, size: 0, children: [] };
    childrenOf(segments.slice(0, -1).join("/")).push(node);
    directories.set(path, node.children ?? []);
    return node.children ?? [];
  };
  for (const entry of entries) {
    if (entry.type === "blob" && included(entry.path)) {
      const segments = entry.path.split("/");
      childrenOf(segments.slice(0, -1).join("/")).push({
        name: segments.at(-1) ?? entry.path,
        path: entry.path,
        size: entry.size ?? 0,
      });
    }
  }
  return sortNodes(root);
}

function firstFile(nodes: readonly FileNode[]): string | undefined {
  for (const node of nodes) {
    const found = node.children ? firstFile(node.children) : node.path;
    if (found) {
      return found;
    }
  }
  return undefined;
}

function findNode(nodes: readonly FileNode[], path: string): FileNode | undefined {
  for (const node of nodes) {
    const match = node.path === path ? node : node.children && findNode(node.children, path);
    if (match) {
      return match;
    }
  }
  return undefined;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function setupFileExplorer(panel: HTMLElement, project: string): void {
  const files = new Map<string, Promise<string>>();
  const expanded = new Set<string>();
  let tree: FileNode[] = [];
  let selected: string | undefined;
  let wrap = readStoredJson(wrapKey) === true;
  panel.innerHTML = `<div class="grid gap-4 min-[64rem]:h-full min-[64rem]:min-h-0 min-[64rem]:grid-cols-[260px_minmax(0,1fr)] min-[64rem]:grid-rows-1"><nav class="max-h-64 overflow-y-auto rounded-[12px] border border-fg/10 bg-bg/80 p-2 min-[64rem]:h-full min-[64rem]:max-h-none min-[64rem]:min-h-0" aria-label="Project files" data-files></nav><div class="flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-fg/10 bg-bg/80 min-[64rem]:h-full min-[64rem]:min-h-0" data-code></div></div>`;
  const nav = panel.querySelector<HTMLElement>("[data-files]");
  const code = panel.querySelector<HTMLElement>("[data-code]");
  if (!(nav && code)) {
    return;
  }

  const renderTree = (nodes: readonly FileNode[], depth: number): string =>
    `<ul class="m-0 list-none space-y-0.5 p-0">${nodes
      .map((node) => {
        if (node.children) {
          const open = expanded.has(node.path);
          return `<li><button class="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent px-2 py-1.5 text-left text-md text-muted [font:inherit] transition-colors hover:bg-surface hover:text-fg" type="button" style="padding-left:${depth * 12 + 8}px" data-dir="${escapeHtml(node.path)}">${lucideSvg(ChevronRight, `size-3.5 shrink-0 transition-transform${open ? " rotate-90" : ""}`)}${lucideSvg(open ? FolderOpen : Folder, "size-4 shrink-0")}<span class="truncate">${escapeHtml(node.name)}</span></button>${open ? renderTree(node.children, depth + 1) : ""}</li>`;
        }
        const active = node.path === selected;
        return `<li><button class="flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] border-0 px-2 py-1.5 text-left text-md [font:inherit] transition-colors ${active ? "bg-surface font-medium text-fg" : "bg-transparent text-muted hover:bg-surface/60 hover:text-fg"}" type="button" style="padding-left:${depth * 12 + 26}px" data-file="${escapeHtml(node.path)}">${lucideSvg(FileCode2, "size-4 shrink-0")}<span class="truncate">${escapeHtml(node.name)}</span></button></li>`;
      })
      .join("")}</ul>`;

  const drawTree = (): void => {
    nav.innerHTML = renderTree(tree, 0);
  };

  const header = (path: string, size: string, actions: string): string =>
    `<div class="flex items-center justify-between gap-4 border-b border-fg/10 bg-fg/5 px-4 py-2.5"><p class="m-0 truncate font-mono text-xs text-fg/80">${escapeHtml(path)}</p><div class="flex shrink-0 items-center gap-3">${size ? `<span class="text-xs text-muted">${size}</span>` : ""}<a class="${iconButton}" href="https://github.com/${repository}/blob/main/${escapeHtml(`${project}/${path}`)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`Open ${path} on GitHub`)}" title="${escapeHtml(`Open ${path} on GitHub`)}">${faSvg(faGithub, "size-3.5")}</a><button class="${iconButton}" type="button" aria-label="${wrap ? "Disable word wrap" : "Enable word wrap"}" data-wrap>${lucideSvg(wrap ? WrapText : Menu, "size-3.5")}</button>${actions}</div></div>`;

  const showFile = async (path: string): Promise<void> => {
    selected = path;
    drawTree();
    const node = findNode(tree, path);
    const size = node ? fileSize(node.size) : "";
    code.innerHTML = `${header(path, size, "")}<div class="h-105 space-y-3 overflow-hidden p-4 min-[64rem]:h-auto min-[64rem]:flex-1">${skeleton.map((width) => `<div class="h-3.5 ${width} rounded-[6px] bg-surface"></div>`).join("")}</div>`;
    if (node && node.size > maxPreview) {
      code.innerHTML = `${header(path, size, "")}<p class="m-0 p-6 text-md text-muted">This file can't be previewed here.</p>`;
      return;
    }
    let text: string;
    try {
      const pending =
        files.get(path) ??
        fetch(`https://raw.githubusercontent.com/${repository}/main/${project}/${path}`).then(
          (response) => {
            if (!response.ok) {
              throw new Error(`File replied ${response.status}`);
            }
            return response.text();
          },
        );
      files.set(path, pending);
      text = await pending;
    } catch {
      files.delete(path);
      code.innerHTML = `${header(path, size, "")}<div class="flex h-105 flex-col items-center justify-center gap-3 text-md text-muted min-[64rem]:h-auto min-[64rem]:flex-1"><p class="m-0">Couldn't load this file.</p><button class="cursor-pointer rounded-[6px] border border-line bg-transparent px-3 py-1.5 text-fg [font:inherit] transition-colors hover:bg-surface" type="button" data-retry>Retry</button></div>`;
      return;
    }
    if (selected !== path) {
      return;
    }
    const language = text.length <= maxHighlight ? languageOf(path) : undefined;
    const html = language
      ? await highlight(text, language).catch(() => escapeHtml(text))
      : escapeHtml(text);
    if (selected !== path) {
      return;
    }
    const actions = `<button class="${iconButton}" type="button" aria-label="${escapeHtml(`Download ${path}`)}" title="${escapeHtml(`Download ${path}`)}" data-download>${lucideSvg(Download, "size-3.5")}</button><button class="${iconButton}" type="button" aria-label="${escapeHtml(`Copy ${path}`)}" data-copy-file>${lucideSvg(Copy, "size-3.5")}</button>`;
    code.innerHTML = `${header(path, size, actions)}<pre class="m-0 h-105 overflow-auto bg-transparent p-4 font-mono text-md leading-relaxed min-[64rem]:h-auto min-[64rem]:flex-1 ${wrap ? "whitespace-pre-wrap wrap-break-word" : ""}" tabindex="0"><code>${html}</code></pre>`;
    code.dataset.text = text;
  };

  nav.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (target?.dataset.dir !== undefined) {
      const path = target.dataset.dir;
      if (expanded.has(path)) {
        expanded.delete(path);
      } else {
        expanded.add(path);
      }
      drawTree();
    } else if (target?.dataset.file) {
      showFile(target.dataset.file);
    }
  });

  code.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    const text = code.dataset.text ?? "";
    if (!(target && selected)) {
      return;
    }
    if (target.dataset.wrap !== undefined) {
      wrap = !wrap;
      writeStoredJson(wrapKey, wrap);
      showFile(selected);
    } else if (target.dataset.retry !== undefined) {
      showFile(selected);
    } else if (target.dataset.download !== undefined) {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = selected.split("/").at(-1) ?? selected;
      anchor.click();
      URL.revokeObjectURL(url);
    } else if (target.dataset.copyFile !== undefined) {
      navigator.clipboard.writeText(text).then(() => {
        target.innerHTML = lucideSvg(Check, "size-3.5 text-[#22c55e]");
        setTimeout(() => {
          target.innerHTML = lucideSvg(Copy, "size-3.5");
        }, 1500);
      });
    }
  });

  nav.innerHTML = `<div class="space-y-2 p-2">${skeleton
    .slice(0, 6)
    .map((width) => `<div class="h-4 ${width} rounded-[6px] bg-surface"></div>`)
    .join("")}</div>`;
  loadTree(project)
    .then((nodes) => {
      tree = nodes;
      const start =
        preferred.find((name) => nodes.some((node) => !node.children && node.path === name)) ??
        firstFile(nodes);
      for (const segment of (start ?? "")
        .split("/")
        .slice(0, -1)
        .map((_, index, all) => all.slice(0, index + 1).join("/"))) {
        expanded.add(segment);
      }
      drawTree();
      if (start) {
        showFile(start);
      } else {
        code.innerHTML =
          '<div class="flex flex-1 items-center justify-center rounded-[12px] border border-dashed border-line p-10 text-md text-muted">Select a file to view its code.</div>';
      }
    })
    .catch(() => {
      nav.innerHTML =
        '<p class="m-0 p-3 text-md text-muted">Couldn\'t load the files. GitHub may be rate limiting requests; try again in a few minutes.</p>';
      code.innerHTML = "";
    });
}
