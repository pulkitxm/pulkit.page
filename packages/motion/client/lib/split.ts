export type SplitMode = "chars" | "words";

function unit(text: string, index: number, masked: boolean): HTMLElement {
  const span = document.createElement("span");
  span.dataset.splitUnit = "";
  span.style.setProperty("--i", String(index));
  span.textContent = text;
  if (!masked) {
    return span;
  }
  const mask = document.createElement("span");
  mask.dataset.splitMask = "";
  mask.append(span);
  return mask;
}

export function splitText(
  element: HTMLElement,
  mode: SplitMode,
  masked = mode === "words",
): HTMLElement[] {
  if (element.dataset.splitDone !== undefined) {
    return [...element.querySelectorAll<HTMLElement>("[data-split-unit]")];
  }
  const text = element.textContent ?? "";
  const label = document.createElement("span");
  label.dataset.sr = "";
  label.textContent = text.trim();
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  const units: HTMLElement[] = [];
  let index = 0;
  for (const word of text.trim().split(/(\s+)/)) {
    if (/^\s+$/.test(word)) {
      visual.append(" ");
      continue;
    }
    if (mode === "words") {
      const piece = unit(word, index++, masked);
      units.push(piece.querySelector<HTMLElement>("[data-split-unit]") ?? piece);
      visual.append(piece);
      continue;
    }
    const group = document.createElement("span");
    group.style.display = "inline-block";
    group.style.whiteSpace = "nowrap";
    for (const character of word) {
      const piece = unit(character, index++, masked);
      units.push(piece.querySelector<HTMLElement>("[data-split-unit]") ?? piece);
      group.append(piece);
    }
    visual.append(group);
  }
  element.replaceChildren(label, visual);
  element.dataset.splitDone = "";
  return units;
}

export function splitWordsDeep(element: HTMLElement): HTMLElement[] {
  const words: HTMLElement[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) {
      nodes.push(walker.currentNode);
    }
  }
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const part of (node.textContent ?? "").split(/(\s+)/)) {
      if (!part) {
        continue;
      }
      if (/^\s+$/.test(part)) {
        fragment.append(part);
        continue;
      }
      const word = document.createElement("span");
      word.dataset.word = "";
      word.textContent = part;
      words.push(word);
      fragment.append(word);
    }
    node.replaceWith(fragment);
  }
  return words;
}
