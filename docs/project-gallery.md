# Project gallery

The gallery lists the explicit project paths in
[approval.json](../apps/page/data/experiment-gallery/approval.json). Cards provide
screenshots and muted recordings that play when visible. Detail pages offer
automatic previews, a source file browser and project license notices. Motion and
data preferences control automatic playback, with a manual play control available.

`bun run gallery:sync <source-checkout>` updates source metadata for the pinned
commit and tree. Source status, asset inventory, inline graphics, licenses and
notices must match their recorded hashes. New projects require an explicit
allowlist change.

`bun run gallery:record --site <verified-media-free-build> --out <fresh-staging-directory> --workers 4`
records a local build at 1280 by 800 and 30fps. The recorder checks desktop and
mobile layouts, blocks service workers and external network requests, and records
page errors, failed requests and overflow. Inputs contain no standalone media.

`bun run gallery:finalize --site <verified-build> --source <source-checkout> --jobs <private-job-manifest>`
validates each project's source tree, built files, runtime observations, notices
and media budgets before adding the complete capture set.

`bun run gallery:notices --source <current-source-checkout> --revision <commit> --capture-source <capture-source-checkout>`
updates current project notices without changing recordings. It verifies that
runtime source files are byte-identical, replaces exact source notice sections,
and keeps the original capture timestamps, source identities, build records and
notice hashes. A separate publication binding records the current source tree and
published notice hashes. Markdown and notice text are excluded from the runtime
source digest.

Pass `--publication-source <previous-source-checkout>` when the preceding
publication is stored separately from the current and original capture sources.
Each supplied revision and tree must match its recorded identity.

`/assets/project-previews/provenance.json` includes the original capture records,
current publication bindings, implementation hashes and exact capture recipes.
Per-project `source-notices.txt` files preserve upstream license and attribution
text. Line endings use LF. Capture tools are identified with their applicable
licenses and are not included in the recordings.

`bun run check:gallery` verifies the pinned metadata and current source status.
Missing records, changed graphics or notices, and network errors block the check.
The built-output guard enforces the exact gallery route and asset allowlists.
The blog includes no project gallery assets.

Publishing requires the approved manual workflow and successful verification.
Publish the exact blog artifact and confirm its revision receipt before dispatching
the portfolio publish workflow. Check live pages, playback and expected direct-URL
responses after publication.
