import { setupVideoPlayer } from "../components/video-player.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("video", HTMLVideoElement, setupVideoPlayer);
