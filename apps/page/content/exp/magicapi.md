---
title: MagicAPI
description: Working as a Software Engineer at API.market (MagicAPI), responsible for improving user
  experience, implementing new features, code quality improvements, wallet system, voucher system,
  and redesigning key platform components.
role: Software Engineer
date: 2025-03-25
period: Mar 2025 – present
icon: /assets/exp/noveum.webp
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

### New Hero Section Design

I redesigned the hero section of the API.market website to enhance user engagement and provide clearer information hierarchy. The new design featured improved visual flow, better call-to-action placement, and more intuitive navigation elements.

<video src="/assets/content/exp/magicapi/new-hero-section.mp4" title="New Hero Section" autoplay loop muted playsinline controls><track kind="captions"></video>

### Smart Onboarding form

I redesigned the smart onboarding form to enhance user engagement and provide clearer information hierarchy. The new design featured improved visual flow, better call-to-action placement, and more intuitive navigation elements.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/smart-onboarding-form/step-1.webp","/assets/content/exp/magicapi/smart-onboarding-form/step-2.webp","/assets/content/exp/magicapi/smart-onboarding-form/step-3.webp"],"columns":3,"label":"Smart onboarding form"}
:::

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

#### Completing Six Months

On October 1st 2025, I completed six months at MagicAPI. It had been a remarkable journey, starting with API.Market and evolving into building Noveum AI from the ground up. Beyond just shipping features, I grew a lot as an engineer here. The team's culture of sharing what works, iterating fast, and pushing each other on AI-assisted workflows shaped how I approach building software today.

I shared my reflections on [LinkedIn](https://www.linkedin.com/posts/pulkitxm_as-i-reflect-on-completing-6-months-with-activity-7379207712821325824-xuhn) as well.

#### ETL Job with Agent

The ETL (Extract, Transform, Load) pipeline converted traces into datasets via an asynchronous background workflow. I built the end-to-end job orchestration using BullMQ workers, deployed it to a Kubernetes cluster, and operated the Redis infrastructure it depended on.

:::embed image-grid
{"images":["/assets/content/exp/magicapi/noveum.ai/etl-job/etl-jobs.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/mapper-agent.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/trace-picker.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/complete-trace-view.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/create-job.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/mapper-code.webp","/assets/content/exp/magicapi/noveum.ai/etl-job/etl-job-runs.webp"],"columns":2,"label":"ETL job"}
:::

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

## Technologies & Skills

:::embed tech-badges
{"technologies":["TypeScript","JavaScript","Nextjs (Pages Router)","Next Auth (Auth.js)","Stripe","Tailwind CSS","Elasticsearch","PostgreSQL","Kubernetes","Turborepo","Docker","Git","AWS","EKS","S3","ECR","CodeBuild","WAF","IAM","VPC","Redis","BullMQ"]}
:::

## Documents

:::embed document-tabs
{"documents":[{"title":"Offer Letter","documentUrl":"/assets/content/exp/magicapi/offer-letter.pdf"},{"title":"Internship Completion Letter","documentUrl":"/assets/content/exp/magicapi/internship-completion-letter.pdf"}]}
:::
