const htmlEntities: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const xmlEntities: Readonly<Record<string, string>> = { ...htmlEntities, "'": "&apos;" };
const decodedEntities: Readonly<Record<string, string>> = {
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
};

function replaceWith(entities: Readonly<Record<string, string>>): (match: string) => string {
  return (match) => entities[match] ?? match;
}

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, replaceWith(htmlEntities));
}

export function escapeAttribute(value: unknown): string {
  return String(value).replace(/[&<>"]/g, replaceWith(htmlEntities));
}

export function escapeXml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, replaceWith(xmlEntities));
}

export function unescapeHtml(value: string): string {
  return value.replace(/&(?:quot|#39|lt|gt|amp);/g, replaceWith(decodedEntities));
}
