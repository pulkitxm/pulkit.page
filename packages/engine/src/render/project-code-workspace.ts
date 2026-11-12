import { escapeHtml } from "@pulkit/shared/html";
import { projectSourceUrl } from "@pulkit/shared/project-source";
import type { DirectoryProject } from "../types.ts";

export function renderProjectCodeWorkspace(
  project: Pick<DirectoryProject, "name" | "path">,
  revision: string,
): string {
  if (!/^[a-f0-9]{40}$/.test(revision) || project.name !== project.path.replaceAll("/", "--")) {
    throw new Error("Invalid project source workspace binding");
  }
  return `<div class="grid min-w-0 gap-4 min-[64rem]:h-full min-[64rem]:min-h-0 min-[64rem]:grid-cols-[260px_minmax(0,1fr)] min-[64rem]:grid-rows-1" data-code-workspace data-source-url="${escapeHtml(projectSourceUrl(project.path))}" data-source-revision="${escapeHtml(revision)}" data-source-project="${escapeHtml(project.path)}"><nav class="max-h-64 overflow-y-auto rounded-[12px] border border-fg/10 bg-bg/80 p-2 min-[64rem]:h-full min-[64rem]:max-h-none min-[64rem]:min-h-0" aria-label="Project files" data-project-files></nav><div class="flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-fg/10 bg-bg/80 min-[64rem]:h-full min-[64rem]:min-h-0" data-project-code><p class="m-0 p-4 text-md text-muted" role="status">Select Code to load the project files.</p></div></div>`;
}
