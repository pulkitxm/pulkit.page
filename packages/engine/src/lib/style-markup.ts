import { escapeHtml } from "@pulkit/shared/html";
import MagicString from "magic-string";
import { type DefaultTreeAdapterTypes, parse } from "parse5";
import type { CompiledStyles } from "./compiled-styles.ts";

interface MarkupTransforms {
  script?: (source: string) => string;
  stylesheet?: (source: string) => string;
}

export function compileMarkup(
  source: string,
  styles: CompiledStyles,
  transforms: MarkupTransforms = {},
): string {
  const output = new MagicString(source);
  const tree = parse(source, { sourceCodeLocationInfo: true });
  const walk = (node: DefaultTreeAdapterTypes.Node): void => {
    if ("attrs" in node) {
      for (const attribute of node.attrs) {
        if (attribute.name !== "class" && !/^data-[\w-]+-class$/.test(attribute.name)) {
          continue;
        }
        const location = node.sourceCodeLocation?.attrs?.[attribute.name];
        if (location) {
          output.overwrite(
            location.startOffset,
            location.endOffset,
            `${attribute.name}="${escapeHtml(styles.classes(attribute.value))}"`,
          );
        }
      }
    }
    if ("tagName" in node && ["script", "style"].includes(node.tagName)) {
      const type = node.attrs.find((attribute) => attribute.name === "type")?.value;
      const executable =
        !type || ["module", "text/javascript", "application/javascript"].includes(type);
      let transform = executable ? transforms.script : undefined;
      if (node.tagName === "style") {
        transform = transforms.stylesheet;
      }
      for (const child of node.childNodes) {
        if (
          transform &&
          child.nodeName === "#text" &&
          "value" in child &&
          child.sourceCodeLocation
        ) {
          output.overwrite(
            child.sourceCodeLocation.startOffset,
            child.sourceCodeLocation.endOffset,
            transform(child.value),
          );
        }
      }
    }
    if (
      "childNodes" in node &&
      !("tagName" in node && ["script", "style"].includes(node.tagName))
    ) {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
    if ("content" in node) {
      walk(node.content);
    }
  };
  walk(tree);
  return output.toString();
}
