# Analytics

[Documentation index](index.md) · [SEO and environments](seo-and-environments.md)

## Off unless you ask for it

Neither site loads an analytics script by default. The PostHog client is opt-in
through the environment: when `POSTHOG_KEY` is set, every rendered page gets one
module script in `<head>` and the build emits `/assets/analytics.js`. When the
variable is absent the placeholder renders as an empty string, no bundle is
produced, and the output is byte for byte what it was before.

Deployed pages are built by the Verify job of the
[CI workflow](../.github/workflows/ci.yml), which reads `POSTHOG_KEY` and
`POSTHOG_IGNORE_KEY` from repository secrets. Remove either secret and the next
deployment drops that part of the behavior with no code change. The project key
is not a credential: it is public by design and visible in the page source of
every site that uses PostHog.

| Variable        | Required | Default                    | Meaning                                                        |
| --------------- | -------- | -------------------------- | -------------------------------------------------------------- |
| `POSTHOG_KEY`   | yes      | none                       | Project key from PostHog, the public `phc_` value              |
| `POSTHOG_HOST`  | no       | `https://us.i.posthog.com` | Ingestion origin, `https://eu.i.posthog.com` for the EU region |
| `POSTHOG_DEBUG` | no       | unset                      | `1` prints PostHog's own event log to the browser console      |

Put the values in a `.env` file at the repository root, which Git ignores:

```sh
POSTHOG_KEY=phc_yourprojectkey
POSTHOG_DEBUG=1
```

The [site CLI](../packages/engine/src/cli.ts) passes that file to every command
it runs with Bun's `--env-file`, because `bun run` does not export values from a
`.env` file to the commands a script spawns, and Turbo starts each task in its
own app directory where a repository-root file would not be read. The same file
is a Turbo global dependency, so editing it invalidates cached builds instead of
replaying output rendered under the previous settings. Any variable the sites
read works there, including the `GITHUB_TOKEN` that the projects directive
needs. Passing the variables on the command line works as well:

```sh
POSTHOG_KEY=phc_yourprojectkey bun run dev
```

A malformed key or a host with credentials, a path, or a query fails the render
instead of shipping a broken tag. All three variables are Turbo global
environment inputs, and the resolved script tag is part of the page cache key,
so turning analytics on or off re-renders the pages it affects.

## Excluding your own visits

`POSTHOG_IGNORE_KEY` holds a phrase you choose. A build hashes it with SHA-256
and publishes only that digest on the script tag, so the phrase itself never
appears in the page. Before initializing, the browser reads `IGNORE_KEY` from
local storage, hashes it the same way, and skips PostHog entirely when the two
digests match: no client, no requests, no events. Run this once in the console
of each browser you want excluded:

```js
localStorage.setItem("IGNORE_KEY", "the phrase");
```

Local storage is per origin, so repeat it on pulkit.page and on pulkit.blog.
Clearing site data removes the exclusion and the visit is tracked again. Anyone
who learns the phrase can exclude themselves as well, which costs nothing, but
the digest means reading the page source does not reveal it.

## What the browser runs

[analytics.ts](../packages/theme/src/client/analytics.ts) reads the project key
and ingestion host from the script tag's data attributes, so the bundle itself
holds no configuration and stays cacheable. It captures page views and page
leaves, keeps PostHog's autocapture defaults for clicks and form interaction,
and turns session recording off. The client is exposed as `posthog` on the
global object, which makes `posthog.capture("example")` usable from the browser
console while you are trying it out.

The bundle is the full `posthog-js` client, about 100 KB compressed. That is
acceptable for a local trial and is the main thing to weigh before it ships,
next to two properties of the current hosting: GitHub Pages cannot proxy the
ingestion endpoint, so common blocklists will hide part of the traffic, and
PostHog's default cookie persistence is what pulls a consent banner into scope.
Switching `persistence` to `memory` removes the cookie at the cost of returning
visitor counts.

## Where the pieces live

[bundleAnalyticsScript](../packages/theme/src/analytics.ts) builds the browser
entry with the same helper the embeds and demos use.
[resolveAnalytics](../packages/engine/src/site/analytics.ts) validates the
environment and is the single place that decides whether analytics is on.
[layouts.ts](../packages/engine/src/render/layouts.ts) turns that into the
`{{ analyticsScript }}` placeholder used by
[head.html](../packages/theme/layouts/partials/head.html). In development
[dev-assets.ts](../packages/engine/src/dev/dev-assets.ts) bundles the script on
first request into `.cache/analytics-dev`; a build writes it into
`dist/assets/` next to the embed and demo scripts.
