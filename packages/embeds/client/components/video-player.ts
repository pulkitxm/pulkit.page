import type Plyr = require("plyr");

const styles = "/assets/embeds/plyr.css";
const icons = "/assets/embeds/plyr.svg";

let player: Promise<typeof Plyr> | undefined;

function loadStyles(): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = styles;
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => resolve());
    document.head.append(link);
  });
}

function isPlayer(value: unknown): value is typeof Plyr {
  return typeof value === "function";
}

function loadPlayer(): Promise<typeof Plyr> {
  player ??= Promise.all([import("plyr"), loadStyles()]).then(([module]) => {
    const exported: unknown = Reflect.get(module, "default") ?? module;
    if (!isPlayer(exported)) {
      throw new Error("Plyr did not load");
    }
    return exported;
  });
  return player;
}

function enhance(Player: typeof Plyr, video: HTMLVideoElement): Plyr {
  return new Player(video, {
    iconUrl: icons,
    blankVideo: "",
    autoplay: video.autoplay,
    muted: video.muted || video.hasAttribute("muted"),
    loop: { active: video.loop },
    controls: ["play-large", "play", "progress", "current-time", "mute", "fullscreen"],
    fullscreen: { iosNative: true },
  });
}

export function setupVideoPlayer(video: HTMLVideoElement): void {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      loadPlayer().then((Player) => enhance(Player, video));
    },
    { rootMargin: "300px" },
  );
  observer.observe(video);
}
