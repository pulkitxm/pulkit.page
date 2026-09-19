import { setupDocumentTabs } from "../components/document-tabs.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-document-tabs]", HTMLElement, setupDocumentTabs);
