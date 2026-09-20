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
every pull request and push. A newer push to the same pull request or branch,
including `main`, cancels the older CI run, so only the latest commit is checked.

The two deploy jobs are part of the same workflow, so they appear in the same
run graph after the `CI` gate. They run only on a push to `main` or a manual run
on `main`, after every required job has passed, and they download the run's
`built-sites` artifact instead of building again. A newer push cancels an older
run even while it deploys; both deploys are all or nothing, so the previous site
stays live and the newer run deploys the newer commit.

- **Deploy pulkit.page** uploads `apps/page/dist` as this repository's Pages
  artifact and deploys it in the `github-pages` environment. It is the only job
  that gets `pages: write` and `id-token: write`.
- **Deploy pulkit.blog** takes the same build, adds `.nojekyll`, and pushes
  `apps/blog/dist` as one new commit on top of the `gh-pages` branch of
  pulkitxm/pulkit.blog, in the `pulkit-blog` environment. It initializes a
  repository inside the downloaded `dist`, shallow-fetches the existing
  `gh-pages` and resets onto it so the branch keeps its history, stages
  everything, and stops without a commit when nothing changed. It authenticates
  with a deploy key written to the runner's temporary directory and pins
  GitHub's published SSH host key with strict host key checking. Without the
  `BLOG_DEPLOY_KEY` secret the job succeeds with a warning and publishes
  nothing.

Production builds copy each app's `CNAME` into `dist/`, which keeps both custom
domains attached to their Pages sites. A preview build for another origin leaves
it out, so a preview cannot claim a production domain. Both builds write the shared
not-found page to `dist/404.html`, which is the file GitHub Pages serves, with
status 404, for any path it cannot match. Old pulkit.page `/blogs/` URLs are not
redirected; they reach that page.

## One-time setup for pulkit.blog

1. Create a deploy key pair locally. Keep the private half out of the
   repository and delete it after step 3.

   ```sh
   ssh-keygen -t ed25519 -C "pulkit.blog publish" -N "" -f pulkit-blog-deploy
   ```

2. In **pulkitxm/pulkit.blog**, open **Settings, Deploy keys, Add deploy key**.
   Paste the contents of `pulkit-blog-deploy.pub` and tick **Allow write
   access**. The key can push to that one repository and nothing else.

3. In **pulkitxm/pulkit.page**, open **Settings, Secrets and variables,
   Actions** and add a repository secret named `BLOG_DEPLOY_KEY` containing the
   whole private key file `pulkit-blog-deploy`.

4. Merge to `main` or run the CI workflow on `main` so the first publish creates
   the `gh-pages` branch.

5. In **pulkitxm/pulkit.blog**, open **Settings, Pages**. Set **Source** to
   **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`. Set the
   custom domain to `pulkit.blog` and enable **Enforce HTTPS** once the
   certificate is issued.

Both repositories are private, which GitHub Pages supports on paid plans. The
published site is public either way.

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
