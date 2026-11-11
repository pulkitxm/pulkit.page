export function approvedGalleryPaths(names: readonly string[]): {
  pages: ReadonlySet<string>;
  socialCards: ReadonlySet<string>;
} {
  const routes = [
    "",
    ...Array.from(
      { length: Math.max(0, Math.ceil(names.length / 24) - 1) },
      (_, index) => `pages/${index + 2}/`,
    ),
    ...names.map((name) => `experiments/${name}/`),
  ];
  return {
    pages: new Set([
      "reviewed-projects.json",
      ...routes.flatMap((route) => [
        `${route}index.html`,
        route ? `${route.slice(0, -1)}.md` : "index.md",
      ]),
    ]),
    socialCards: new Set(routes.flatMap((route) => [`${route}card.png`, `${route}card-x.png`])),
  };
}
