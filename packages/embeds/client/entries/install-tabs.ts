import { setupInstallTabs } from "../components/install-tabs.ts";
import { findElements } from "../lib/dom.ts";

setupInstallTabs(findElements(document, "[data-install-tabs]", HTMLElement));
