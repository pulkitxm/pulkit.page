import { z } from "zod";
import { experimentPathSchema, experimentRepository } from "../content/experiments.ts";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const approvalSchema = z.object({
  version: z.literal(1),
  repository: z.literal(experimentRepository),
  revision: revisionSchema,
  tree: revisionSchema,
  paths: z.array(experimentPathSchema).min(1),
  registry_sha256: hashSchema,
  provenance_sha256: hashSchema,
  license_sha256: hashSchema,
  inline_artwork_sha256: hashSchema,
});
export const registrySchema = z.array(
  z.object({ path: experimentPathSchema, status: z.string(), review: z.string() }),
);
export const provenanceSchema = z.object({
  version: z.literal(1),
  assets: z.array(z.unknown()).length(0),
  remote_dependencies: z.array(z.unknown()).length(0),
});
const relativePath = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.includes("\\") &&
      [...path].every((character) => character.charCodeAt(0) >= 32) &&
      !path.startsWith("/") &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
  );
const reviewedFiles = z.array(z.object({ path: relativePath, sha256: hashSchema }));
export const inlineSchema = z.object({
  version: z.literal(1),
  files: z.array(z.object({ path: relativePath, sha256: hashSchema, review: z.string().min(40) })),
  licenses: reviewedFiles,
  notices: reviewedFiles,
});
const mediaSchema = z.object({ sha256: hashSchema, bytes: z.number().int().positive() });
const captureSchema = z.object({
  version: z.literal(1),
  project: experimentPathSchema,
  captured_at: z.string().datetime(),
  source_mode: z.literal("pinned-local-build"),
  source_repository: z.literal(experimentRepository),
  source_revision: revisionSchema,
  source_tree: revisionSchema,
  project_source_tree: revisionSchema,
  project_build_sha256: hashSchema,
  input_video_sha256: hashSchema,
  observations_sha256: hashSchema,
  built_files: reviewedFiles.min(1),
  capture_tool_sha256: hashSchema,
  capture_producer_sha256: hashSchema,
  reviewed_source_revision: revisionSchema,
  command: z
    .string()
    .regex(
      /^bun run gallery:record --site <verified-media-free-build> --out <fresh-staging-directory> --workers [1-8]$/,
    ),
  normalization: z
    .object({
      operation: z.literal("Retain the final thirteen seconds of the fresh animation recording"),
      input_sha256: hashSchema,
      input_duration_seconds: z.number().min(40),
    })
    .optional(),
  viewport: z.object({ width: z.literal(1280), height: z.literal(800) }),
  fps: z.literal(30),
  duration_seconds: z.number().positive().max(40),
  mode: z.enum(["scroll-sequence", "animation-hold"]),
  assets: z.object({ "poster.webp": mediaSchema, "demo.mp4": mediaSchema }),
  notices_sha256: hashSchema,
  source_notices_sha256: hashSchema,
  notices_normalization: z.literal(
    "CRLF to LF line endings only; license and attribution text unchanged",
  ),
  software: z.object({
    playwright: z.object({ version: z.string().min(1), license: z.literal("Apache-2.0") }),
    browser: z.object({
      version: z.string().min(1),
      terms: z.literal("https://www.google.com/chrome/terms/"),
      redistributed: z.literal(false),
    }),
    sharp: z.object({
      version: z.string().min(1),
      license: z.literal("Apache-2.0"),
      libvips: z.string().min(1),
      webp: z.string().min(1),
      redistributed: z.literal(false),
    }),
    ffmpeg: z.object({
      version: z.string().min(1),
      license: z.literal("GPL-3.0-or-later"),
      license_url: z.literal("https://www.gnu.org/licenses/gpl-3.0.html"),
      redistributed: z.literal(false),
    }),
  }),
  runtime: z.object({
    page_errors: z.array(z.unknown()).length(0),
    failed_requests: z.array(z.unknown()).length(0),
    blocked_external_requests: z.array(z.unknown()).length(0),
    bad_responses: z.array(z.unknown()).length(0),
    viewports: z
      .array(
        z.object({
          width: z.number(),
          overflow: z.number().max(1),
          nonzero_graphics: z.literal(true),
        }),
      )
      .length(2),
  }),
});
export const manifestSchema = z.object({
  version: z.literal(1),
  source_repository: z.literal(experimentRepository),
  source_revision: revisionSchema,
  source_tree: revisionSchema,
  input_verifier_sha256: hashSchema,
  input_verifier_source: relativePath,
  finalizer_sha256: hashSchema,
  finalizer_source: relativePath,
  recipes: z
    .array(
      z.object({
        worker_sha256: hashSchema,
        producer_sha256: hashSchema,
        worker_source: relativePath,
        producer_source: relativePath,
      }),
    )
    .min(1),
  recordings: z.array(captureSchema).min(1),
});
export const descriptionsSchema = z.record(
  experimentPathSchema,
  z.object({
    title: z.string().min(1).max(180),
    summary: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
  }),
);
