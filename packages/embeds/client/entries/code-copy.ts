import { setupCodeCopy } from "../components/code-copy.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-code-copy]", HTMLElement, setupCodeCopy);
