import { z } from "zod";

export const experimentRepository = "pulkitxm/claude-directory";
const experimentPreviewOrigin = "https://claude-directory.pulkitxm.com/";

export const experimentCategories: Readonly<Record<string, string>> = {
  "3d-games": "3D games",
  "animations-loaders": "Animations and loaders",
  "components-ui": "UI components",
  "hero-sections": "Hero sections",
  "landing-pages": "Landing pages",
  portfolios: "Portfolios",
  shaders: "Shaders",
  templates: "Templates",
  "ui-design": "UI design",
};

export const experimentPathSchema = z
  .string()
  .regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+){1,3}$/)
  .refine((path) => Object.hasOwn(experimentCategories, path.split("/")[0] ?? ""))
  .refine(
    (path) =>
      !path.split("/").some((part) => /^(?:premium|references?|captures?|scrapes?)$/.test(part)),
  );

const experimentProjectSchema = z
  .object({
    path: experimentPathSchema,
    name: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(180),
    category: z.string().min(1).max(80),
    group: z.string().min(1).max(80),
    summary: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    thumbnail: z
      .string()
      .regex(/^(?:\/assets\/experiment-artwork\/[a-z0-9-]+\/original-visual\.svg)?$/),
    hue: z.number().int().min(0).max(359),
    source: z.string().url(),
    preview: z.string().url(),
  })
  .refine(
    (project) =>
      project.name === project.path.replaceAll("/", "--") &&
      project.group === project.path.split("/")[0] &&
      project.source === `https://github.com/${experimentRepository}/tree/main/${project.path}` &&
      project.preview === `${experimentPreviewOrigin}${project.path}/`,
  );

export type ExperimentProject = z.infer<typeof experimentProjectSchema>;

export const experimentIndexSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    projects: z.array(experimentProjectSchema).min(1),
  })
  .refine(
    ({ projects }) => new Set(projects.map((project) => project.path)).size === projects.length,
  )
  .refine(
    ({ projects }) => new Set(projects.map((project) => project.name)).size === projects.length,
  );

export function experimentSource(path: string): string {
  return `https://github.com/${experimentRepository}/tree/main/${experimentPathSchema.parse(path)}`;
}

export function experimentPreview(path: string): string {
  return `${experimentPreviewOrigin}${experimentPathSchema.parse(path)}/`;
}
