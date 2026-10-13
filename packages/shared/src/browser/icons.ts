export interface FontAwesomeIcon {
  icon: readonly [number, number, unknown, unknown, string | readonly string[]];
}

export function faSvg(definition: FontAwesomeIcon, classes = "", attributes = ""): string {
  const [width, height, , , path] = definition.icon;
  const paths = typeof path === "string" ? [path] : path;
  const extra = attributes ? ` ${attributes}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor" class="${classes}" aria-hidden="true"${extra}>${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
}
