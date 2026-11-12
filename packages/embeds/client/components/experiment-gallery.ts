import { type ExperimentProject, experimentIndexSchema } from "@pulkit/shared/experiments";
import Fuse from "fuse.js";
import { findElements, requireElement } from "../lib/dom.ts";

import { setupExperimentPreviews } from "./experiment-previews.ts";

interface Filters {
  query: string;
  category: string;
  page: number;
}

const pageSize = 24;

function readFilters(page: number): Filters {
  const params = new URLSearchParams(globalThis.location.search);
  return {
    query: params.get("search") ?? "",
    category: params.get("category") ?? "",
    page: Math.max(1, Number(params.get("page") ?? page) || 1),
  };
}

function filterParams(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.query) {
    params.set("search", filters.query);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function matching(projects: readonly ExperimentProject[], filters: Filters): ExperimentProject[] {
  const scoped = projects.filter(
    (project) => !filters.category || project.group === filters.category,
  );
  const needle = filters.query.toLowerCase().trim();
  if (!needle) {
    return [...scoped];
  }
  const exact: ExperimentProject[] = [];
  const rest: ExperimentProject[] = [];
  for (const project of scoped) {
    const match = `${project.title} ${project.category}`.toLowerCase().includes(needle);
    (match ? exact : rest).push(project);
  }
  const fuse = new Fuse(rest, {
    keys: ["title", "name", "category"],
    threshold: 0.35,
    minMatchCharLength: 1,
  });
  return [...exact, ...fuse.search(needle).map((result) => result.item)];
}

function clone<T extends Element>(template: HTMLTemplateElement, type: new () => T): T {
  const element = template.content.firstElementChild?.cloneNode(true);
  if (!(element instanceof type)) {
    throw new Error("Unexpected gallery template");
  }
  return element;
}

export function setupExperimentGallery(root: HTMLElement): void {
  const input = requireElement(root, "[data-directory-query]", HTMLInputElement);
  const clear = requireElement(root, "[data-directory-clear]", HTMLButtonElement);
  const status = requireElement(root, "[data-directory-status]", HTMLElement);
  const list = requireElement(root, "[data-directory-list]", HTMLElement);
  const empty = requireElement(root, "[data-directory-empty]", HTMLElement);
  const staticPages = requireElement(root, "[data-directory-pages]", HTMLElement);
  const resultPages = requireElement(root, "[data-directory-result-pages]", HTMLElement);
  const card = requireElement(root, "template[data-directory-card]", HTMLTemplateElement);
  const pageLink = requireElement(root, "template[data-page-link]", HTMLTemplateElement);
  const pageGap = requireElement(root, "template[data-page-gap]", HTMLTemplateElement);
  const pageNav = requireElement(root, "template[data-page-nav]", HTMLTemplateElement);
  const filterButtons = findElements(root, "[data-filter]", HTMLButtonElement);
  const { index = "", base = "", revision = "" } = root.dataset;
  const initialPage = Number(root.dataset.page ?? 1);
  const refreshPreviews = setupExperimentPreviews(root);
  const browsing = [...list.children];
  const browsingStatus = status.innerHTML;
  let filters = readFilters(initialPage);
  let projects: Promise<ExperimentProject[]> | undefined;

  const load = (): Promise<ExperimentProject[]> => {
    projects ??= fetch(index)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Reviewed gallery index is unavailable");
        }
        const catalog = experimentIndexSchema.parse(await response.json());
        if (catalog.revision !== revision) {
          throw new Error("Reviewed gallery index has a stale revision");
        }
        return catalog.projects;
      })
      .catch((error: unknown) => {
        projects = undefined;
        throw error;
      });
    return projects;
  };

  const fill = (project: ExperimentProject): Node => {
    const item = clone(card, HTMLElement);
    requireElement(item, "[data-card-link]", HTMLAnchorElement).href =
      `${base}experiments/${project.name}/`;
    requireElement(item, "[data-card-title]", HTMLElement).textContent = project.title;
    requireElement(item, "[data-card-category]", HTMLElement).textContent = project.category;
    requireElement(item, "[data-card-preview]", HTMLAnchorElement).href = project.preview;
    requireElement(item, "[data-card-source]", HTMLAnchorElement).href = project.source;
    requireElement(item, "[data-card-link]", HTMLAnchorElement).dataset.cardVideo = project.video;
    const frame = requireElement(item, "[data-card-media]", HTMLElement);
    frame.replaceChildren();
    if (project.thumbnail) {
      const image = document.createElement("img");
      image.className = "absolute inset-0 size-full object-cover";
      image.alt = "";
      image.width = 1280;
      image.height = 800;
      image.loading = "lazy";
      image.decoding = "async";
      image.dataset.previewPoster = "";
      image.src = project.thumbnail;
      frame.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className =
        "absolute inset-0 grid place-items-center bg-surface text-sm text-muted";
      placeholder.dataset.previewPlaceholder = "";
      placeholder.textContent = "Preview preparing";
      frame.append(placeholder);
    }
    return item;
  };

  const link = (target: number, label: string, current: boolean): Node => {
    const anchor = clone(pageLink, HTMLAnchorElement);
    anchor.textContent = label;
    anchor.href = `${base}${filterParams({ ...filters, page: target })}`;
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
      ...new Set(
        [1, page - 1, page, page + 1, count].filter((number) => number >= 1 && number <= count),
      ),
    ].sort((left, right) => left - right);
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

  const controls = (): void => {
    for (const button of filterButtons) {
      const [kind, value] = (button.dataset.filter ?? "").split(":");
      button.setAttribute(
        "aria-pressed",
        String(kind === "all" ? !filters.category : filters.category === value),
      );
    }
    input.value = filters.query;
    clear.hidden = !filters.query;
  };

  const apply = async (next: Filters, scroll: boolean): Promise<void> => {
    filters = next;
    globalThis.history.replaceState(
      globalThis.history.state,
      "",
      `${base}${filterParams(filters)}`,
    );
    controls();
    if (!filters.query && !filters.category && filters.page === initialPage) {
      list.replaceChildren(...browsing);
      refreshPreviews();
      status.innerHTML = browsingStatus;
      empty.hidden = true;
      list.hidden = false;
      staticPages.hidden = false;
      resultPages.replaceChildren();
      return;
    }
    try {
      const all = await load();
      if (next !== filters) {
        return;
      }
      const result = matching(all, filters);
      const count = Math.max(1, Math.ceil(result.length / pageSize));
      const selected = Math.min(filters.page, count);
      list.replaceChildren(
        ...result.slice((selected - 1) * pageSize, selected * pageSize).map(fill),
      );
      refreshPreviews();
      status.textContent = `${result.length} ${result.length === 1 ? "project" : "projects"}${result.length === all.length ? "" : ` of ${all.length}`}`;
      empty.hidden = result.length > 0;
      list.hidden = result.length === 0;
      staticPages.hidden = true;
      resultPages.replaceChildren(...pager(selected, count));
      if (scroll) {
        const top = status.getBoundingClientRect().top + globalThis.scrollY - 16;
        if (Math.abs(globalThis.scrollY - top) > 4) {
          globalThis.scrollTo({
            top,
            behavior: globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
        }
      }
    } catch {
      status.textContent =
        "Search is temporarily unavailable. Use the page links to browse reviewed projects.";
      list.replaceChildren(...browsing);
      refreshPreviews();
      list.hidden = false;
      staticPages.hidden = false;
      empty.hidden = true;
      resultPages.replaceChildren();
    }
  };

  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      const [kind, category = ""] = (button.dataset.filter ?? "").split(":");
      apply({ ...filters, category: kind === "all" ? "" : category, page: 1 }, true);
    });
  }
  input.addEventListener("input", () => apply({ ...filters, query: input.value, page: 1 }, false));
  input.addEventListener("focus", () => {
    load().catch(() => undefined);
  });
  clear.addEventListener("click", () => {
    apply({ ...filters, query: "", page: 1 }, false);
    input.focus();
  });
  controls();
  if (filters.query || filters.category || filters.page !== initialPage) {
    apply(filters, false);
  }
}
