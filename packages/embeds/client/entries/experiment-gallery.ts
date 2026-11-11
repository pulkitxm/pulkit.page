import { setupExperimentGallery } from "../components/experiment-gallery.ts";
import { setupGithubStars } from "../components/github-stars.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-directory]", HTMLElement, setupExperimentGallery);
forEachElement("[data-github-stars]", HTMLElement, setupGithubStars);
