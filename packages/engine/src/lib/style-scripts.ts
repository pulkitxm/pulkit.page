import { parse } from "@babel/parser";
import MagicString from "magic-string";
import type { CompiledStyles } from "./compiled-styles.ts";
import { isRecord } from "./guards.ts";
import { compileMarkup } from "./style-markup.ts";

type Node = Record<string, unknown>;

function walk(
  value: unknown,
  visitor: (node: Node, parents: readonly Node[]) => void,
  parents: readonly Node[] = [],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visitor, parents);
    }
  } else if (isRecord(value) && typeof value.type === "string") {
    visitor(value, parents);
    for (const [key, item] of Object.entries(value)) {
      if (!["loc", "extra", "comments", "tokens"].includes(key)) {
        walk(item, visitor, [value, ...parents]);
      }
    }
  }
}

function property(node: unknown): string | undefined {
  if (!isRecord(node)) {
    return undefined;
  }
  if (node.type === "Identifier" && typeof node.name === "string") {
    return node.name;
  }
  if (node.type === "StringLiteral" && typeof node.value === "string") {
    return node.value;
  }
  return property(node.property);
}

function classContext(parents: readonly Node[]): boolean {
  for (const node of parents) {
    if (node.type === "ObjectProperty" && property(node.key) === "className") {
      return true;
    }
    if (node.type === "AssignmentExpression" && property(node.left) === "className") {
      return true;
    }
    if (
      node.type === "VariableDeclarator" &&
      /(?:Class(?:es)?$|^button(?:Base|Sizes|Variants)$)/.test(property(node.id) ?? "")
    ) {
      return true;
    }
    if (node.type === "CallExpression") {
      const name = property(node.callee);
      if (["cn", "faSvg", "icon", "stage"].includes(name ?? "")) {
        return true;
      }
      if (
        isRecord(node.callee) &&
        isRecord(node.callee.object) &&
        property(node.callee.object) === "classList"
      ) {
        return true;
      }
      if (
        name === "setAttribute" &&
        Array.isArray(node.arguments) &&
        property(node.arguments[0]) === "class"
      ) {
        return true;
      }
    }
    if (
      typeof node.type === "string" &&
      (node.type.endsWith("Statement") || node.type.endsWith("Declaration"))
    ) {
      break;
    }
  }
  return false;
}

export function scriptClasses(source: string, filename: string): Set<string> {
  const mutable = new Set<string>();
  const tree = parse(source, {
    sourceType: "module",
    plugins: filename.endsWith(".ts") ? ["typescript"] : [],
  });
  walk(tree, (node) => {
    if (
      node.type !== "CallExpression" ||
      !isRecord(node.callee) ||
      !Array.isArray(node.arguments)
    ) {
      return;
    }
    if (isRecord(node.callee.object) && property(node.callee.object) === "classList") {
      const args = property(node.callee) === "toggle" ? node.arguments.slice(0, 1) : node.arguments;
      for (const argument of args) {
        if (
          !isRecord(argument) ||
          argument.type !== "StringLiteral" ||
          typeof argument.value !== "string"
        ) {
          throw new Error(`${filename}: classList requires literal class names during compilation`);
        }
        for (const token of argument.value.split(/\s+/)) {
          mutable.add(token);
        }
      }
    }
  });
  return mutable;
}

export function compileScript(source: string, filename: string, styles: CompiledStyles): string {
  const tree = parse(source, {
    sourceType: "module",
    plugins: filename.endsWith(".ts") ? ["typescript"] : [],
  });
  const output = new MagicString(source);
  const value = (text: string, context: boolean): string => {
    if (/<[a-z][\s\S]*[\s>]/i.test(text)) {
      return compileMarkup(text, styles);
    }
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (
      !context &&
      !(
        tokens.length > 0 &&
        tokens.every((token) => styles.names.has(token)) &&
        (tokens.length > 1 || /[-:[/]/.test(text))
      )
    ) {
      return text;
    }
    return text.replace(/\S+/g, (token) => styles.names.get(token) ?? token);
  };
  walk(tree, (node, parents) => {
    if (
      node.type === "StringLiteral" &&
      typeof node.value === "string" &&
      typeof node.start === "number" &&
      typeof node.end === "number"
    ) {
      const parent = parents[0];
      if (
        parent?.type === "ImportDeclaration" ||
        parent?.type === "ExportNamedDeclaration" ||
        (parent?.type === "ObjectProperty" && parent.key === node)
      ) {
        return;
      }
      const updated = value(node.value, classContext(parents));
      if (updated !== node.value) {
        output.overwrite(node.start, node.end, JSON.stringify(updated));
      }
    }
    if (node.type === "TemplateLiteral" && Array.isArray(node.quasis)) {
      const quasis = node.quasis.filter(isRecord);
      const original = quasis.map((part) =>
        isRecord(part.value) ? String(part.value.cooked ?? part.value.raw) : "",
      );
      const text = original.join("__style_expression__");
      const rewritten = value(text, classContext(parents)).split("__style_expression__");
      if (rewritten.length !== quasis.length) {
        throw new Error(`${filename}: invalid template rewrite`);
      }
      for (const [index, quasi] of quasis.entries()) {
        const updated = rewritten[index];
        if (
          updated !== undefined &&
          updated !== original[index] &&
          typeof quasi.start === "number" &&
          typeof quasi.end === "number"
        ) {
          output.overwrite(
            quasi.start,
            quasi.end,
            updated.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${"),
          );
        }
      }
    }
  });
  return output.toString();
}
