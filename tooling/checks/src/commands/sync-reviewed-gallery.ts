import process from "node:process";
import { syncExperimentCatalog } from "@pulkit/shared/experiment-catalog";
import { repositoryRoot } from "@pulkit/shared/repository";

const source = process.argv[2];
if (!source || process.argv.length !== 3) {
  throw new Error("Usage: sync-reviewed-gallery.ts <primary-repository-checkout>");
}
syncExperimentCatalog(source, repositoryRoot);
console.log(
  "Updated only explicitly approved projects from the pinned primary registry and its media-free source reviews.",
);
