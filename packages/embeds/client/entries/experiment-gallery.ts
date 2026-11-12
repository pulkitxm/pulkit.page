import { afterPageLoad } from "@pulkit/shared/idle";
import { setupExperimentGallery } from "../components/experiment-gallery.ts";
import { setupGithubStars } from "../components/github-stars.ts";
import { setupProjectCodeWorkspace } from "../components/project-code-workspace.ts";
import { initProjectRecording } from "../components/project-recording.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-directory]", HTMLElement, setupExperimentGallery);
forEachElement("[data-github-stars]", HTMLElement, setupGithubStars);
afterPageLoad(() => {
  forEachElement("[data-project]", HTMLElement, setupProjectCodeWorkspace);
  forEachElement("[data-project-recording]", HTMLVideoElement, initProjectRecording);
});
