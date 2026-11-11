# Deployment

[Documentation index](index.md) · [Continuous integration](continuous-integration.md)

Both sites are served by GitHub Pages. A repository can publish only one Pages
site, so each site uses its own repository while all code stays here:

| Site        | Built from                 | Served by                                                       | Pages source          |
| ----------- | -------------------------- | --------------------------------------------------------------- | --------------------- |
| pulkit.page | [apps/page](../apps/page/) | this repository                                                 | GitHub Actions        |
| pulkit.blog | [apps/blog](../apps/blog/) | [pulkitxm/pulkit.blog](https://github.com/pulkitxm/pulkit.blog) | the `gh-pages` branch |

The pulkit.blog repository is only a publishing target. Never edit it by hand;
every deployment replaces its `gh-pages` branch contents.

## What runs when

The [CI workflow](../.github/workflows/ci.yml) builds and checks both apps on
every pull request and push to main. A newer pull request or branch run cancels
the older run for that ref. Main runs are isolated by workflow and revision and
are allowed to finish.

The two deploy jobs run after the `CI` gate only when an owner approves publishing
and manually dispatches CI on `main` with `publish=true`. The input defaults to
false. Pushes, pull requests and scheduled guestbook updates do not deploy.
Configure required owner approval on both deployment environments as an additional
gate. Each job downloads its checked build artifact, serializes per site and
skips publishing if the approved source revision is no longer current.

- **Deploy pulkit.page** uploads the checked Pages artifact and deploys it in the
  `github-pages` environment. It is the only job with `pages: write` and
  `id-token: write`.
- **Deploy pulkit.blog** checks the artifact against the approved route and asset policy, then
  runs [publish-blog.sh](../tooling/checks/publish-blog.sh). The script requires
  the approved manual dispatch, a full verified source SHA, the production domain
  and expected output files, and target repository access. It stages the entire
  new build, including deletions, in an isolated temporary checkout based on the
  existing `gh-pages` head. It rejects a changed target head, runs a Pukbot dry run,
  and publishes the new commit through `pukbot commit create`. An unchanged build
  makes no commit. The source workflow verifies the installed Pukbot binary's hash.

Blog publishing uses default Pukbot mode with the environment's `BLOG_PUBLISH_TOKEN`
as its GitHub session credential. This supports generated files larger than the
60,000-byte per-file limit of app-authored mode. The target contains generated
site files and no workflow changes, so Contents read/write access to the blog
repository is sufficient; Workflows permission is not requested. The source
repository's automatic workflow token and the old SSH deploy key are not used to
write the separate target. Missing credentials, failed authorization, failed dry
runs and target races stop publishing with an error. There is no direct Git
commit or push fallback.

Production builds copy each app's `CNAME` into `dist/`, which keeps both custom
domains attached to their Pages sites. A preview build for another origin leaves
it out, so a preview cannot claim a production domain. Both builds write the shared
not-found page to `dist/404.html`, which is the file GitHub Pages serves, with
status 404, for any path it cannot match. Old pulkit.page `/blogs/` URLs are not
redirected; they reach that page.

## One-time setup for pulkit.blog

1. After owner approval, create a fine-grained GitHub token restricted to
   `pulkitxm/pulkit.blog`, with **Contents: Read and write**. Set an appropriate
   expiry. Its owner must have write access to that repository.
2. Add the token as the `BLOG_PUBLISH_TOKEN` secret in the `pulkit-blog` deployment
   environment of `pulkitxm/pulkit.page`. Configure that environment's required
   owner reviewers. The missing secret intentionally blocks blog publication.
3. Retire the old `BLOG_DEPLOY_KEY` secret and corresponding target deploy key
   after the new path has been approved and verified. No keys or secrets are
   created, replaced or revoked by this source change.
4. Keep the existing target `gh-pages` branch. The publisher fails if it cannot
   fetch that branch instead of replacing its history or creating a new root.
5. After review and approved merge, manually dispatch CI on `main` with
   `publish=true`. Both sites must pass all checks before their separate deploy
   jobs run. Recheck the deployed pages and direct URLs after cache expiry.
6. In `pulkitxm/pulkit.blog`, keep **Settings, Pages** set to **Deploy from a
   branch**, branch `gh-pages`, folder `/ (root)`, with custom domain `pulkit.blog`
   and **Enforce HTTPS** enabled.

The site is publicly served independently of repository visibility. A successful
source check does not establish that the deployed blog has changed.

## Domains

pulkit.page keeps its current Pages configuration in this repository. For
pulkit.blog, create these records at the registrar:

| Type    | Name  | Value                                                                                      |
| ------- | ----- | ------------------------------------------------------------------------------------------ |
| `A`     | `@`   | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`                 |
| `AAAA`  | `@`   | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| `CNAME` | `www` | `pulkitxm.github.io`                                                                       |

To stop anyone else from claiming the domain on GitHub Pages, verify it under
your account's **Settings, Pages, Add a domain** and add the `TXT` record that
page shows.

## Changing a domain

Each app's `CNAME` file is the single source of its production hostname. The
engine reads it for canonical URLs, social metadata, the sitemap and the feed,
and production builds publish it for Pages. Change the file, update DNS, and
update the custom domain in that site's Pages settings.
