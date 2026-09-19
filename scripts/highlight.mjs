import { bundledLanguages, createHighlighter } from "shiki";

const plain = new Set(["", "text", "plaintext", "txt", "math", "mermaid"]);
const theme = {
  name: "roles",
  type: "light",
  colors: {
    "editor.foreground": "#111111",
    "editor.background": "#ffffff",
  },
  settings: [{ settings: { foreground: "#111111" } }],
};
const highlighter = await createHighlighter({ themes: [theme], langs: [] });
const loaded = new Set();

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

function tokenRole(scopes) {
  const names = scopes.map((scope) => (typeof scope === "string" ? scope : scope.scopeName));
  const has = (pattern) => names.some((name) => pattern.test(name));
  if (has(/comment/)) {
    return "text-syn-c italic";
  }
  if (
    has(
      /entity\.other\.attribute-name|variable\.other\.property|support\.type\.property-name|meta\.object-literal\.key/,
    )
  ) {
    return "text-syn-p";
  }
  if (has(/string|regexp|heredoc/)) {
    return "text-syn-s";
  }
  if (has(/constant\.numeric|constant\.digit|\.numeric/)) {
    return "text-syn-n";
  }
  if (has(/entity\.name\.function|support\.function/)) {
    return "text-syn-f";
  }
  if (has(/entity\.name\.tag/)) {
    return "text-syn-g";
  }
  if (has(/entity\.name\.type|entity\.name\.class|support\.class|support\.type/)) {
    return "text-syn-t";
  }
  if (has(/keyword\.operator/)) {
    return "text-syn-o";
  }
  if (has(/storage(?:\.|$)|keyword\.|constant\.language|support\.constant/)) {
    return "text-syn-k";
  }
  if (has(/punctuation|meta\.brace/)) {
    return "text-syn-u";
  }
  return "";
}

function tokensToHtml(lines) {
  return lines
    .map((line) => {
      const chunks = [];
      for (const token of line) {
        const parts = token.explanation?.length
          ? token.explanation.map((part) => ({
              text: part.content,
              role: tokenRole(part.scopes ?? []),
            }))
          : [{ text: token.content, role: "" }];
        for (const part of parts) {
          const previous = chunks.at(-1);
          if (previous && previous.role === part.role) {
            previous.text += part.text;
          } else {
            chunks.push({ ...part });
          }
        }
      }
      return chunks
        .map((chunk) =>
          chunk.role
            ? `<span class="${chunk.role}">${escapeHtml(chunk.text)}</span>`
            : escapeHtml(chunk.text),
        )
        .join("");
    })
    .join("\n");
}

function reconstruct(lines) {
  return lines
    .map((line) =>
      line
        .map((token) =>
          token.explanation?.length
            ? token.explanation.map((part) => part.content).join("")
            : token.content,
        )
        .join(""),
    )
    .join("\n");
}

export async function highlightFence(language, code) {
  const id = (language ?? "").trim().toLowerCase();
  if (plain.has(id) || !(id in bundledLanguages)) {
    return escapeHtml(code);
  }
  if (!loaded.has(id)) {
    try {
      await highlighter.loadLanguage(id);
    } catch (error) {
      throw new Error(
        `Failed to load highlighter grammar for ${id}: ${error instanceof Error ? error.message : error}`,
        { cause: error },
      );
    }
    loaded.add(id);
  }
  const result = highlighter.codeToTokens(code, {
    lang: id,
    theme: "roles",
    includeExplanation: "scopeName",
  });
  if (reconstruct(result.tokens) !== code) {
    throw new Error(`Highlighter changed ${id} fence text`);
  }
  return tokensToHtml(result.tokens);
}
