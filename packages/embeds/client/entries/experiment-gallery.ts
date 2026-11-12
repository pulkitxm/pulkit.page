import { setupExperimentGallery } from "../components/experiment-gallery.ts";
import { setupGithubStars } from "../components/github-stars.ts";
import { setupProjectCodeWorkspace } from "../components/project-code-workspace.ts";
import { initProjectRecording } from "../components/project-recording.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-directory]", HTMLElement, setupExperimentGallery);
forEachElement("[data-github-stars]", HTMLElement, setupGithubStars);
forEachElement("[data-project-recording]", HTMLVideoElement, initProjectRecording);
forEachElement("[data-project]", HTMLElement, setupProjectCodeWorkspace);
