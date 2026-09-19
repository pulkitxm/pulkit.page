import { setupDocumentFrame } from "../components/document-frame.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-document-frame]", HTMLAnchorElement, setupDocumentFrame);
