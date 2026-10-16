import { setupClaudeDirectory } from "../components/claude-directory.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-directory]", HTMLElement, setupClaudeDirectory);
