import { findElement, requireElement } from "../lib/dom.ts";

interface Project {
  path: string;
  name: string;
  category: string;
  summary: string;
  stack: string;
  poster: boolean;
}

interface Searchable {
  project: Project;
  text: string;
}

const batchSize = 24;

function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fields: Record<string, unknown> = { ...value };
  return (
    ["path", "name", "category", "summary", "stack"].every(
      (field) => typeof fields[field] === "string",
    ) && typeof fields.poster === "boolean"
  );
}

async function loadProjects(url: string): Promise<Searchable[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directory index replied ${response.status}`);
  }
  const body: unknown = await response.json();
  return (Array.isArray(body) ? body.filter(isProject) : []).map((project) => ({
    project,
    text: [project.name, project.category, project.summary, project.stack].join(" ").toLowerCase(),
  }));
}

function matchCount(count: number, query: string): string {
  if (count === 0) {
    return `No projects match “${query}”`;
  }
  return `${count} ${count === 1 ? "project matches" : "projects match"} “${query}”`;
}

export function setupClaudeDirectory(root: HTMLElement): void {
  const search = requireElement(root, "[data-directory-search]", HTMLElement);
  const input = requireElement(search, "input", HTMLInputElement);
  const status = requireElement(root, "[data-directory-status]", HTMLElement);
  const list = requireElement(root, "[data-directory-list]", HTMLElement);
  const more = requireElement(root, "[data-directory-more]", HTMLElement);
  const moreButton = requireElement(more, "button", HTMLButtonElement);
  const pages = findElement(root, "[data-directory-pages]", HTMLElement);
  const template = requireElement(root, "[data-directory-card]", HTMLTemplateElement);
  const { index = "", media = "", source = "" } = root.dataset;
  const browsing = [...list.children];
  const browsingStatus = status.textContent ?? "";
  let projects: Promise<Searchable[]> | undefined;
  let matches: Project[] = [];
  let shown = 0;

  const load = (): Promise<Searchable[]> => {
    projects ??= loadProjects(index);
    return projects;
  };

  const card = (project: Project): Node => {
    const item = template.content.firstElementChild?.cloneNode(true);
    if (!(item instanceof HTMLElement)) {
      throw new Error("Missing directory card template");
    }
    requireElement(item, "[data-card-link]", HTMLAnchorElement).href = source + project.path;
    requireElement(item, "[data-card-name]", HTMLElement).textContent = project.name;
    requireElement(item, "[data-card-category]", HTMLElement).textContent = project.category;
    requireElement(item, "[data-card-summary]", HTMLElement).textContent = project.summary;
    const image = requireElement(item, "[data-card-image]", HTMLImageElement);
    if (project.poster) {
      image.src = `${media}${project.path}/poster.jpg`;
    } else {
      requireElement(item, "[data-card-frame]", HTMLElement).textContent = "No preview";
    }
    return item;
  };

  const showMore = (): void => {
    const next = matches.slice(shown, shown + batchSize);
    list.append(...next.map(card));
    shown += next.length;
    more.hidden = shown >= matches.length;
  };

  const browse = (): void => {
    list.replaceChildren(...browsing);
    status.textContent = browsingStatus;
    more.hidden = true;
    if (pages) {
      pages.hidden = false;
    }
  };

  const filter = async (query: string): Promise<void> => {
    const url = new URL(globalThis.location.href);
    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }
    globalThis.history.replaceState(globalThis.history.state, "", url);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      browse();
      return;
    }
    let all: Searchable[];
    try {
      all = await load();
    } catch {
      projects = undefined;
      status.textContent = "Search is unavailable right now. Browse the pages below instead.";
      return;
    }
    if (input.value.trim() !== query) {
      return;
    }
    matches = all
      .filter((entry) => terms.every((term) => entry.text.includes(term)))
      .map((entry) => entry.project);
    list.replaceChildren();
    shown = 0;
    showMore();
    status.textContent = matchCount(matches.length, query);
    if (pages) {
      pages.hidden = true;
    }
  };

  input.addEventListener("focus", () => {
    load().catch(() => {
      projects = undefined;
    });
  });
  input.addEventListener("input", () => {
    filter(input.value.trim());
  });
  moreButton.addEventListener("click", showMore);
  search.hidden = false;
  const initial = new URLSearchParams(globalThis.location.search).get("q")?.trim();
  if (initial) {
    input.value = initial;
    filter(initial);
  }
}
