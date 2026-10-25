# Lighthouse audit

## Scope and method

Audited 669 HTML pages on pulkit.page and pulkit.blog, on mobile and desktop: 667 indexable pages from the production sitemaps plus the two intentional noindex 404 pages. The main production run is `2026-10-25T12-14-43Z-prod`; the optimized build run is `2026-10-25T12-55-46Z-local`. The four production 404 audits were collected separately after the main run.

The optimized build contains source revision `2794463dab381b201ad2fd5eefb199ba98771dda`. The local runner revision 03906cf and the published source revision share the identical tree fa33f26a54d9e84bafac785e6112a0774158c3b0; only commit metadata differs. Live deployment provenance is not inferred from the runner revision. All four Lighthouse categories use Lighthouse 13.5.0 and its standard mobile/desktop simulation, cold browser caches, and five workers. No categories, audits, third-party scripts, or media were blocked to improve scores.

The optimized sites were built for their production CNAMEs with the public production analytics configuration enabled and served through Vite preview, which compresses responses. The live sites include CDN latency, cache policy, and injected Cloudflare scripts that the local previews do not reproduce. Production collection overlapped repository build and validation work; the optimized sweep ran after production collection without a simultaneous build. Scores are single-run lab measurements and are sensitive to resource contention, network conditions, and video playback. Changes in scores are directional evidence, not a controlled causal estimate or a guarantee of deployed scores.

The measurements were completed before independent CI and media-budget updates from main were merged into this PR branch. The recorded source revision identifies the measured snapshot; hosted CI validates the final combined branch. The later upstream asset optimizations are not attributed to this Lighthouse change.

## Results

Retried 482 device audits after the analytics proxy failure recovered. The rerun is `2026-10-25T13-30-01Z-local`. The latest measurement is used, regardless of whether its performance score is higher or lower; initial optimized measurements remain in the dataset for every retried route.

The [interactive report](lighthouse-report.html) can be downloaded and opened locally to filter and sort every page. The [complete per-page dataset](lighthouse-results.json) contains both device results, all four scores, FCP, LCP, TBT, CLS, and Speed Index for every page. Score and metric ordering and units are defined in its metadata.

| Site        | Device  | Indexable pages | Median performance, production / optimized | All four scores 100, production / optimized |
| ----------- | ------- | --------------- | ------------------------------------------ | ------------------------------------------- |
| pulkit.page | mobile  | 612             | 77.0 / 94.0                                | 0 / 16                                      |
| pulkit.page | desktop | 612             | 98.0 / 99.0                                | 91 / 143                                    |
| pulkit.blog | mobile  | 55              | 96 / 99                                    | 6 / 24                                      |
| pulkit.blog | desktop | 55              | 100 / 100                                  | 55 / 55                                     |

The 404 pages intentionally retain noindex. Their SEO deductions are expected; making them indexable for a score would be incorrect. Diagnostic warnings may remain even when a category rounds to 100. Raw Lighthouse HTML, JSON, research details and provenance remain in the generated run directories under `reports/lighthouse/`; they are not committed.

## Environment limitations

During the optimized sweep, the execution proxy returned HTTP 503 for some PostHog requests. The response reported an upstream connection failure through its HTTPS tunnel. Checks using both the production and local Origin headers reproduced the failure. Affected page results retain the Best Practices deductions and are marked `analytics-network-error` in the dataset. No requests or console errors were suppressed to obtain a higher score. These results require rechecking through a healthy network path after deployment.

## Changes

- Keep the initial analytics loader below 1.5 KB before compression, check visitor exclusion before downloading the SDK, and initialize the full client after window load in an idle callback. Existing tracking options remain enabled. Very brief visits may end before initialization; see [analytics](analytics.md).
- Load and play directory videos only after load and when at least half visible, pause them when offscreen, and retain the existing posters and layouts. Avoid attaching the source to offscreen project videos in the initial HTML.
- Put core font preloads before scripts and inline styles, and prioritize the three article images identified as LCP resources in the production audit.
- Use visible reply-card text as the accessible name and explicit row and column scopes for comparison tables, preserving their font weight.

Remaining performance gaps are concentrated on the retained analytics SDK, interactive demos, and external video previews. The audit does not disable these features to obtain a higher score. External video compression and production CDN/cache changes are outside this repository snapshot.

## Validation and reproduction

`bun run ci --env-mode=loose` passed with production analytics enabled. Loose environment mode is required locally to preserve this managed environment's network proxy through Turbo; no repository CI settings were weakened. The normal staged-snapshot pre-commit checks also run before commits.

Chromium checks verified analytics idle loading, exclusion without an SDK request, the idle-callback compatibility fallback, blocked imports without uncaught errors, and offscreen video loading on visibility. Structural bounds matched production for six representative routes at both 412px and 1440px widths after existing animations settled. The PR's GitHub checks provide the hosted CI and complete browser-smoke results.

Run the indexable production sweep with:

```sh
bun run lighthouse:prod --concurrency 5 --min-score 100
```

For local audits, build with the same production analytics configuration, then run `bun tooling/lighthouse/src/commands/lighthouse.ts --concurrency 5 --min-score 100` with the union of production sitemap route paths and `/404/` as positional arguments. The score target is expected to fail on intentional noindex pages and on any remaining performance gaps. The live production scores must be measured again after this PR is merged and deployed.
