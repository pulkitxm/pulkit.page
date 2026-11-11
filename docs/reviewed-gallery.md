# Project preview gallery

The gallery lists only projects explicitly approved in
[approval.json](../apps/page/data/experiment-gallery/approval.json). The pinned
registry, empty standalone-asset inventory, inline artwork reviews and source
license are verified with SHA-256. New upstream projects are never added
automatically. Changes to the allowlist or source revision require manual review.

Cards show fresh screenshots of the reviewed implementations. Hovering or focusing
a card starts a muted recording when motion and data preferences permit it. Detail
pages provide native playback controls, current preview links and source links.
Search, category filters, pagination and project navigation remain available.

Run `bun run gallery:sync <source-checkout>` after approving an exact source commit
and tree. Run `bun run gallery:record --site <verified-media-free-build> --out <fresh-staging-directory> --workers 4` to produce fresh local recordings. Inputs
must contain no standalone image, font, audio or video files. The recorder accepts
only the local build, blocks service workers and external HTTP and WebSocket
requests, and checks both 1280px and 390px viewports. It records at 1280 by 800 with
30fps output. Scroll timing follows a gentle top-to-bottom-and-back sequence;
short pages retain their visible animation. Posters are extracted from those
fresh recordings. No vendor previews or previous gallery media are capture inputs.

Run `bun run gallery:finalize --site <verified-build> --source <source-checkout> --jobs <private-job-manifest>` after the complete sweep. Promotion checks every
project's built files, reviewed Git subtree, runtime results, media budgets and
notices. It requires every approved project and rejects unknown files. A manually
reviewed history translation may change commit identifiers while preserving the
recorded project trees and build hashes. Record the reviewed source revision and
final source revision separately in that case. Do not regenerate unchanged
recordings merely to change a commit identifier.

Public provenance is `/assets/project-previews/provenance.json`. It records exact
source and build identities, viewport, recipe, capture software, asset hashes and
source-specific notices. The exact worker, producer and finalizer recipes are
included as hashed text records. Software used to capture a recording is not
redistributed with it. Source code and dependencies retain their applicable
licenses; the repository MIT license does not replace those terms. Per-project
`source-notices.txt` files accompany the captures, with line endings normalized to
LF and original notice hashes retained. License and attribution text is preserved, and gallery software notices
remain at `/assets/embeds/experiment-gallery-notices.txt`.

`bun run check:gallery` verifies pinned public snapshots and current clearance.
Revoked projects, changed reviewed artwork or notices, network failures and missing
capture provenance block the check. These safeguards complement manual review;
they do not establish originality or legal compliance.

The versioned browser index remains `reviewed-projects.json`. Legacy gallery
routes, `projects.json`, previous media bundles, commercial captures, prompt
copying, raw source browsing and archive downloads remain withdrawn. The built
artifact guard checks exact routes, capture hashes and withdrawal restrictions.
The blog receives no gallery routes or preview assets.

Publishing uses the approved manual workflow. Verify the primary previews, merge
only after the required checks pass, publish the exact blog artifact and verify
its revision receipt, then dispatch the portfolio publish workflow. Verify the
live gallery, playback and withdrawn direct URLs afterward.
