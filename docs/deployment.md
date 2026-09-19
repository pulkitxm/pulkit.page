# Deployment

Both sites deploy to Vercel from GitHub Actions. CI builds every app with the
pinned Bun version, runs every check, and only then uploads each app's `dist/`
to its own Vercel project. Vercel never builds anything itself, so production
always serves exactly the output that passed CI.

| App                        | Vercel project | Domain        | Routing file                                      |
| -------------------------- | -------------- | ------------- | ------------------------------------------------- |
| [apps/page](../apps/page/) | `pulkit-page`  | `pulkit.page` | [apps/page/vercel.json](../apps/page/vercel.json) |
| [apps/blog](../apps/blog/) | `pulkit-blog`  | `pulkit.blog` | [apps/blog/vercel.json](../apps/blog/vercel.json) |

## What runs when

- A pull request from this repository deploys each app as a Vercel preview after
  CI passes. The preview URL appears on the pull request through the
  `page-preview` and `blog-preview` GitHub environments and in the job summary.
- A push to `main` (a merged pull request) deploys both apps to production.
- A manual `workflow_dispatch` run of CI also deploys production.

Each build copies the app's `vercel.json` into `dist/`. Both files enable
trailing slashes. `apps/page/vercel.json` also permanently redirects `/blogs`
and `/blogs/*` on pulkit.page to the same path on pulkit.blog, so old article
links keep working.

## One-time setup

1. Create two projects in the Vercel team, without connecting them to Git:

   ```sh
   bunx vercel@59.23.2 login
   bunx vercel@59.23.2 project add pulkit-page
   bunx vercel@59.23.2 project add pulkit-blog
   ```

   In each project's settings, set **Framework Preset** to **Other** and leave
   the build, install and output settings at their defaults. CI uploads
   finished static files.

2. Collect the identifiers. The team ID is under **Team Settings, General**.
   Each project ID is under **Project Settings, General**.

3. Create a Vercel access token under **Account Settings, Tokens**, scoped to
   the team.

4. Add them to the GitHub repository under **Settings, Secrets and variables,
   Actions**:

   | Kind     | Name                     | Value                        |
   | -------- | ------------------------ | ---------------------------- |
   | Secret   | `VERCEL_TOKEN`           | the access token             |
   | Variable | `VERCEL_ORG_ID`          | the team ID                  |
   | Variable | `VERCEL_PROJECT_ID_PAGE` | the `pulkit-page` project ID |
   | Variable | `VERCEL_PROJECT_ID_BLOG` | the `pulkit-blog` project ID |

   Optional: set the `TURBO_TOKEN` secret and `TURBO_TEAM` variable to let CI
   share Vercel's remote Turborepo cache.

5. Run CI once on `main` (merge a pull request or use **Run workflow**) so both
   projects have a production deployment.

## Adding the domains

Add each domain to its own project, then point DNS at Vercel.

1. In the `pulkit-page` project, open **Settings, Domains** and add
   `pulkit.page`. Add `www.pulkit.page` too and choose to redirect it to
   `pulkit.page`.
2. In the `pulkit-blog` project, add `pulkit.blog` and `www.pulkit.blog`,
   redirecting `www` to the apex.
3. At each registrar, create the records Vercel shows on the Domains page. For
   an apex domain that is an `A` record for `@` pointing at the address Vercel
   lists; for `www` it is a `CNAME` pointing at the target Vercel lists. If you
   prefer, switch the domain's nameservers to Vercel instead and it creates the
   records itself.
4. Wait until both domains show **Valid Configuration**. Vercel issues the
   HTTPS certificates automatically.

pulkit.page is currently served by GitHub Pages. Move its DNS only after the
first Vercel production deployment succeeds, then disable Pages under the
repository's **Settings, Pages** so the old deployment stops.

## Production origins

Each app's `CNAME` file still holds its production hostname. The engine reads
it to build canonical URLs, social metadata, the sitemap and the feed. It is no
longer copied into `dist/`. Change the file when a domain changes, and change
the matching domain in Vercel.
