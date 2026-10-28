import { startChrome } from "./features/chrome.ts";
import { startMenu } from "./features/menu.ts";
import { startTransitions } from "./features/transitions.ts";
import { startScene } from "./scene/host.ts";

startScene();
startMenu();
startChrome();
startTransitions();
