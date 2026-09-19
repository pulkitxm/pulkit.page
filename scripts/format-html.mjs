import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";

const cli = fileURLToPath(import.meta.resolve("@biomejs/biome/bin/biome"));
const config = fileURLToPath(new URL("../biome.json", import.meta.url));

const layoutDisplays = new Set(["flex", "inline-flex", "grid", "inline-grid"]);
const flowDisplay = /:(?:block|inline|inline-block|contents|table|flow-root)$/;

function isLayoutContainer(node) {
  const classes =
    node.attrs?.find((attribute) => attribute.name === "class")?.value.split(/\s+/) ?? [];
  return (
    classes.some((name) => layoutDisplays.has(name)) &&
    !classes.some((name) => flowDisplay.test(name) || name.startsWith("whitespace-pre"))
  );
}

function layoutBreaks(node, offsets) {
  const location = node.sourceCodeLocation;
  const children = node.content?.childNodes ?? node.childNodes ?? [];
  if (isLayoutContainer(node) && location?.startTag && location.endTag) {
    const edges = [
      { end: location.startTag.endOffset },
      ...children.map((child) => ({
        start: child.sourceCodeLocation?.startOffset,
        end: child.sourceCodeLocation?.endOffset,
        element: Boolean(child.tagName),
      })),
      { start: location.endTag.startOffset },
    ];
    for (let index = 1; index < edges.length; index++) {
      const before = edges[index - 1];
      const after = edges[index];
      const bothElements = (before.element ?? true) && (after.element ?? true);
      if (bothElements && before.end !== undefined && before.end === after.start) {
        offsets.push(before.end);
      }
    }
  }
  for (const child of children) {
    layoutBreaks(child, offsets);
  }
  return offsets;
}

function breakLayoutChildren(html) {
  const offsets = layoutBreaks(parse(html, { sourceCodeLocationInfo: true }), []);
  let result = html;
  for (const offset of [...new Set(offsets)].sort((a, b) => b - a)) {
    result = `${result.slice(0, offset)}\n${result.slice(offset)}`;
  }
  return result;
}

export function formatHtml(html) {
  let current = breakLayoutChildren(html.replaceAll("\u2714", "&#10004;"));
  for (let pass = 0; pass < 5; pass++) {
    const formatted = execFileSync(
      process.execPath,
      [
        cli,
        "format",
        "--write",
        "--vcs-enabled=false",
        "--stdin-file-path=generated.html",
        `--config-path=${config}`,
      ],
      {
        input: current,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (formatted === current) {
      return formatted;
    }
    current = formatted;
  }
  throw new Error("Biome HTML formatting did not stabilize after five passes");
}
