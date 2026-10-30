import { stylesheetClasses } from "@pulkit/engine/src/lib/compiled-styles.ts";
import { isRecord } from "@pulkit/engine/src/lib/guards.ts";
import { type Selector, transform } from "lightningcss";

function namesIn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(namesIn);
  }
  if (!isRecord(value)) {
    return [];
  }
  if (value.type === "class" && typeof value.name === "string") {
    return [value.name];
  }
  return Object.values(value).flatMap(namesIn);
}

export function pruneCss(
  source: string,
  utilities: ReadonlySet<string>,
  used: ReadonlySet<string>,
): string {
  return transform({
    filename: "home.css",
    code: Buffer.from(source),
    minify: true,
    visitor: {
      Rule(rule) {
        if (rule.type !== "style") {
          return;
        }
        const names = namesIn(rule.value.selectors).filter((name) => utilities.has(name));
        return names.length > 0 && !names.some((name) => used.has(name)) ? [] : undefined;
      },
    },
  }).code.toString();
}

export function renameCss(
  source: string,
  names: ReadonlyMap<string, string>,
  variable: (name: string) => string,
): string {
  const rename = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(rename);
    }
    if (!isRecord(value)) {
      return value;
    }
    if (value.type === "class" && typeof value.name === "string") {
      return { ...value, name: names.get(value.name) ?? value.name };
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rename(item)]));
  };
  return transform({
    filename: "home.css",
    code: Buffer.from(source),
    minify: true,
    visitor: { Selector: (selector) => rename(selector) as Selector, DashedIdent: variable },
  }).code.toString();
}

export function cssRuleCount(source: string): number {
  let count = 0;
  transform({
    filename: "count.css",
    code: Buffer.from(source),
    visitor: {
      Rule(rule) {
        if (rule.type === "style") {
          count++;
        }
      },
    },
  });
  return count;
}

export function utilityNames(source: string): Set<string> {
  return new Set(
    [...stylesheetClasses(source, "utilities.css")].filter((name) => !name.startsWith("plyr")),
  );
}
