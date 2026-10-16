import Fuse from "fuse.js";
import { findElement, findElements, requireElement } from "../lib/dom.ts";
import { watchCardVideo } from "./card-videos.ts";
import { setupPromptCopy } from "./prompt-copy.ts";

interface Project {
  path: string;
  name: string;
  title: string;
  category: string;
  group: string;
  provider: string;
  published: boolean;
}

interface Filters {
  query: string;
  category: string;
  provider: string;
  premium: boolean;
  preview: boolean;
  page: number;
}

const pageSize = 24;
const rawOrigin = "https://raw.githubusercontent.com/pulkitxm/claude-directory/main/";
const treeOrigin = "https://github.com/pulkitxm/claude-directory/tree/main/";

function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fields: Record<string, unknown> = { ...value };
  return (
    ["path", "name", "title", "category", "group", "provider"].every(
      (field) => typeof fields[field] === "string",
    ) && typeof fields.published === "boolean"
  );
}

async function loadProjects(url: string): Promise<Project[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directory index replied ${response.status}`);
  }
  const body: unknown = await response.json();
  return Array.isArray(body) ? body.filter(isProject) : [];
}

function readFilters(): Filters {
  const params = new URLSearchParams(globalThis.location.search);
  return {
    query: params.get("search") ?? "",
    category: params.get("category") ?? "",
    provider: params.get("provider") ?? "",
    premium: params.get("premium") === "1",
    preview: params.get("preview") === "1",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
}

function writeFilters(filters: Filters): void {
  const params = new URLSearchParams();
  const entries: [string, string | false][] = [
    ["search", filters.query],
    ["category", filters.category],
    ["provider", filters.provider],
    ["premium", filters.premium && "1"],
    ["preview", filters.preview && "1"],
    ["page", filters.page > 1 && String(filters.page)],
  ];
  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  globalThis.history.replaceState(
    globalThis.history.state,
    "",
    `${globalThis.location.pathname}${query ? `?${query}` : ""}`,
  );
}

function isDefault(filters: Filters): boolean {
  return !(
    filters.query ||
    filters.category ||
    filters.provider ||
    filters.premium ||
    filters.preview
  );
}

function search(projects: readonly Project[], query: string): Project[] {
  const needle = query.toLowerCase().trim();
  if (!needle) {
    return [...projects];
  }
  const exact: Project[] = [];
  const rest: Project[] = [];
  for (const project of projects) {
    const matches =
      project.name.toLowerCase().includes(needle) || project.title.toLowerCase().includes(needle);
    (matches ? exact : rest).push(project);
  }
  const fuse = new Fuse(rest, {
    keys: [
      { name: "title", weight: 0.6 },
      { name: "name", weight: 0.4 },
    ],
    threshold: 0.4,
    location: 0,
    minMatchCharLength: 1,
    shouldSort: true,
  });
  return [...exact, ...fuse.search(needle).map((result) => result.item)];
}

function matching(projects: readonly Project[], filters: Filters): Project[] {
  const scoped = projects.filter(
    (project) =>
      (!filters.category || project.group === filters.category) &&
      (!filters.provider || project.provider === filters.provider) &&
      (!filters.premium || project.provider !== ""),
  );
  return search(scoped, filters.query).filter((project) => !filters.preview || project.published);
}

function template(root: HTMLElement, name: string): HTMLTemplateElement {
  return requireElement(root, `template[data-${name}]`, HTMLTemplateElement);
}

function clone<T extends Element>(source: HTMLTemplateElement, type: new () => T): T {
  const element = source.content.firstElementChild?.cloneNode(true);
  if (!(element instanceof type)) {
    throw new Error("Unexpected directory template");
  }
  return element;
}

export function setupClaudeDirectory(root: HTMLElement): void {
  const input = requireElement(root, "[data-directory-query]", HTMLInputElement);
  const clear = requireElement(root, "[data-directory-clear]", HTMLButtonElement);
  const preview = requireElement(root, "[data-directory-preview]", HTMLButtonElement);
  const status = requireElement(root, "[data-directory-status]", HTMLElement);
  const list = requireElement(root, "[data-directory-list]", HTMLElement);
  const empty = requireElement(root, "[data-directory-empty]", HTMLElement);
  const staticPages = requireElement(root, "[data-directory-pages]", HTMLElement);
  const resultPages = requireElement(root, "[data-directory-result-pages]", HTMLElement);
  const card = findElement(root, "template[data-directory-card]", HTMLTemplateElement);
  const unavailable = template(root, "directory-unavailable");
  const pageLink = template(root, "page-link");
  const pageGap = template(root, "page-gap");
  const pageNav = template(root, "page-nav");
  const filterButtons = findElements(root, "[data-filter]", HTMLButtonElement);
  const { index = "", base = "", media = "" } = root.dataset;
  const browsing = [...list.children];
  const browsingStatus = status.innerHTML;
  let filters = readFilters();
  let projects: Promise<Project[]> | undefined;

  const load = (): Promise<Project[]> => {
    projects ??= loadProjects(index);
    return projects;
  };

  const scrollToResults = (): void => {
    const top = status.getBoundingClientRect().top + globalThis.scrollY - 16;
    if (Math.abs(globalThis.scrollY - top) > 4) {
      globalThis.scrollTo({ top, behavior: "smooth" });
    }
  };

  const fill = (project: Project): Node => {
    if (!card) {
      throw new Error("Missing directory card template");
    }
    const item = clone(card, HTMLElement);
    requireElement(item, "[data-card-link]", HTMLAnchorElement).href = `${base}${project.name}/`;
    requireElement(item, "[data-card-title]", HTMLElement).textContent = project.title;
    requireElement(item, "[data-card-category]", HTMLElement).textContent = project.category;
    const copy = requireElement(item, "[data-prompt-copy]", HTMLButtonElement);
    copy.dataset.prompt = `${rawOrigin}${project.path}/prompt.md`;
    copy.setAttribute("aria-label", `Copy prompt for ${project.name}`);
    const download = requireElement(item, "[data-card-download]", HTMLAnchorElement);
    download.href = `https://download-directory.github.io/?url=${encodeURIComponent(treeOrigin + project.path)}`;
    download.setAttribute("aria-label", `Download ${project.name}`);
    const frame = requireElement(item, "[data-card-media]", HTMLElement);
    if (project.published) {
      requireElement(frame, "[data-card-blur]", HTMLImageElement).src =
        `${media}${project.path}/poster.jpg`;
      frame.dataset.demo = `${media}${project.path}/demo.mp4`;
      watchCardVideo(frame);
    } else {
      delete frame.dataset.demo;
      frame.replaceChildren(unavailable.content.cloneNode(true));
    }
    setupPromptCopy(copy);
    return item;
  };

  const link = (target: number, label: string, current: boolean): Node => {
    const anchor = clone(pageLink, HTMLAnchorElement);
    anchor.textContent = label;
    anchor.href = `?page=${target}`;
    if (current) {
      anchor.setAttribute("aria-current", "page");
    }
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      apply({ ...filters, page: target }, true);
    });
    return anchor;
  };

  const pager = (page: number, count: number): Node[] => {
    if (count <= 1) {
      return [];
    }
    const nav = clone(pageNav, HTMLElement);
    const shown = [
      ...new Set([1, page - 1, page, page + 1, count].filter((n) => n >= 1 && n <= count)),
    ].sort((a, b) => a - b);
    if (page > 1) {
      nav.append(link(page - 1, "Prev", false));
    }
    shown.forEach((target, position) => {
      if (position > 0 && target - (shown[position - 1] ?? target) > 1) {
        nav.append(pageGap.content.cloneNode(true));
      }
      nav.append(link(target, String(target), target === page));
    });
    if (page < count) {
      nav.append(link(page + 1, "Next", false));
    }
    return [nav];
  };

  const isActive = (kind: string, value: string): boolean => {
    switch (kind) {
      case "all":
        return !(filters.category || filters.premium);
      case "category":
        return filters.category === value && !filters.provider && !filters.premium;
      case "premium":
        return filters.premium;
      default:
        return filters.provider === value;
    }
  };

  const syncControls = (): void => {
    for (const button of filterButtons) {
      const [kind = "", value = ""] = (button.dataset.filter ?? "").split(":");
      button.setAttribute("aria-pressed", String(isActive(kind, value)));
    }
    preview.setAttribute("aria-pressed", String(filters.preview));
    clear.hidden = !filters.query;
    if (input.value !== filters.query) {
      input.value = filters.query;
    }
  };

  const showCount = (shown: number, total: number): void => {
    const strong = document.createElement("span");
    strong.className = "font-medium text-fg";
    strong.textContent = String(shown);
    status.replaceChildren(
      strong,
      ` ${shown === 1 ? "project" : "projects"}`,
      shown === total ? "" : ` of ${total}`,
    );
  };

  const apply = async (next: Filters, scroll: boolean): Promise<void> => {
    filters = next;
    writeFilters(filters);
    syncControls();
    if (isDefault(filters)) {
      list.replaceChildren(...browsing);
      status.innerHTML = browsingStatus;
      empty.hidden = true;
      list.hidden = false;
      staticPages.hidden = false;
      resultPages.replaceChildren();
      return;
    }
    const all = await load();
    if (next !== filters) {
      return;
    }
    const matched = matching(all, filters);
    const count = Math.max(1, Math.ceil(matched.length / pageSize));
    const page = Math.min(filters.page, count);
    list.replaceChildren(...matched.slice((page - 1) * pageSize, page * pageSize).map(fill));
    showCount(matched.length, all.length);
    empty.hidden = matched.length > 0;
    list.hidden = matched.length === 0;
    staticPages.hidden = true;
    resultPages.replaceChildren(...pager(page, count));
    if (scroll) {
      scrollToResults();
    }
  };

  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      const [kind = "", value = ""] = (button.dataset.filter ?? "").split(":");
      const reset = { ...filters, page: 1, provider: "", premium: false };
      if (kind === "all" || kind === "category") {
        apply({ ...reset, category: kind === "all" ? "" : value }, true);
      } else {
        apply(
          {
            ...reset,
            category: "templates",
            premium: kind === "premium",
            provider: kind === "provider" ? value : "",
          },
          true,
        );
      }
    });
  }
  preview.addEventListener("click", () => {
    apply({ ...filters, preview: !filters.preview, page: 1 }, true);
  });
  input.addEventListener("input", () => {
    apply({ ...filters, query: input.value, page: 1 }, false);
  });
  input.addEventListener("focus", () => {
    load().catch(() => {
      projects = undefined;
    });
  });
  clear.addEventListener("click", () => {
    apply({ ...filters, query: "", page: 1 }, false);
    input.focus();
  });
  for (const frame of findElements(list, "[data-card-media]", HTMLElement)) {
    watchCardVideo(frame);
  }
  if (isDefault(filters)) {
    syncControls();
  } else {
    apply(filters, false);
  }
}
