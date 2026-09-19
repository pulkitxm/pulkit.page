# Development benchmarks

Vite 8.3.0 serves Markdown pages and social cards when requested. Production builds still render every page into `dist/` for static deployment. Bun remains the runtime and package-script launcher.

## Method

Run `python3 scripts/benchmark-dev.py SOURCE --runs 3 --output RESULT.json` against a source checkout with installed dependencies. The runner copies sources into a temporary directory, links individual dependency packages into a private node\_modules directory, and removes only that temporary copy afterward. Vite optimizer caches remain inside the temporary directory. It never edits the supplied checkout. Each iteration clears renderer caches, Vite optimizer caches, and dist, requests a fixed available port, measures server readiness, then measures first homepage, first code-heavy article, and repeated article requests. It restarts without edits to measure warm readiness and first homepage latency, then checks body edits, metadata-driven collection updates, and a shared footer edit. Edits are reverted before timing a production build.

The article is selected by the highest fenced-code-block count. Edit latency runs from file write until an HTTP response contains the changed text, using 10 ms polling. This includes watcher delay and rendering, but excludes browser painting. Readiness ends when the server announces its bound URL; it does not imply every page has been rendered. First-request timings are reported separately to expose deferred work. Cold means renderer and Vite optimizer caches cleared, not an OS disk-cache flush. Runs are sequential on one machine with no concurrent test or build commands.

The JSON output includes every sample, medians, minimum and maximum, runtime version, operating system, article route, and code-fence count. These are local wall-clock measurements, not a statistical performance guarantee. Dependency installation and download time are excluded.

## Results

Measured September 18, 2026 on an Apple M4 Pro, 24 GiB RAM, macOS-27.0-arm64-arm-64bit, Bun 1.4.2, Vite 8.3.0. Baseline commit: `f3c6682`; implementation: `8abe11e`. Both versions used the same installed dependency tree, all 66 pages, and three sequential repetitions. The selected article was `/blogs/system-design/understanding-database-scaling-sharding/`, with 36 fenced code blocks. The baseline renders 627 fences and 66 social cards before announcing readiness.

All table values are milliseconds, shown as median (minimum to maximum).

| Measurement                            | Previous server                    | Vite on demand                     |
| -------------------------------------- | ---------------------------------- | ---------------------------------- |
| Cold server ready                      | 11,519.73 (11,312.15 to 11,725.65) | 137.97 (137.26 to 141.77)          |
| First homepage response                | 1.37 (1.15 to 5.86)                | 94.61 (90.96 to 102.43)            |
| First code-heavy article response      | 0.37 (0.37 to 0.41)                | 357.05 (356.62 to 363.49)          |
| Repeated article response              | 0.33 (0.30 to 0.36)                | 8.44 (7.76 to 12.80)               |
| Warm server ready                      | 132.75 (128.22 to 133.98)          | 135.73 (133.51 to 135.82)          |
| First homepage after warm restart      | 0.99 (0.96 to 1.03)                | 29.44 (28.24 to 38.01)             |
| Body edit to updated article           | 309.13 (303.44 to 309.87)          | 212.86 (194.15 to 219.08)          |
| Metadata edit to updated archive       | 493.45 (483.46 to 493.48)          | 155.62 (154.54 to 158.83)          |
| Shared layout edit to updated homepage | 4,110.67 (4,021.53 to 4,147.02)    | 128.11 (124.96 to 130.13)          |
| Production build                       | 11,697.62 (11,617.50 to 11,805.91) | 11,675.16 (11,637.40 to 12,172.59) |

Startup plus first homepage response improved from 11,521.10 ms to 231.87 ms, approximately 49.7 times faster. Shared-layout edit latency improved by approximately 32.1 times. Body edits improved by 1.45 times; metadata edits improved by 3.17 times.

The first article now pays its render cost when requested: about 357 ms versus an already-built static response under 1 ms. Cached responses also add Vite HTML transformation and middleware overhead, approximately 8 ms for the repeated article. Warm readiness is essentially unchanged; the first homepage after a warm restart adds about 29 ms instead of 1 ms. Production builds remain approximately 11.7 seconds, with no demonstrated improvement. These tradeoffs are explicit: the benefit is avoiding unrelated rendering during startup and edits.

See [all raw samples](development-benchmarks.json). The benchmark measures HTTP responses, not browser paint or end-to-end interaction latency. Separately, a browser run using synthetic content verified automatic Markdown reload and CSS hot replacement. The implementation passed all 15 repository CI checks and 100 tests before measurement.

## Tool choice

Vite supplies the maintained development server, file watching, HTML transforms, browser reload client, and CSS hot replacement. A small middleware adapter connects the existing Markdown renderer, preserving its layouts, formatting, highlighting, route validation, and SEO behavior. Migrating the content system to another framework was unnecessary for this change. See the [Vite plugin API](https://vite.dev/guide/api-plugin.html).

Production generation stays complete because GitHub Pages serves static output and cannot render an unbuilt URL. Vite does not replace formatting, linting, or repository checks. `bun run` remains the package-script launcher; `bun dev` and `bun run dev` invoke the same Vite-backed script.

## Reproduction

Create a separate baseline directory from commit `f3c6682`, install its dependencies or link the same dependency tree, then run these commands sequentially from the updated checkout:

```sh
python3 scripts/benchmark-dev.py /path/to/baseline --runs 3 --output /tmp/before.json
python3 scripts/benchmark-dev.py . --runs 3 --output /tmp/after.json
```

Use the same machine and power settings, close competing workloads, and compare medians alongside the full samples. The runner's temporary copies isolate its content and template edits from both source checkouts. It stops its own server processes and restores fixture edits even when a request fails.
