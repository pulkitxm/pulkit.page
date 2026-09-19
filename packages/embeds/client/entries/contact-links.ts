import { setupContactCopy } from "../components/contact-links.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-contact-copy]", HTMLElement, setupContactCopy);
