import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  readExperimentCatalog,
  removeRetiredGalleryArtwork,
} from "@pulkit/shared/experiment-catalog";
import { experimentPathSchema } from "@pulkit/shared/experiments";
import { sha256Hex as hash } from "@pulkit/shared/hash";
import sharp from "sharp";
import { normalizeCaptureNotices, verifyCaptureInput } from "./capture-input.ts";
import { sourcePublication } from "./source-publication.ts";

const argumentsByName = new Map(
  process.argv
    .slice(2)
    .flatMap((value, index, all) =>
      value.startsWith("--") ? [[value.slice(2), all[index + 1] ?? ""]] : [],
    ),
);
const site = resolve(argumentsByName.get("site") ?? "");
const source = resolve(argumentsByName.get("source") ?? "");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const jobs = JSON.parse(readFileSync(argumentsByName.get("jobs") ?? "", "utf8")) as {
  directory: string;
  worker_sha256: string;
  producer_sha256: string;
  reviewed_revision: string;
  reviewed_raw_projects?: string[];
  artifact_manifest?: string;
  raw_reviews?: Record<string, { video_sha256: string; observations_sha256: string }>;
}[];
if (!argumentsByName.has("site") || !argumentsByName.has("source") || jobs.length === 0) {
  throw new Error(
    "Usage: gallery:finalize --site <verified-build> --source <source-checkout> --jobs <private-job-manifest>",
  );
}
const data = join(root, "apps/page/data/experiment-gallery");
const output = join(root, "apps/page/assets/project-previews");
const approval = JSON.parse(readFileSync(join(data, "approval.json"), "utf8")) as {
  revision: string;
  tree: string;
  paths: string[];
};
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);
const git = (value: string) =>
  execFileSync("git", ["-C", source, "rev-parse", value], { env, encoding: "utf8" }).trim();
if (git(`${approval.revision}^{tree}`) !== approval.tree) {
  throw new Error("Reviewed source tree does not match capture approval");
}
function probe(path: string) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate:format=duration,size",
        "-of",
        "json",
        path,
      ],
      { encoding: "utf8" },
    ),
  );
}
function list(directory: string): { path: string; sha256: string }[] {
  const walk = (prefix: string): string[] =>
    readdirSync(prefix, { withFileTypes: true }).flatMap((entry) => {
      const path = join(prefix, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Capture source must not contain symlinks");
      }
      return entry.isDirectory() ? walk(path) : [path];
    });
  return walk(directory)
    .map((file) => ({ path: relative(directory, file), sha256: hash(readFileSync(file)) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
for (const path of approval.paths) {
  experimentPathSchema.parse(path);
}
if (new Set(approval.paths).size !== approval.paths.length) {
  throw new Error("Duplicate approved capture path");
}
for (const job of jobs) {
  if (
    !/^[a-f0-9]{64}$/.test(job.worker_sha256) ||
    !/^[a-f0-9]{64}$/.test(job.producer_sha256) ||
    !/^[a-f0-9]{40}$/.test(job.reviewed_revision)
  ) {
    throw new Error("Capture execution record has an invalid source or tool identity");
  }
}
const complete: {
  name: string;
  poster: Buffer;
  video: Buffer;
  notice: string;
  record: Record<string, unknown>;
}[] = [];
const recipes = new Map<
  string,
  { worker_sha256: string; producer_sha256: string; worker_source: string; producer_source: string }
>();
for (const project of approval.paths) {
  const name = project.replaceAll("/", "--");
  const candidates = jobs.filter(
    (job) =>
      !existsSync(join(job.directory, name, "capture-interrupted.json")) &&
      existsSync(join(job.directory, name, "observations.json")) &&
      existsSync(join(job.directory, name, "demo.mp4")),
  );
  const candidate =
    candidates.find((job) => existsSync(join(job.directory, name, "capture.json"))) ??
    candidates[0];
  if (!candidate) {
    throw new Error(`Fresh project recording is incomplete: ${project}`);
  }
  const { directory, worker_sha256, producer_sha256, reviewed_revision } = candidate;
  const captureJob = JSON.parse(readFileSync(join(directory, "capture-job.json"), "utf8"));
  if (
    captureJob.tool_sha256 !== worker_sha256 ||
    (captureJob.producer_sha256 && captureJob.producer_sha256 !== producer_sha256) ||
    JSON.stringify(captureJob.approved_paths) !== JSON.stringify(approval.paths)
  ) {
    throw new Error("Capture job source or recipe differs from the reviewed execution record");
  }
  const prefix = join(directory, name);
  const observations = JSON.parse(readFileSync(join(prefix, "observations.json"), "utf8"));
  if (
    observations.page_errors.length > 0 ||
    observations.failed_requests.length > 0 ||
    observations.blocked_external_requests.length > 0 ||
    observations.bad_responses.length > 0 ||
    observations.viewports.length !== 2 ||
    observations.viewports.some(
      (viewport: { overflow: number; nonzero_graphics: boolean }) =>
        viewport.overflow > 1 || !viewport.nonzero_graphics,
    )
  ) {
    throw new Error(`Responsive runtime checks require review: ${project}`);
  }
  const built = list(join(site, project));
  const buildHash = hash(built.map((file) => `${file.path}\0${file.sha256}\n`).join(""));
  const existingPath = join(prefix, "capture.json");
  const existing = existsSync(existingPath) ? JSON.parse(readFileSync(existingPath, "utf8")) : null;
  const snapshotPath = join(prefix, "source-snapshot.json");
  const snapshot = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, "utf8")) : null;
  if (
    (existing && existing.project_build_sha256 !== buildHash) ||
    (snapshot && snapshot.project_build_sha256 !== buildHash)
  ) {
    throw new Error(`Captured project changed before promotion: ${project}`);
  }
  if (!existing && !snapshot) {
    if (!candidate.reviewed_raw_projects?.includes(project) || !candidate.artifact_manifest) {
      throw new Error(`Unrecorded capture requires an explicit source review: ${project}`);
    }
    const original: { path: string; sha256: string }[] = JSON.parse(
      readFileSync(candidate.artifact_manifest, "utf8"),
    );
    const expected = original
      .filter((file) => file.path.startsWith(`${project}/`))
      .map((file) => ({ path: file.path.slice(project.length + 1), sha256: file.sha256 }))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (JSON.stringify(expected) !== JSON.stringify(built)) {
      throw new Error(
        `Raw fresh capture no longer matches its independently reviewed artifact: ${project}`,
      );
    }
  }
  const projectTree = git(`${approval.revision}:${project}`);
  if (git(`${reviewed_revision}:${project}`) !== projectTree) {
    throw new Error(`Project source changed after its recording review: ${project}`);
  }
  const video = join(prefix, "demo.mp4");
  const inputBinding = verifyCaptureInput(
    readFileSync(video),
    readFileSync(join(prefix, "observations.json")),
    existing,
    candidate.raw_reviews?.[project],
  );
  let metadata = probe(video);
  let normalization: {
    operation: string;
    input_sha256: string;
    input_duration_seconds: number;
  } | null = null;
  if (Number(metadata.format.duration) > 40 && observations.mode === "animation-hold") {
    const target = join(prefix, "bounded-demo.mp4");
    normalization = {
      operation: "Retain the final thirteen seconds of the fresh animation recording",
      input_sha256: hash(readFileSync(video)),
      input_duration_seconds: Number(metadata.format.duration),
    };
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-sseof",
        "-13",
        "-i",
        video,
        "-t",
        "13",
        "-r",
        "30",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "24",
        "-maxrate",
        "1200k",
        "-bufsize",
        "2400k",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        target,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    metadata = probe(target);
  }
  const selected = normalization ? join(prefix, "bounded-demo.mp4") : video;
  const stream = metadata.streams[0];
  if (
    stream.width !== 1280 ||
    stream.height !== 800 ||
    stream.r_frame_rate !== "30/1" ||
    Number(metadata.format.duration) > 40 ||
    Number(metadata.format.size) > 6 * 1024 * 1024
  ) {
    throw new Error(`Fresh recording exceeds its media budget: ${project}`);
  }
  const posterBytes = execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      selected,
      "-vf",
      `thumbnail=${90}`,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-c:v",
      "png",
      "pipe:1",
    ],
    { maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  const poster = await sharp(posterBytes)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const license = readFileSync(join(site, "LICENSE"), "utf8");
  const noticePath = join(site, project, "THIRD_PARTY_NOTICES.txt");
  const { notices: notice, ...noticeBinding } = normalizeCaptureNotices(
    `${license}\n\n${existsSync(noticePath) ? readFileSync(noticePath, "utf8") : ""}`,
  );
  if (existing?.notices_sha256 && existing.notices_sha256 !== noticeBinding.source_notices_sha256) {
    throw new Error(`Capture source notices changed before promotion: ${project}`);
  }
  complete.push({
    name,
    poster,
    video: readFileSync(selected),
    notice,
    record: {
      version: 1,
      ...inputBinding,
      project,
      captured_at: existing?.captured_at ?? statSync(video).mtime.toISOString(),
      source_mode: "pinned-local-build",
      source_repository: "pulkitxm/claude-directory",
      source_revision: approval.revision,
      source_tree: approval.tree,
      reviewed_source_revision: reviewed_revision,
      project_source_tree: projectTree,
      project_build_sha256: buildHash,
      built_files: built,
      ...sourcePublication(source, approval, project, noticeBinding),
      capture_tool_sha256: worker_sha256,
      capture_producer_sha256: producer_sha256,
      command:
        "bun run gallery:record --site <verified-media-free-build> --out <fresh-staging-directory> --workers 4",
      viewport: { width: 1280, height: 800 },
      fps: 30,
      duration_seconds: Number(metadata.format.duration),
      mode: observations.mode,
      assets: {
        "poster.webp": { sha256: hash(poster), bytes: poster.length },
        "demo.mp4": { sha256: hash(readFileSync(selected)), bytes: Number(metadata.format.size) },
      },
      ...noticeBinding,
      software: {
        ...(existing?.software ?? {
          playwright: { version: "1.63.0", license: "Apache-2.0" },
          browser: {
            version: observations.browser,
            terms: "https://www.google.com/chrome/terms/",
            redistributed: false,
          },
          ffmpeg: {
            version: execFileSync("ffmpeg", ["-version"], { encoding: "utf8" }).split("\n")[0],
            license: "GPL-3.0-or-later",
            license_url: "https://www.gnu.org/licenses/gpl-3.0.html",
            redistributed: false,
          },
        }),
        sharp: {
          version: sharp.versions.sharp,
          license: "Apache-2.0",
          libvips: sharp.versions.vips,
          webp: sharp.versions.webp,
          redistributed: false,
        },
      },
      runtime: observations,
      ...(normalization ? { normalization } : {}),
    },
  });
  recipes.set(`${worker_sha256}:${producer_sha256}`, {
    worker_sha256,
    producer_sha256,
    worker_source: `recipes/${worker_sha256}.txt`,
    producer_source: `recipes/${producer_sha256}.txt`,
  });
}
if (
  complete.reduce((bytes, item) => bytes + item.poster.length + item.video.length, 0) >
  550 * 1024 * 1024
) {
  throw new Error("Fresh preview gallery exceeds its total media budget");
}
if (existsSync(output)) {
  throw new Error("Existing public previews require manual review before replacement");
}
mkdirSync(output, { recursive: true });
const finalizerBytes = readFileSync(fileURLToPath(import.meta.url));
const finalizerHash = hash(finalizerBytes);
const verifierBytes = readFileSync(fileURLToPath(new URL("./capture-input.ts", import.meta.url)));
const verifierHash = hash(verifierBytes);
mkdirSync(join(output, "recipes"), { recursive: true });
writeFileSync(join(output, "recipes", `${finalizerHash}.txt`), finalizerBytes);
writeFileSync(join(output, "recipes", `${verifierHash}.txt`), verifierBytes);
for (const recipe of recipes.values()) {
  for (const [path, sha] of [
    [recipe.worker_source, recipe.worker_sha256],
    [recipe.producer_source, recipe.producer_sha256],
  ] as const) {
    const sourceRecipe = join(data, "capture-recipes", `${sha}.txt`);
    if (hash(readFileSync(sourceRecipe)) !== sha) {
      throw new Error("Capture recipe source is missing or changed");
    }
    mkdirSync(join(output, "recipes"), { recursive: true });
    cpSync(sourceRecipe, join(output, path));
  }
}
for (const item of complete) {
  const destination = join(output, item.name);
  mkdirSync(destination, { recursive: true });
  writeFileSync(join(destination, "poster.webp"), item.poster);
  writeFileSync(join(destination, "demo.mp4"), item.video);
  writeFileSync(join(destination, "source-notices.txt"), item.notice);
}
writeFileSync(
  join(output, "provenance.json"),
  `${JSON.stringify({ version: 2, source_repository: "pulkitxm/claude-directory", source_revision: approval.revision, source_tree: approval.tree, input_verifier_sha256: verifierHash, input_verifier_source: `recipes/${verifierHash}.txt`, finalizer_sha256: finalizerHash, finalizer_source: `recipes/${finalizerHash}.txt`, recipes: [...recipes.values()], recordings: complete.map((item) => item.record) }, null, 2)}\n`,
);
removeRetiredGalleryArtwork(root);
const catalog = readExperimentCatalog(root);
console.log("Promoted", catalog.projects.length, "fresh reviewed previews");
