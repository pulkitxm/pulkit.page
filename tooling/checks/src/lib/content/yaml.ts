import { isAlias, isCollection, isScalar, parseDocument, visit } from "yaml";

export interface ParsedYaml {
  value: unknown;
  errors: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function strictYaml(source: string): ParsedYaml {
  const document = parseDocument(source, { uniqueKeys: true, strict: true });
  const errors = [...document.errors, ...document.warnings].map((error) => error.message);
  visit(document, (_, node) => {
    if (isAlias(node) || ((isScalar(node) || isCollection(node)) && (node.anchor || node.tag))) {
      errors.push("YAML aliases, anchors, and explicit tags are forbidden");
    }
  });
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  return { value, errors };
}

export function yamlValue(source: string): unknown {
  const value: unknown = parseDocument(source).toJS();
  return value;
}
