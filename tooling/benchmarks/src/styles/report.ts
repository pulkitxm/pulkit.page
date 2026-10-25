import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { escapeHtml } from "@pulkit/shared/html";
import { root, variants } from "./config.ts";
import { metricLabels, reportData } from "./report-data.ts";

export function renderReport(output: string, filename = "measurements.json"): void {
  const data = reportData(output, filename);
  const python =
    process.env.STYLE_BENCH_PYTHON ?? join(root, ".cache/style-benchmark-plotting/bin/python3");
  if (!existsSync(python)) {
    throw new Error("Set STYLE_BENCH_PYTHON to a Python interpreter with matplotlib installed");
  }
  execFileSync(python, [join(root, "tooling/benchmarks/render-style-charts.py"), output], {
    stdio: "inherit",
  });
  const e = escapeHtml;
  const number = (value: number, digits = 1) =>
    value.toLocaleString("en-US", { maximumFractionDigits: digits });
  const stat = (
    value: { n: number; median: number; p25: number; p75: number } | null | undefined,
  ) =>
    value
      ? `${number(value.median, 3)}<small>${number(value.p25, 3)} to ${number(value.p75, 3)}; n=${value.n}</small>`
      : '<span class="muted">not available</span>';
  const figure = (file: string, caption: string) =>
    `<figure><img src="data:image/png;base64,${readFileSync(join(output, file)).toString("base64")}" alt="${e(caption)}" /><figcaption>${e(caption)}</figcaption></figure>`;
  const payloadRows = data.artifacts
    .map(
      (item) =>
        `<tr><th>${e(item.label)}</th><td>${number(item.htmlGzip)}</td><td>${item.id === "external" ? number(item.cssGzip) : "included"}</td><td>${number(item.coldHtmlCssGzip)}</td><td>${number(item.htmlBrotli)}</td><td>${item.cssRules}</td><td>${item.classTokens}</td></tr>`,
    )
    .join("");
  const buildRows = data.builds
    .map(
      (item) =>
        `<tr><th>${e(variants.find((variant) => variant.id === item.variant)?.label)}</th><td>${stat(item.pipeline)}</td><td>${stat(item.process)}</td></tr>`,
    )
    .join("");
  const environments = data.metadata.environment
    .map(
      ({ engine, profile }) =>
        `<tr><th>${e(`${engine}:${profile.id}`)}</th><td>${profile.width} x ${profile.height}</td><td>${profile.dpr}</td><td>${profile.cpu}x</td><td>${profile.latency} ms</td><td>${profile.download || "unlimited"} / ${profile.upload || "unlimited"}</td></tr>`,
    )
    .join("");
  const selectedMetrics = [
    "ttfbMs",
    "fcpMs",
    "lcpMs",
    "domContentLoadedMs",
    "loadMs",
    "styleMs",
    "layoutMs",
    "scriptMs",
    "observedBlockingMs",
    "cls",
    "serverBodyBytes",
    "jsHeapMiB",
  ];
  const warmMetrics = ["themePaintMs", "clickEventMs", "styleFlushMs"];
  const profileTables = data.metadata.environment
    .map(({ engine, profile }) => {
      const key = `${engine}:${profile.id}`;
      const tables = ["cold", "warm"]
        .map(
          (cache) =>
            `<h3>${cache === "cold" ? "Cold HTTP cache" : "Warm return visit"}</h3><div class="scroll"><table><thead><tr><th>Strategy</th>${selectedMetrics.map((metric) => `<th>${e(metricLabels[metric])}</th>`).join("")}</tr></thead><tbody>${data.groups
              .filter((group) => group.profile === key && group.cache === cache)
              .map(
                (group) =>
                  `<tr><th>${e(variants.find((variant) => variant.id === group.variant)?.label)}</th>${selectedMetrics.map((metric) => `<td>${stat(group.metrics[metric])}</td>`).join("")}</tr>`,
              )
              .join("")}</tbody></table></div>`,
        )
        .join("");
      const interactions = `<h3>Interaction and style-change workload</h3><div class="scroll"><table><thead><tr><th>Strategy</th>${warmMetrics.map((metric) => `<th>${e(metricLabels[metric])}</th>`).join("")}</tr></thead><tbody>${data.groups
        .filter((group) => group.profile === key && group.cache === "warm")
        .map(
          (group) =>
            `<tr><th>${e(variants.find((variant) => variant.id === group.variant)?.label)}</th>${warmMetrics.map((metric) => `<td>${stat(group.metrics[metric])}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody></table></div>`;
      return `<details${profile.id === "severe" ? " open" : ""}><summary>${e(key)}: ${e(profile.label)}</summary>${tables}${interactions}</details>`;
    })
    .join("");
  const difference = (variant: string, reference: string) => {
    const interval = data.comparisons.find(
      (row) =>
        row.profile === "chromium:severe" &&
        row.cache === "cold" &&
        row.variant === variant &&
        row.reference === reference &&
        row.metric === "lcpMs",
    )?.interval;
    if (!interval) {
      return "insufficient paired samples";
    }
    let resolved = "difference unresolved";
    if (interval.upper < 0) {
      resolved = "faster in this sample";
    } else if (interval.lower > 0) {
      resolved = "slower in this sample";
    }
    return `${number(interval.median)} ms<small>95% interval: ${number(interval.lower)} to ${number(interval.upper)} ms; ${resolved}</small>`;
  };
  const comparisons = data.artifacts
    .map(
      (item) =>
        `<tr><th>${e(item.label)}</th><td>${difference(item.id, "utilities")}</td><td>${difference(item.id, "composed")}</td></tr>`,
    )
    .join("");
  const baseline = data.artifacts.find((item) => item.id === "utilities");
  const pruned = data.artifacts.find((item) => item.id === "pruned");
  const direct = data.artifacts.find((item) => item.id === "direct");
  const savings = (bytes: number) =>
    baseline ? `${number((1 - bytes / baseline.coldHtmlCssGzip) * 100)}%` : "unknown";
  const parityStatus = data.parity.failures === 0 ? "Passed" : "FAILED";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Home-page CSS performance comparison</title>
<style>
:root { color-scheme: light; font-family: system-ui, sans-serif; color: #263239; background: #f5f4ef; }
body { max-width: 1380px; margin: auto; padding: 32px; line-height: 1.6; }
h1 { font-size: clamp(30px, 4vw, 48px); line-height: 1.1; margin: 12px 0 24px; }
h2 { margin-top: 48px; padding-top: 20px; border-top: 1px solid #ccd3ce; }
h3 { margin-top: 24px; } p, li { max-width: 100ch; }
a { color: #246e55; } .muted, small { color: #59666b; } small { display: block; font-size: 11px; font-weight: 400; }
.intro { font-size: 19px; } .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
.card { background: white; border: 1px solid #dce2dc; padding: 20px; border-radius: 12px; } .card strong { font-size: 27px; display: block; }
figure { margin: 24px 0; background: white; padding: 12px; border: 1px solid #dce2dc; border-radius: 8px; } img { width: 100%; height: auto; display: block; }
figcaption { color: #59666b; margin: 8px 12px; font-size: 13px; } table { width: 100%; border-collapse: collapse; background: white; font-variant-numeric: tabular-nums; }
th, td { padding: 10px 14px; border-bottom: 1px solid #dce2dc; text-align: left; vertical-align: top; } thead th { background: #e9eee9; font-size: 12px; }
tbody th { font-weight: 550; } td { white-space: nowrap; } .scroll { overflow-x: auto; } details { margin: 18px 0; border: 1px solid #ccd3ce; padding: 16px; border-radius: 8px; }
summary { cursor: pointer; font-weight: 650; } code { background: #e9eee9; padding: 2px 5px; border-radius: 4px; } pre { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 600px) { body { padding: 16px; } th, td { padding: 8px; } }
</style></head><body>
<p class="muted">LOCAL PERFORMANCE STUDY · ${e(data.metadata.startedAt)}</p><h1>Home-page CSS strategies</h1>
<p class="intro">Six builds of the same home page, tested with identical content and assets in isolated Chromium and Firefox contexts. This experiment changes the local fixtures only.</p>
<div class="cards"><div class="card"><strong>${data.parity.checks}</strong>Rendering and interaction checks: ${parityStatus}</div><div class="card"><strong>${pruned ? savings(pruned.coldHtmlCssGzip) : "unknown"}</strong>HTML + CSS gzip reduction from pruning alone</div><div class="card"><strong>${direct ? savings(direct.coldHtmlCssGzip) : "unknown"}</strong>HTML + CSS gzip reduction with direct rules</div><div class="card"><strong>${data.metadata.runs}</strong>Measured repetitions per strategy and environment</div></div>
<h2>What the comparison isolates</h2><ul>${data.artifacts.map((item) => `<li><strong>${e(item.label)}:</strong> ${e(item.detail)}</li>`).join("")}</ul>
<p>The original and pruned utility versions are controls. They show how much benefit comes from removing unused CSS before attributing any improvement to removing utility names or composing declarations.</p>
<p>Tailwind stays in the source and runs during compilation. Every variant serves ordinary CSS, with no Tailwind JavaScript runtime. Direct rules use Tailwind's own compiler to expand each home-page class combination into a generated selector. Responsive rules, pseudo-classes and dark-mode selectors still require CSS; moving everything into style attributes would lose that behavior.</p>
${figure("payload.png", "Deterministic output sizes and selector rule counts. External CSS bytes are added to the HTML for the cold-payload comparison.")}
<div class="scroll"><table><thead><tr><th>Strategy</th><th>HTML gzip bytes</th><th>External CSS gzip bytes</th><th>Cold HTML + CSS gzip bytes</th><th>HTML Brotli bytes</th><th>CSS rules</th><th>Class tokens</th></tr></thead><tbody>${payloadRows}</tbody></table></div>
<h2>Build cost</h2><p>Build samples use fresh Bun processes and a warm filesystem. Pipeline time covers CSS compilation, transformation, home-script bundling and output. Content discovery, Markdown rendering, image optimization and the other site routes are excluded. The second column includes process startup and benchmark-only size analysis.</p>
${figure("build.png", "Build medians with p25 to p75 error bars. These are home styling builds, not full-site deployment times.")}
<div class="scroll"><table><thead><tr><th>Strategy</th><th>Pipeline ms</th><th>Complete process ms</th></tr></thead><tbody>${buildRows}</tbody></table></div>
<h2>Environments and navigation</h2><p>CPU multipliers are relative to this host and throttle Chromium's main thread. They do not reproduce a specific phone, RAM limit, GPU, thermal state or old browser. Firefox runs use its real engine without CPU or bandwidth emulation.</p>
<div class="scroll"><table><thead><tr><th>Environment</th><th>CSS viewport</th><th>DPR</th><th>CPU slowdown</th><th>Added response delay</th><th>Down / up Mbps</th></tr></thead><tbody>${environments}</tbody></table></div>
${figure("lcp.png", "Cold-cache LCP medians with p25 to p75 error bars. Scales differ between environments; compare strategies within each panel.")}
<h3>Severely constrained Chromium: paired cold-LCP differences</h3><p>Candidate minus reference, paired by run round. Negative values mean faster. Intervals are deterministic 2,000-resample percentile bootstrap intervals of the median paired difference. An interval crossing zero does not resolve a winner.</p>
<div class="scroll"><table><thead><tr><th>Candidate</th><th>Compared with original utilities</th><th>Compared with current composition</th></tr></thead><tbody>${comparisons}</tbody></table></div>
<p>Decision guide: pruning is the simplest payload improvement. Direct inline rules are the candidate for removing utility names and reducing the current composition's selector expansion. Check the measured paint intervals and build cost before choosing it for production. External CSS trades an additional cold request for independent caching; this same-page experiment cannot establish its cross-route caching benefit.</p>
<h2>Responsiveness and style work</h2>
${figure("interaction.png", "One real theme-button click after the warm visit. The proxy ends two animation frames after the theme attribute changes. It is not field INP.")}
${figure("style.png", "A separate stress workload changes the root theme and forces style/layout 40 times. This exaggerates style work and does not represent normal browsing.")}
<h2>Detailed metrics and spread</h2><p>Cells show median, p25 to p75 and sample count. Missing browser APIs remain unavailable rather than being reported as zero. Firefox's cached transfer-size accounting differs from Chromium, so the tables use response-body bytes counted by the fixture server. Additional navigation timestamps, request/cache counts and task counters are available in the raw JSON and CSV.</p>${profileTables}
<h2>Correctness gates</h2><p>${parityStatus}: ${data.parity.checks} checks, ${data.parity.failures} failures. The checks cover desktop/mobile, light/dark, computed styles and geometry, screenshots, theme switching and lazy iframe sizing. Largest mean pixel difference: ${number(data.parity.largestPixelDifference, 6)}. ${data.parity.saturatedRadiusDifferences} computed radius values required saturation normalization: both values exceed one million pixels and produce the same clipped round shape. Auto margins use typed computed values where available. Internal custom-property names and transition-property strings are excluded from comparison because they are renamed.</p>
<h2>Method and practical limits</h2><ul>
<li>The fixture binds only to loopback. All resource files are local; a Content Security Policy blocks external connections and frames. Lazy iframe tests validate its box without loading YouTube.</li>
<li>CPU and bandwidth shaping use the DevTools Protocol. Per-response latency is applied before the local server sends headers, so it appears in measured TTFB. DNS, TLS, HTTP/2, remote CDN behavior, packet loss and real-world server load are outside this model.</li>
<li>Trials run serially with shuffled variant order. Each non-smoke environment has one discarded warm-up per variant. Cold means an empty browser-context HTTP cache, not a cold OS or browser binary.</li>
<li>Warm visits leave the page and return in the same context. HTML uses ETag revalidation; CSS, fonts, images and scripts are immutable fixture resources. A validated HTML response has no body, so external CSS has no automatic transfer advantage on this same-page warm return. Cross-page cache reuse was not tested.</li>
<li>Navigation is observed through at least one second after load, after fonts are ready. LCP is the last observed candidate before interaction; observed blocking sums long-task portions beyond 50 ms after FCP through that cutoff. This is not Lighthouse TBT or a field Core Web Vitals assessment.</li>
<li>The heap metric is a JavaScript heap snapshot, not total renderer RAM. Firefox does not expose Chromium's style/layout/heap counters through this harness.</li>
<li>Different engines may select different responsive images or font subsets. Assets and markup are held constant, and comparisons are made within an engine/environment.</li>
<li>The direct-rule compiler is a home-page prototype. It has not replaced the production pipeline or been validated against every route and demo. Smaller payloads and simpler selectors do not by themselves prove faster rendering.</li>
<li>This is one shared host, with ${data.metadata.runs} samples per cell. Quantized paint timings, host scheduling and browser variability limit conclusions about small differences. The bootstrap intervals are exploratory and are not adjusted for multiple comparisons.</li>
</ul>
<h2>Host and reproducibility</h2><pre>${e(JSON.stringify({ ...data.metadata, environment: undefined }, null, 2))}</pre>
<p>Whole-host CPU busy percentage during measured rounds: ${data.hostActivity ? `median ${number(data.hostActivity.median)}%, range ${number(data.hostActivity.min)}% to ${number(data.hostActivity.max)}%.` : "not recorded in this preflight."} This includes the benchmark and unrelated background work. Browser contexts isolate cache and state; they do not isolate the host scheduler. Per-round host activity and load averages are retained in the raw measurements.</p>
<p><a href="${e(filename)}">Raw measurements and order</a> · <a href="measurements.csv">CSV</a> · <a href="summary.json">Summaries and intervals</a> · <a href="parity.json">Correctness checks</a></p>
<p>API references: <a href="https://playwright.dev/docs/api/class-cdpsession">Playwright CDP sessions</a>, <a href="https://web.dev/articles/lcp">LCP definition</a>, <a href="https://web.dev/articles/inp">INP definition</a>, <a href="https://developer.chrome.com/docs/lighthouse/performance/performance-scoring">Performance measurement variability</a>, <a href="https://tailwindcss.com/docs/functions-and-directives">Tailwind directives</a>.</p>
</body></html>\n`;
  writeFileSync(join(output, "index.html"), html);
}
