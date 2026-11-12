import { z } from "zod";
import { experimentPathSchema } from "./experiments.ts";

export const projectSourceLimits = {
  files: 512,
  fileBytes: 300 * 1024,
  totalBytes: 4 * 1024 * 1024,
} as const;
const languages = {
  html: "html",
  css: "css",
  tsx: "tsx",
  ts: "typescript",
  js: "javascript",
  mjs: "javascript",
  json: "json",
} as const;
const deniedDirectories =
  /^(?:node_modules|dist|build|coverage|references?|captures?|scrapes?|screenshots?|recordings?)$/i;

export function projectSourceLanguage(
  path: string,
): "html" | "css" | "tsx" | "typescript" | "javascript" | "json" | "text" | null {
  const parts = path.split("/");
  if (
    !path ||
    path.includes("\\") ||
    parts.some((part) => !part || part === "." || part === ".." || !/^[a-zA-Z0-9_.@-]+$/.test(part))
  ) {
    return null;
  }
  if (parts.slice(0, -1).some((part) => part.startsWith(".") || deniedDirectories.test(part))) {
    return null;
  }
  const name = parts.at(-1) ?? "";
  if (name === ".gitignore" || path === "LICENSES/three-MIT.txt") {
    return "text";
  }
  if (name.startsWith(".")) {
    return null;
  }
  const extension = name.split(".").at(-1) ?? "";
  return Object.hasOwn(languages, extension)
    ? languages[extension as keyof typeof languages]
    : null;
}

export function projectSourceUrl(project: string): string {
  return `/assets/project-source/${experimentPathSchema.parse(project).replaceAll("/", "--")}.json`;
}

export const projectSourceSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    project: experimentPathSchema,
    files: z
      .array(
        z
          .object({
            path: z.string().max(512),
            language: z.enum(["html", "css", "tsx", "typescript", "javascript", "json", "text"]),
            content: z
              .string()
              .max(projectSourceLimits.fileBytes)
              .refine(
                (text) =>
                  !text.includes("\0") &&
                  new TextEncoder().encode(text).byteLength <= projectSourceLimits.fileBytes,
              ),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1)
      .max(projectSourceLimits.files),
    notices: z
      .object({ href: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((bundle, context) => {
    let total = 0;
    for (const [index, file] of bundle.files.entries()) {
      total += new TextEncoder().encode(file.content).byteLength;
      if (
        projectSourceLanguage(file.path) !== file.language ||
        (index > 0 && (bundle.files[index - 1]?.path ?? "") >= file.path)
      ) {
        context.addIssue({
          code: "custom",
          message: "Source paths must be approved, sorted, unique and correctly typed",
        });
      }
    }
    if (
      total > projectSourceLimits.totalBytes ||
      (bundle.notices &&
        bundle.notices.href !==
          `/assets/project-previews/${bundle.project.replaceAll("/", "--")}/source-notices.txt`)
    ) {
      context.addIssue({
        code: "custom",
        message: "Source bundle exceeds its limits or has invalid notices",
      });
    }
  });

export type ProjectSourceBundle = z.infer<typeof projectSourceSchema>;

export const projectSourceManifestSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    tree: z.string().regex(/^[a-f0-9]{40}$/),
    registry_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    provenance_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    inline_artwork_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    license_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    projects: z
      .array(
        z
          .object({
            project: experimentPathSchema,
            project_source_tree: z.string().regex(/^[a-f0-9]{40}$/),
            href: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z
              .number()
              .int()
              .positive()
              .max(8 * 1024 * 1024),
            files: z
              .array(
                z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
              )
              .min(1)
              .max(projectSourceLimits.files),
            notices: z
              .object({ href: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
              .strict(),
            source_notices_sha256: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(512),
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const [index, entry] of manifest.projects.entries()) {
      if (
        entry.href !== projectSourceUrl(entry.project) ||
        entry.notices.href !==
          `/assets/project-previews/${entry.project.replaceAll("/", "--")}/source-notices.txt` ||
        (index > 0 && (manifest.projects[index - 1]?.project ?? "") >= entry.project)
      ) {
        context.addIssue({
          code: "custom",
          message: "Source manifest must list unique approved project paths in order",
        });
      }
      for (const [fileIndex, file] of entry.files.entries()) {
        if (
          !projectSourceLanguage(file.path) ||
          (fileIndex > 0 && (entry.files[fileIndex - 1]?.path ?? "") >= file.path)
        ) {
          context.addIssue({
            code: "custom",
            message: "Source manifest has an invalid file inventory",
          });
        }
      }
    }
  });
