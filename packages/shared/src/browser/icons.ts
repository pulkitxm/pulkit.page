export interface FontAwesomeIcon {
  icon: readonly [number, number, unknown, unknown, string | readonly string[]];
}

export function faSvg(definition: FontAwesomeIcon, classes = "", attributes = ""): string {
  const [width, height, , , path] = definition.icon;
  const paths = typeof path === "string" ? [path] : path;
  const extra = attributes ? ` ${attributes}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor" class="${classes}" aria-hidden="true"${extra}>${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
}

export type LucideIcon = readonly (readonly [
  string,
  Readonly<Record<string, string | number | undefined>>,
])[];

export function lucideSvg(icon: LucideIcon, classes = "", attributes = ""): string {
  const children = icon
    .map(
      ([tag, values]) =>
        `<${tag} ${Object.entries(values)
          .filter(([, value]) => value !== undefined)
          .map(([name, value]) => `${name}="${value}"`)
          .join(" ")}/>`,
    )
    .join("");
  const extra = attributes ? ` ${attributes}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${classes}" aria-hidden="true"${extra}>${children}</svg>`;
}
