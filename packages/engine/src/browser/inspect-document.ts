export interface DocumentReport {
  mains: number;
  headings: number;
  lang: string;
  viewportMeta: string;
  title: string;
  overflow: number;
  overflowing: string[];
  unsafeBlankLinks: string[];
  emptyLinks: string[];
  duplicateIds: string[];
  ids: string[];
  links: string[];
}

export function inspectDocument(): DocumentReport {
  const viewportWidth = document.documentElement.clientWidth;
  const clipsHorizontally = (element: Element): boolean => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX !== "visible") {
        return true;
      }
    }
    return false;
  };
  const describe = (element: Element): string =>
    [element.tagName.toLowerCase(), element.id && `#${element.id}`, element.classList[0]]
      .filter(Boolean)
      .join(".");
  const viewportMeta = document.getElementsByName("viewport")[0];
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
  return {
    mains: document.querySelectorAll("main").length,
    headings: document.querySelectorAll("h1").length,
    lang: document.documentElement.lang,
    viewportMeta: viewportMeta instanceof HTMLMetaElement ? viewportMeta.content : "",
    title: document.title.trim(),
    overflow: document.documentElement.scrollWidth - viewportWidth,
    overflowing: [...document.body.querySelectorAll("*")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > viewportWidth + 1 && !clipsHorizontally(element),
      )
      .slice(0, 3)
      .map(describe),
    unsafeBlankLinks: [...document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')]
      .filter((link) => !/\bnoopener\b|\bnoreferrer\b/.test(link.rel))
      .map((link) => link.href),
    emptyLinks: anchors
      .filter((link) => !link.textContent?.trim() && !link.getAttribute("aria-label"))
      .filter((link) => !link.querySelector("img")?.alt.trim())
      .filter(
        (link) =>
          ![...link.querySelectorAll("[role=img]")].some((image) =>
            image.getAttribute("aria-label")?.trim(),
          ),
      )
      .map((link) => link.href),
    duplicateIds: [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index),
    ids: [...document.querySelectorAll("[id], a[name]")].map(
      (element) => element.id || (element.getAttribute("name") ?? ""),
    ),
    links: anchors.map((link) => link.href),
  };
}
