import { escapeHtml } from "@pulkit/shared/html";
import type {
  BundledLanguage,
  ThemedToken,
  ThemedTokenScopeExplanation,
  ThemeRegistration,
} from "shiki";
import { bundledLanguages, createHighlighter } from "shiki";
import { tokenRole } from "./token-role.ts";

interface Chunk {
  text: string;
  role: string;
}

const plain = new Set(["", "text", "plaintext", "txt", "math", "mermaid"]);
const theme: ThemeRegistration = {
  name: "roles",
  type: "light",
  colors: {
    "editor.foreground": "#111111",
    "editor.background": "#ffffff",
  },
  settings: [{ settings: { foreground: "#111111" } }],
};
const highlighter = await createHighlighter({ themes: [theme], langs: [] });
const grammars = new Map<string, Promise<void>>();
let loading: Promise<void> = Promise.resolve();

function isBundledLanguage(id: string): id is BundledLanguage {
  return id in bundledLanguages;
}

function scopeNames(scopes: readonly ThemedTokenScopeExplanation[]): string[] {
  return scopes.map((scope) => scope.scopeName);
}

function tokenChunks(token: ThemedToken): Chunk[] {
  return token.explanation?.length
    ? token.explanation.map((part) => ({
        text: part.content,
        role: tokenRole(scopeNames(part.scopes ?? [])),
      }))
    : [{ text: token.content, role: "" }];
}

function tokensToHtml(lines: readonly ThemedToken[][]): string {
  return lines
    .map((line) => {
      const chunks: Chunk[] = [];
      for (const token of line) {
        for (const part of tokenChunks(token)) {
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

function reconstruct(lines: readonly ThemedToken[][]): string {
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

function loadGrammar(id: BundledLanguage): Promise<void> {
  const existing = grammars.get(id);
  if (existing) {
    return existing;
  }
  loading = loading.then(() => highlighter.loadLanguage(id));
  grammars.set(id, loading);
  return loading;
}

export async function highlightFence(language: string | undefined, code: string): Promise<string> {
  const id = (language ?? "").trim().toLowerCase();
  if (plain.has(id) || !isBundledLanguage(id)) {
    return escapeHtml(code);
  }
  try {
    await loadGrammar(id);
  } catch (error) {
    throw new Error(
      `Failed to load highlighter grammar for ${id}: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
  const result = highlighter.codeToTokens(code, {
    lang: id,
    theme: "roles",
    includeExplanation: "scopeName",
    tokenizeTimeLimit: 0,
  });
  if (reconstruct(result.tokens) !== code) {
    throw new Error(`Highlighter changed ${id} fence text`);
  }
  return tokensToHtml(result.tokens);
}
