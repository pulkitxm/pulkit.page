import { setupFrameFacade } from "../components/frame-facade.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-frame-facade]", HTMLElement, setupFrameFacade);
