import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

async function entryScript(): Promise<string> {
  const names: Record<string, string> = {
    "experiment-gallery": "setupExperimentGallery",
    "github-stars": "setupGithubStars",
    "project-code-workspace": "setupProjectCodeWorkspace",
    "project-recording": "initProjectRecording",
  };
  const result = await Bun.build({
    entrypoints: [
      fileURLToPath(new URL("../client/entries/experiment-gallery.ts", import.meta.url)),
    ],
    target: "browser",
    plugins: [
      {
        name: "synthetic-startup-controllers",
        setup(build) {
          build.onResolve({ filter: /\/components\/[a-z-]+\.ts$/ }, ({ path }) => {
            const name = path.split("/").at(-1)?.replace(/\.ts$/, "") ?? "";
            return names[name] ? { path: name, namespace: "startup-fixture" } : undefined;
          });
          build.onLoad({ filter: /.*/, namespace: "startup-fixture" }, ({ path }) => ({
            loader: "js",
            contents: `export function ${names[path]}(element) { globalThis.initialize(${JSON.stringify(path)}, element); }`,
          }));
        },
      },
    ],
  });
  if (!result.success || !result.outputs[0]) {
    throw new Error("Synthetic gallery entry build failed");
  }
  return result.outputs[0].text();
}

function start(script: string, search: string) {
  class Element {}
  class Video extends Element {
    bound = false;
    preview = false;
  }
  const video = new Video();
  const calls: string[] = [];
  const elements = new Map([
    ["[data-directory]", [new Element()]],
    ["[data-github-stars]", [new Element()]],
    ["[data-project-recording]", [video]],
    ["[data-project]", [new Element()]],
  ]);
  const document = {
    readyState: "interactive",
    querySelectorAll: (selector: string) => elements.get(selector) ?? [],
  };
  runInNewContext(script, {
    document,
    HTMLElement: Element,
    HTMLVideoElement: Video,
    addEventListener: () => {
      throw new Error("Interactive gallery startup must not wait for window load");
    },
    requestIdleCallback: () => {
      throw new Error("Interactive gallery startup must not wait for idle callbacks");
    },
    initialize: (name: string) => {
      calls.push(name);
      if (name === "project-recording") {
        video.bound = true;
        video.preview = true;
      }
      if (name === "project-code-workspace" && search === "?view=code") {
        expect(video.bound).toBe(true);
        video.preview = false;
      }
    },
  });
  return { calls, video, document };
}

test("binds gallery, Code and recording controls while page assets still delay window load", async () => {
  const result = start(await entryScript(), "");
  expect(result.document.readyState).toBe("interactive");
  expect(result.calls).toEqual([
    "experiment-gallery",
    "github-stars",
    "project-recording",
    "project-code-workspace",
  ]);
  expect(result.video.bound).toBe(true);
  expect(result.video.preview).toBe(true);
});

test("initial Code links reach an initialized recording controller before choosing the view", async () => {
  const result = start(await entryScript(), "?view=code");
  expect(result.video.bound).toBe(true);
  expect(result.video.preview).toBe(false);
});
