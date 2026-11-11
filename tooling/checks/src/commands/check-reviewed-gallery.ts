import {
  readExperimentCatalog,
  verifyExperimentCatalogSource,
} from "@pulkit/shared/experiment-catalog";
import { repositoryRoot } from "@pulkit/shared/repository";

await verifyExperimentCatalogSource(repositoryRoot);
console.log(
  `Verified ${readExperimentCatalog(repositoryRoot).projects.length} explicitly approved gallery projects and their fresh capture provenance.`,
);
