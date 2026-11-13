import { createHash } from "node:crypto";
import type { z } from "zod";
import type { approvalSchema, manifestSchema } from "./experiment-capture-schema.ts";

type Recording = z.infer<typeof manifestSchema>["recordings"][number];
type Approval = z.infer<typeof approvalSchema>;
type PublicationBinding = Pick<Recording, "project" | "implementation_files" | "publication">;

export function implementationDigest(files: Recording["implementation_files"]): string {
  if (
    new Set(files.map((file) => file.path)).size !== files.length ||
    files.some(
      (file, index) =>
        /\.md$/i.test(file.path) ||
        file.path.split("/").at(-1) === "THIRD_PARTY_NOTICES.txt" ||
        (index > 0 && (files[index - 1]?.path ?? "") >= file.path),
    )
  ) {
    throw new Error("Project implementation files must be unique, ordered runtime source files");
  }
  return createHash("sha256")
    .update(files.map((file) => `${file.path}\0${file.sha256}\n`).join(""))
    .digest("hex");
}

export function verifyCapturePublication(recording: PublicationBinding, approval: Approval): void {
  const publication = recording.publication;
  if (
    publication.source_revision !== approval.revision ||
    publication.source_tree !== approval.tree ||
    publication.implementation_sha256 !== implementationDigest(recording.implementation_files)
  ) {
    throw new Error(
      `Current project publication differs from its source binding: ${recording.project}`,
    );
  }
}
