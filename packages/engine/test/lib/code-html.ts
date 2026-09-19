import { unescapeHtml } from "@pulkit/shared/html";

export function codeInner(html: string): string {
  const match = /<pre[^>]*>\s*<code class="language-[^"]+">([\s\S]*?)<\/code>\s*<\/pre>/.exec(html);
  if (!match?.[1]) {
    throw new Error("Expected a highlighted code block");
  }
  return match[1];
}

export function visibleText(html: string): string {
  return unescapeHtml(
    codeInner(html)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) =>
        line.replace(/^<span class="block [^"]+">|<\/span>$/g, "").replace("<br />", ""),
      )
      .join("\n")
      .replace(/<span class="[^"]+">/g, "")
      .replace(/<\/span>/g, ""),
  ).replace(/\n$/, "");
}
