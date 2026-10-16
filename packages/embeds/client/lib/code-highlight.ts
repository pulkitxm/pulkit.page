import { tokenRole } from "@pulkit/code/token-role";
import { escapeHtml } from "@pulkit/shared/html";
import type { HighlighterCore, LanguageRegistration, ThemedToken } from "shiki/core";

type Grammar = () => Promise<{ default: LanguageRegistration[] }>;

const grammars: Readonly<Record<string, Grammar>> = {
  bash: () => import("shiki/langs/bash.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  less: () => import("shiki/langs/less.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
};

const extensions: Readonly<Record<string, string>> = {
  cjs: "javascript",
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  less: "less",
  md: "markdown",
  mjs: "javascript",
  scss: "scss",
  sh: "bash",
  svg: "xml",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

let highlighter: Promise<HighlighterCore> | undefined;

function load(): Promise<HighlighterCore> {
  highlighter ??= Promise.all([import("shiki/core"), import("shiki/engine/javascript")]).then(
    ([core, engine]) =>
      core.createHighlighterCore({
        themes: [
          {
            name: "roles",
            type: "light",
            settings: [{ settings: { foreground: "#111111" } }],
          },
        ],
        langs: [],
        engine: engine.createJavaScriptRegexEngine(),
      }),
  );
  return highlighter;
}

export function languageOf(path: string): string | undefined {
  return extensions[path.split(".").at(-1)?.toLowerCase() ?? ""];
}

function lineHtml(line: readonly ThemedToken[]): string {
  return line
    .flatMap((token) =>
      token.explanation?.length
        ? token.explanation.map((part) => ({
            text: part.content,
            role: tokenRole(part.scopes.map((scope) => scope.scopeName)),
          }))
        : [{ text: token.content, role: "" }],
    )
    .map(({ text, role }) =>
      role ? `<span class="${role}">${escapeHtml(text)}</span>` : escapeHtml(text),
    )
    .join("");
}

export async function highlight(code: string, language: string): Promise<string> {
  const grammar = grammars[language];
  if (!grammar) {
    return escapeHtml(code);
  }
  const core = await load();
  if (!core.getLoadedLanguages().includes(language)) {
    await core.loadLanguage((await grammar()).default);
  }
  const { tokens } = core.codeToTokens(code, {
    lang: language,
    theme: "roles",
    includeExplanation: "scopeName",
  });
  return tokens.map(lineHtml).join("\n");
}
