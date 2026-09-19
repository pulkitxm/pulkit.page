export const siteConfigFile = "content/_site.md";

export const pageFields = [
  "title",
  "description",
  "layout",
  "date",
  "role",
  "period",
  "endDate",
  "icon",
  "darkIcon",
  "secondaryIcon",
  "tags",
] as const;

export const siteFields = [
  "brand",
  "description",
  "copyright",
  "navigation",
  "social",
  "articles",
] as const;

export const requiredSiteFields = ["brand", "description", "copyright", "navigation"] as const;

export const textFields = [
  ...pageFields.filter((field) => field !== "tags"),
  "brand",
  "articles",
  "copyright",
] as const;

interface Frontmatter {
  yaml: string;
  body: string;
  length: number;
}

interface FrontmatterOptions {
  crlf?: boolean;
  closedByEndOfFile?: boolean;
}

export function splitFrontmatter(
  source: string,
  { crlf = false, closedByEndOfFile = false }: FrontmatterOptions = {},
): Frontmatter | undefined {
  const newline = crlf ? "\\r?\\n" : "\\n";
  const closing = closedByEndOfFile ? `(?:${newline}|$)` : newline;
  const match = new RegExp(`^---${newline}([\\s\\S]*?)${newline}---${closing}`).exec(source);
  if (!match) {
    return;
  }
  return { yaml: match[1] ?? "", body: source.slice(match[0].length), length: match[0].length };
}
