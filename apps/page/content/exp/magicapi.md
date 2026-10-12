---
title: Magic API (Noveum.ai & API.market)
description: Software Engineer at MagicAPI, first on API.market (wallet, vouchers, search) and then
  building Noveum.ai from the ground up, from trace ingestion, evals and billing to two cloud
  migrations, plus Orbit, an open source Linear alternative.
role: Software Engineer
date: 2025-03-25
period: Mar 2025 – present
icon: /assets/exp/api-market.webp
secondaryIcon: /assets/exp/noveum.webp
---

After my sudden departure from the previous company, I was going through a rough patch. One of my most trusted mentors recommended me to API.market, and I couldn't be more grateful. The referral led me to a team I genuinely admire. The work, culture, and people here have been incredibly motivating and fulfilling. I had a lot of ownership of the platform. Things like revenue, databases etc. were shared transparently.

![API.market Website](/assets/content/exp/magicapi/website.webp)

## My Work

I have been working at a lot of tasks, but to mention some of the major changes to which I contributed:

### Code Clean up

After my onboarding my first task was to clean up the code with the best practice. The Co-founder mentioned this:

> **Shashank Aggarwal** - CEO & Founder of API.market
>
> Why is it so important to have good code and why are we focussing so much on code quality? It directly affects our revenue, operations and where we spend our time. I can not express the compounding effects of maintaining a good code base and a terrible experience of maintaining a terrible codebase that affects our mental health and indirectly our revenue.

We had over 240 errors and warnings, after the cleanup there were just 19.

### Responsiveness for the platform over various devices

The mobile UI was not the most important thing we cared about as our customers were business people on desktops, but it had to be fixed. So I fixed and optimised the UI for mobile. Things like duplicate nav menus, I had to see and fix the components.

![Responsiveness Comparison](/assets/content/exp/magicapi/resp-comparison.webp)

### Re-Designing Seller Dashboard for better managing APIs

This re-design was majorly focussed to improve the usability of the seller Dashboard supported by API.market for the sellers to manage and visualize APIs and their revenues. In this work I improved the design of the dashboard using shadcn-ui and improved the responsiveness.

![Seller Dashboard](/assets/content/exp/magicapi/seller-dash.webp)

### Added Wallet system for users to add and store funds

![Wallet System](/assets/content/exp/magicapi/wallet.webp)

This was done by keeping some future things in mind like wallets will be used to store credits provided to users, also we were planning to add. So in the old way of transactions on API.market users had to add their cards and the card marked as default would be used to make a transaction. But after the introduction of this wallet system users can add money via cards or we add credits in their account(to be implemented in future) and use them in any transaction on API.market platform like this:

![Transaction Popup](/assets/content/exp/magicapi/transaction-popup.webp)

### Adding Vouchers for users to redeem Credits in Wallet

During our product launch, we had a plan to give 100 vouchers worth $5 each to all the production people who came to our website. Additionally, when we had a hackathon on our campus, we wanted to provide vouchers for participants. With these requirements in mind, we developed a comprehensive voucher system where users could claim public vouchers and the money would be credited into their wallet, which they could then utilize on the platform.

![Voucher System](/assets/content/exp/magicapi/voucher.webp)

We implemented two distinct types of vouchers to meet different use cases. The first type was a targeted voucher system where we could could claim the voucher by mentioning specific email addresses. This allowed for precise control over voucher distribution for specific events or user groups. The second type was a where people could freely claim it once per account, with a maximum limit of 100 people. This system provided provided flexibility for both controlled distribution and open public access while maintaining security and preventing abuse.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/user-specific-vouchers.webp","/assets/content/exp/magicapi/public-vouchers.webp"]}
:::

### Passwordless login with Google and GitHub

I rewrote the login on API.market to be passwordless. You enter your email, get a 6 digit code that works once and expires in 3 minutes, and you're in for 30 days. After that I added Google and GitHub sign in on top of NextAuth, and linked accounts by email, so signing in with Google after using a code doesn't leave you with two separate accounts.

### New Hero Section Design

I redesigned the hero section of the API.market website to enhance user engagement and provide clearer information hierarchy. The new design featured improved visual flow, better call-to-action placement, and more intuitive navigation elements.

<video src="/assets/content/exp/magicapi/new-hero-section.mp4" title="New Hero Section" autoplay loop muted playsinline controls><track kind="captions"></video>

### Smart Onboarding form

I redesigned the smart onboarding form to enhance user engagement and provide clearer information hierarchy. The new design featured improved visual flow, better call-to-action placement, and more intuitive navigation elements.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/smart-onboarding-form/step-1.webp","/assets/content/exp/magicapi/smart-onboarding-form/step-2.webp","/assets/content/exp/magicapi/smart-onboarding-form/step-3.webp"],"columns":3,"label":"Smart onboarding form"}
:::

### Search and discovery for APIs

A marketplace is only as good as its search. I built the stats behind it: a cron job runs every 6 hours, pulls API call counts per product from Elasticsearch, adds subscribers and revenue, and stores the totals in Postgres. Those numbers feed the ranked lists on the homepage, which is statically regenerated every 10 minutes.

I also extended search itself with pricing and rating filters and new sort modes written as Painless scripts in Elasticsearch, and moved the homepage sections onto search results cached in Redis for an hour. One small thing I liked: I wrapped the Prisma client in a Proxy so every database call retries on transient failures with jittered backoff, without changing a single call site.

### Tools for developers using the APIs

For people integrating an API, I built per-plan OpenAPI YAML downloads, code snippets in 8 languages, latency and usage dashboards, and a pipeline that uses Gemini to write seller documentation and streams it back over SSE. Later I came back to fix the API playground for very large specs, adding pagination so a spec with 964 endpoints stays usable.

### Converting full time!!

At the end of June, Shashank asked if I wanted to continue full-time. I was confident in my ability to work at that capacity, so I immediately said yes. I had recently received a full-time offer and unexpectedly exited that role. The internship had begun around the same time but offered slightly less pay than the full-time position. However, it was a clear decision for me, as I received a decent raise.

### Moving to Noveum.ai

Around the same time I got full-time, the company was moving to it's next venture on [Noveum.ai](https://noveum.ai). Noveum is a platform to evaluate AI agents and auto-fix them. It was very exciting for me to work on a company from the very ideation phase to build it from ground up. In the starting I was the only person working on the infra/tech side. I managed the complete kubernetes clusters and the architecture for building a system that was gonna handle millions of requests/day!
![Noveum Dash](/assets/content/exp/magicapi/noveum.ai/original-dash.webp)

We didn't build everything in the next.js app from ground app, instead we had purchased a [template](https://supastarter.dev), so it had everything like auth, multi-org login and onboarding flow setup. Some of the major parts of my work at noveum were:

#### Traces UI

I worked on the traces UI to make agent executions easy to inspect. Traces are basically an end-to-end timeline of an agent run (steps, inputs/outputs, errors and latency). So the traces ui included a main trace view, flow visualization, expanded flow graphs, and filters like date ranges so debugging production runs was actually practical.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/traces/main-view.webp","/assets/content/exp/magicapi/noveum.ai/traces/with-span.webp","/assets/content/exp/magicapi/noveum.ai/traces/flow-chart.webp","/assets/content/exp/magicapi/noveum.ai/traces/date-selector.webp"],"columns":2,"label":"Traces UI"}
:::

#### Datasets UI

Datasets are curated collections of examples extracted from traces (inputs, outputs, and selected spans). They’re used to run specific scorers at evaluation time, so you can measure quality, compare changes, and catch regressions in agents/prompts/models.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/datasets/datasets.webp","/assets/content/exp/magicapi/noveum.ai/datasets/example-dataset-items.webp","/assets/content/exp/magicapi/noveum.ai/datasets/chat-ui.webp","/assets/content/exp/magicapi/noveum.ai/datasets/scorer-ui.webp","/assets/content/exp/magicapi/noveum.ai/datasets/json-view.webp"],"columns":2,"label":"Datasets UI"}
:::

#### Public API and trace ingestion

Our SDK, [noveum-trace](https://github.com/Noveum/noveum-trace), sends every agent run to the platform, so ingestion is the hot path. I built the public API it talks to: API keys, a v1 API with bearer auth and rate limiting, a health check that tests Postgres, ClickHouse and Redis together, and the Docker and Kubernetes setup behind api.noveum.ai. Later I moved every backend route into one typed Hono API.

Ingestion itself never does the heavy work inside the request. The handler validates the payload, puts it on a Redis backed BullMQ queue and returns job IDs right away. Big batches get split into chunks of 100 traces, staggered and prioritized, with a cap of 10,000 traces per request. That one trace worker slowly grew into a whole `apps/workers` service with workers for ETL, evals, NovaPilot reports, scheduled reports, voice tests, analytics rollups and AWS Marketplace events. I wrote the Deployment, autoscaling and disruption budget manifests for each of them.

Queues also taught me that the worst bugs don't throw errors. A few I chased down: KEDA's Redis trigger ignored BullMQ's priority set, so a growing backlog never scaled anything up; a `:` inside repeatable job IDs let a startup cleanup delete our billing and sampling crons; and stable job IDs combined with `removeOnComplete` silently swallowed manual refreshes as duplicates.

#### Completing Six Months

On October 1st 2025, I completed six months at MagicAPI. It had been a remarkable journey, starting with API.Market and evolving into building Noveum AI from the ground up. Beyond just shipping features, I grew a lot as an engineer here. The team's culture of sharing what works, iterating fast, and pushing each other on AI-assisted workflows shaped how I approach building software today.

I shared my reflections on [LinkedIn](https://www.linkedin.com/posts/pulkitxm_as-i-reflect-on-completing-6-months-with-activity-7379207712821325824-xuhn) as well.

#### ETL Job with Agent

The ETL (Extract, Transform, Load) pipeline converted traces into datasets via an asynchronous background workflow. I built the end-to-end job orchestration using BullMQ workers, deployed it to a Kubernetes cluster, and operated the Redis infrastructure it depended on.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/etl-job/etl-jobs.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/mapper-agent.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/trace-picker.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/complete-trace-view.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/create-job.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/mapper-code.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/etl-job-runs.webp"],"columns":2,"label":"ETL job"}
:::

Later I added a realtime mode, where the trace worker hands new traces straight to the ETL job, batched every 500ms or 100 traces, so datasets fill up while the agent is still running. Failed jobs show exactly which traces failed and why:

![ETL job run details](/assets/content/exp/magicapi/noveum.ai/etl-job/job-details.webp)

#### Eval Jobs and NovaPilot

ETL turns traces into datasets, Eval Jobs score those datasets, and NovaPilot turns scores into fixes. I built that whole loop. Eval Jobs score dataset items in batches or in realtime, with queue priorities and cancellation that takes effect in the middle of a run. NovaPilot reads the scored items from ClickHouse, runs the [NovaEval](https://noveum.ai/novaeval) analysis and stores a report with what's failing and the exact prompt change to fix it. Reports can also run on a schedule, with timezone aware cron and a Redis lock so two pods never run the same one.

I also built custom LLM-as-judge scorers, with an agent that drafts the rubric for you, and on the NovaEval side an AWS Bedrock provider and the CLI for that scorer agent.

![Quality breakdown across datasets](/assets/content/exp/magicapi/noveum.ai/evals/quality-breakdown.webp)

#### Making ClickHouse fast and correct

A lot of the ClickHouse layer ended up being mine. I designed the scorer results and NovaPilot tables, built server side filtering and search for traces, and moved the dashboards off live ClickHouse queries onto snapshots in Postgres that a rollup worker keeps fresh.

Some of my favourite debugging stories are from here. The rollup was quietly dead for a week, and it turned out to be three separate problems at once. I cut peak query memory for our heaviest workload from 4 GiB to 1.75 GiB. I found that 21% of span rows were duplicates because the version column wasn't deterministic. And I replaced a search that ran one scan per token, and timed out after 13 to 23 seconds, with a single subquery. Schema changes also moved out of app pods into a migration runner that every deploy has to pass first.

#### Credits wallet and AWS Marketplace

Usage used to be tracked with a best effort counter in Redis. I replaced it with a ledgered credit wallet in Postgres. Every paid feature (evals, NovaPilot, voice tests, mappers) reserves credits before it starts and settles after it finishes, so parallel jobs can't overspend and retries can't charge twice. It's wired into Stripe credit packs, refunds and disputes, admin grants, and a migration that carried every org's existing balance over.

At the same time I added AWS Marketplace as a second way to pay: subscription fulfillment, claiming an org safely when two requests race, an hourly entitlement sync, an SQS worker for marketplace events, a guard so an org is never billed by Stripe and AWS at once, and an admin console to see it all. Both were built as stacks of reviewed PRs. The wallet alone came with 146 tests.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/billing/credit-balance.webp","/assets/content/exp/magicapi/noveum.ai/billing/aws-marketplace-billing.webp","/assets/content/exp/magicapi/noveum.ai/billing/aws-marketplace-admin.webp"],"columns":2,"label":"Credits and AWS Marketplace billing"}
:::

#### Bring your own LLM keys

Customers can store their own LLM provider credentials, encrypted per organization, with a live connection check against each provider. I later turned this into bring your own keys for evals and NovaPilot across OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI and any OpenAI compatible endpoint. Decrypted keys only ever live in the environment of the subprocess that needs them.

Around the same time I reworked roles and permissions across the API, seed data and UI (6 roles across 16 services), and taught the auth middleware to tell "you're logged out" apart from "the auth service is down", so deploys stopped kicking people out.

![Adding an LLM provider](/assets/content/exp/magicapi/noveum.ai/providers/add-provider.webp)

#### NovaSynth: testing voice agents

NovaSynth tests voice agents by having synthetic personas actually call them. I built the platform side: personas, scenarios, agent endpoints and runs, with a batch run that expands every persona and scenario pair into queued calls. Later I added inbound calls, where the customer's bot dials numbers we lease to it, with row locking so two tests never grab the same number.

Engineers used to make batch reports by hand with a CLI, so I automated them. The first version drew PDFs by hand with jsPDF, about 1.7K lines of it. I replaced that with a small standalone service that renders the report as HTML in headless Chromium, with its own auth, a bounded queue and its own deployment.

#### MCP server

I launched an MCP server for Noveum that reads the platform's OpenAPI spec at runtime and turns every operation into a tool an AI assistant can call. To get there I annotated more than 220 API routes. Then I hardened it: secret endpoints are filtered out, tools carry annotations, and anything that deletes data needs confirmation. So you can sit in Cursor and ask how many traces you have, or set up an eval job, in plain English.

#### Our own blog CMS

We were paying for Strapi just to run the blog, so I built blogging into the main app instead. It has editor and reviewer roles where approval is tied to the exact revision that was submitted, immutable revisions, preview links, redirects when a slug changes, private media on S3, and 22 MCP tools so AI agents can write and publish posts too. I migrated every post and image from Strapi with a migration that's safe to rerun, and built a Tiptap editor that round trips Markdown without losing anything, by keeping the original source for blocks you didn't touch.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/blog-cms/editor.webp","/assets/content/exp/magicapi/noveum.ai/blog-cms/live-preview.webp"],"label":"Blog editor"}
:::

#### Design system, German and faster pages

I unified Noveum's design system and the server rendered app shell in one big change (802 files) that also moved us to Next.js 16, and redrew the sidebar icons so every product area has its own metaphor. I translated the whole product into German, with CI checking that both languages have the exact same keys, and made heavy pages stream their ClickHouse numbers over SSE instead of blocking. I also built Open Graph images that are generated per route, so every product page gets its own card when it's shared.

![Custom sidebar icons](/assets/content/exp/magicapi/noveum.ai/design/sidebar-icons.webp)

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/og/reliability-loop.webp","/assets/content/exp/magicapi/noveum.ai/og/novapilot.webp","/assets/content/exp/magicapi/noveum.ai/og/novaeval.webp","/assets/content/exp/magicapi/noveum.ai/og/scorers.webp"],"columns":2,"label":"Open Graph images"}
:::

#### Keeping the codebase healthy

Remember the code cleanup from my first week at API.market? I did a bigger version of it for Noveum. I moved the monorepo from pnpm to Bun and TypeScript 7, with a CI check that dependency versions resolve exactly the same as before, and upgraded Prisma 6 to 7. Then a series of cleanup PRs deleted over 22,000 lines of dead code (157 unreachable files, 790 unused exports), took build warnings from 142 to 0 and broke 4 import cycles. Each cleanup became a CI check so it stays clean. I also shrank the Docker build context from about 3.7 GB to 1.1 GB and saved around 46 runner minutes on every push.

### AWS Infrastructure Migration

I played a major role in migrating our infrastructure from [OVHCloud](https://www.ovhcloud.com) to [AWS](https://aws.amazon.com). This was a complete overhaul of how we deployed and managed our services. We partnered with [Axcess.io](https://axcess.io) for this migration.

The previous setup on OVHCloud was getting difficult to manage as we scaled. We needed better reliability, proper environment separation, and a more robust CI/CD pipeline. The migration to AWS gave us all of that.

The new setup included:

- **EKS (Elastic Kubernetes Service)** - Moved our Kubernetes clusters to EKS for better container orchestration and scaling
- **S3** - Used for storing profile images and audio uploads with proper bucket policies
- **ECR (Elastic Container Registry)** - All our Docker images are now stored and versioned in ECR
- **Separate AWS Accounts** - We have completely isolated dev and prod environments in different AWS accounts. Watchtower handles automated deployments by watching for new image pushes
- **CodeBuild** - Set up CI/CD pipelines similar to GitHub Actions for building and deploying our services
- **WAF (Web Application Firewall)** - Added protection layer for our APIs against common web exploits
- **IAM Roles** - Proper role-based access for team members. Each person has only the permissions they need
- **VPC with Bastion Server** - All our infrastructure sits inside a VPC. To access internal resources like databases or debug pods, we connect through a Bastion server

This migration improved our deployment reliability and gave us proper separation between environments which we didn't have before.

After the move I kept working on EKS cost and reliability using load tests and CloudWatch data. A week of CloudWatch numbers showed our RDS instance averaging 1.7% CPU, so downsizing it saved about $180 a month. Deleting a node group template that was never deployed avoided another $2,234 a month. And I found a PodDisruptionBudget deadlock that had been quietly blocking node group rotations for months.

### Moving again: AWS to GCP

In September 2026 we moved the whole platform again, this time from AWS to [GCP](https://cloud.google.com), and I led it on top of the landing zone a teammate had set up. I wrote 6 OpenTofu modules (network, GKE, Cloud SQL, storage, edge and delivery), 2 Helm charts and a Cloud Deploy pipeline with a manual approval before production. Then came the fun part: debugging prod until the first real traffic came through (liveness probes that checked dependencies had been restarting pods hundreds of times), moving the customer domains over and writing the cutover runbook.

I also set up backups and actually tested restoring them. Cloud SQL restored to a point in time in 6 minutes 17 seconds with every table's row count matching, and ClickHouse gets backed up every 6 hours and kept for 30 days for under $10 a month.

### Orbit

Orbit is an open source alternative to Linear that we built at Noveum and now use ourselves instead of Plane and Linear. It lives at [orbit.noveum.ai](https://orbit.noveum.ai) and the code is on [GitHub](https://github.com/Noveum/orbit). I started it from an empty repo and wrote everything up to its first production deploy.

The core of it is realtime sync. Every change runs in a Postgres transaction, takes a global sync ID and returns small typed deltas. Those go through Redis to a WebSocket service that checks permissions per scope, batches updates, rate limits and handles backpressure. On the client the deltas patch the TanStack Query cache in place, and after a reconnect the client catches up from where it left off. So when someone drags an issue on their board, it moves on yours too.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/orbit/board.webp","/assets/content/exp/magicapi/orbit/issue.webp","/assets/content/exp/magicapi/orbit/standup.webp","/assets/content/exp/magicapi/orbit/docs-diagram.webp","/assets/content/exp/magicapi/orbit/sign-in.webp"],"columns":2,"label":"Orbit"}
:::

After that came keyset pagination with a virtualized list (loading 8,000 issues used to mean 7.5 MB over 40 requests), a nested filter engine compiled to SQL, docs with nesting and version history, sprint analytics, GitHub and Slack integrations, an MCP server, and an importer that moved all of our Plane and Linear data over. On the security side I added passkey sign in, an OAuth 2.1 server so AI clients can connect to Orbit's MCP server in one click, short lived signed tickets for WebSockets instead of session tokens in URLs, and made removing a member close their sessions and sockets in the same transaction. Orbit first ran on EKS, and I later moved it to Vercel and Supabase by folding the WebSocket hub and MCP server into one Next.js deployment.

### Yodu.ai: a private browser for AI employees

For [Yodu.ai](https://yodu.ai) I designed and built a browser runtime that lets AI employees use a real, logged in Chromium session for each user. A supervisor starts one locked down container per active browser profile and talks to it over the Chrome DevTools Protocol. The agent gets 10 browser tools over MCP, and every action goes through one permission check. Approvals are tied to a signed snapshot of the page, so an approved click can't be replayed on a page that has changed since. A human can take over at any time, and session state is kept in encrypted vaults.

![Yodu.ai homepage](/assets/content/exp/magicapi/yodu/homepage.webp)

Here's how the pieces fit together:

![Architecture of the private browser runtime](/assets/content/exp/magicapi/yodu/browser-runtime.webp)

### Hinge

[Hinge](https://github.com/Noveum/hinge) is a small open source macOS app we made for fun. It reads the MacBook's lid angle sensor and folds your live desktop in perspective as you close the lid, using IOKit, ScreenCaptureKit and a Metal shader. I wrote the first renderer and the sensor code and set up releases. It's at almost 80 stars, and people outside the company have started contributing to it.

The post where I open sourced it went viral, crossing 170k views:

:::embed tweet-embed
{"tweetUrl":"https://x.com/pu_lkit/status/2098105499879416040","content":"here you go, free and open sourced ✌🏻\n\nhttps://hinge.noveum.ai","stats":{"likes":2206,"bookmarks":0,"comments":57,"retweets":61,"views":"170k"},"timestamp":"September 10, 2026"}
:::

## Technologies & Skills

:::embed tech-badges
{"technologies":["TypeScript","JavaScript","Python","Nextjs (Pages Router)","Next.js (App Router)","React","Next Auth (Auth.js)","Hono","Stripe","AWS Marketplace","Tailwind CSS","Elasticsearch","PostgreSQL","Prisma","Drizzle","ClickHouse","Redis","BullMQ","WebSockets","MCP","Bun","Turborepo","Docker","Kubernetes","Helm","KEDA","Git","AWS","EKS","S3","ECR","CodeBuild","WAF","IAM","VPC","SQS","GCP","GKE","Cloud SQL","OpenTofu","Chromium","Swift"]}
:::

## Documents

:::embed document-tabs
{"documents":[{"title":"Offer Letter","documentUrl":"/assets/content/exp/magicapi/offer-letter.pdf"},{"title":"Internship Completion Letter","documentUrl":"/assets/content/exp/magicapi/internship-completion-letter.pdf"}]}
:::
