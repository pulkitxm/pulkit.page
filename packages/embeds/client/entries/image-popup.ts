import { setupImagePopup } from "../components/image-popup.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-image-popup]", HTMLElement, setupImagePopup);
