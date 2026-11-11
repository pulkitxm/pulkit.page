# Reviewed experiment gallery

The portfolio gallery shows only paths explicitly approved in
[approval.json](../apps/page/data/experiment-gallery/approval.json). Its registry,
asset provenance and repository license snapshots are pinned by revision and
SHA-256. Extra upstream projects are never automatically added. A reviewer must
approve additions and the exact primary source revision before changing this list.

Run `bun run gallery:sync /path/to/source-checkout` after updating the explicit
approval. It reads only pinned metadata and approved original artwork with Git,
checks provenance and hashes, and refuses unknown or locally changed artwork.
Run `bun run check:gallery` to verify the snapshots against the pinned public
source and ensure every approved project remains cleared and every imported artwork retains
its hash and original MIT permission on current source main.
Network failures and revoked projects fail this check. These checks complement
manual rights review and do not establish legal clearance by themselves.

Cards use unchanged original MIT SVG geometry with a local license and provenance
manifest. Projects without approved artwork use original CSS shapes. Cards are
illustrations, rather than captures of the previews. The gallery retains search,
category filters, native pagination and project navigation. Links open only the
current canonical preview and source folder. Public artwork records are at
`/assets/experiment-artwork/provenance.json`; software notices are at
`/assets/embeds/experiment-gallery-notices.txt`.

The versioned search index is `reviewed-projects.json`. Legacy project routes,
The built artifact guard checks approved routes, exact index contents, artwork bytes and current publication permissions before publishing. The blog receives no gallery routes or artwork.

Production publishing remains a manually approved workflow. Validate the current
source previews first, then merge the reviewed portfolio change, publish the exact
blog artifact and verify its revision receipt before dispatching the final portfolio
publish workflow. Verify live approved routes and unpublished direct URLs afterward.
