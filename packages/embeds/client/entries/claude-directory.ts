import { setupClaudeDirectory } from "../components/claude-directory.ts";
import { setupGithubStars } from "../components/github-stars.ts";
import { setupProjectView } from "../components/project-view.ts";
import { setupPromptCopy } from "../components/prompt-copy.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-prompt-copy]", HTMLButtonElement, setupPromptCopy);
forEachElement("[data-directory]", HTMLElement, setupClaudeDirectory);
forEachElement("[data-github-stars]", HTMLElement, setupGithubStars);
forEachElement("[data-project]", HTMLElement, setupProjectView);
