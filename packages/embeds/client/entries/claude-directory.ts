import { setupClaudeDirectory } from "../components/claude-directory.ts";
import { setupPromptCopy } from "../components/prompt-copy.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-directory]", HTMLElement, setupClaudeDirectory);
forEachElement("[data-prompt-copy]", HTMLButtonElement, setupPromptCopy);
