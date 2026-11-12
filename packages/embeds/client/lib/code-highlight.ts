import { tokenRole } from "@pulkit/code/token-role";
import { escapeHtml } from "@pulkit/shared/html";
import type { HighlighterCore, LanguageRegistration, ThemedToken } from "shiki/core";

type Grammar = () => Promise<{ default: LanguageRegistration[] }>;

const grammars: Record<string, Grammar> = {
  css: () => import("shiki/langs/css.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
};
let highlighter: Promise<HighlighterCore> | undefined;
let loading: Promise<void> = Promise.resolve();

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

function lineHtml(tokens: ThemedToken[]): string {
  return tokens
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

export async function highlightProjectCode(code: string, language: string): Promise<string> {
  const grammar = grammars[language];
  if (!grammar || code.length > 100 * 1024) {
    return escapeHtml(code);
  }
  const core = await load();
  loading = loading.then(async () => {
    if (!core.getLoadedLanguages().includes(language)) {
      await core.loadLanguage((await grammar()).default);
    }
  });
  await loading;
  const { tokens } = core.codeToTokens(code, {
    lang: language,
    theme: "roles",
    includeExplanation: "scopeName",
    tokenizeTimeLimit: 0,
  });
  const reconstructed = tokens
    .map((line) => line.map((token) => token.content).join(""))
    .join("\n");
  if (reconstructed !== code) {
    return escapeHtml(code);
  }
  return tokens.map(lineHtml).join("\n");
}
