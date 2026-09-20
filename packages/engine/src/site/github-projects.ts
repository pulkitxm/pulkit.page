import process from "node:process";
import { isRecord } from "../lib/guards.ts";
import type { ListedProject, ProjectList } from "../types.ts";

const endpoint = "https://api.github.com/graphql";

const query = `query ProjectList($login: String!) {
  user(login: $login) {
    lists(first: 50) {
      nodes {
        slug
        description
        items(first: 100) {
          nodes {
            ... on Repository {
              nameWithOwner
              url
              description
              homepageUrl
              stargazerCount
            }
          }
        }
      }
    }
  }
}`;

function token(): string {
  const value = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!value) {
    throw new Error(
      "A :::projects directive needs GITHUB_TOKEN (or GH_TOKEN) to read the starred list. Set it to a token with no scopes beyond public read, for example GITHUB_TOKEN=$(gh auth token).",
    );
  }
  return value;
}

function ownSite(href: string, origins: readonly string[]): boolean {
  try {
    const { origin } = new URL(href);
    return origins.includes(origin);
  } catch {
    return false;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readProject(node: unknown, origins: readonly string[]): ListedProject | undefined {
  if (!isRecord(node)) {
    return;
  }
  const name = text(node.nameWithOwner);
  const url = text(node.url);
  if (!(name && url)) {
    return;
  }
  const site = text(node.homepageUrl);
  const description = text(node.description);
  return {
    name: name.split("/").pop() ?? name,
    url,
    stars: typeof node.stargazerCount === "number" ? node.stargazerCount : 0,
    ...(description && { description }),
    ...(site.startsWith("https://") && !ownSite(site, origins) && { site }),
  };
}

async function request(login: string): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `bearer ${token()}`,
      "content-type": "application/json",
      "user-agent": "pulkit.page-build",
    },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub replied ${response.status} ${response.statusText} for ${login}'s lists`,
    );
  }
  const body: unknown = await response.json();
  if (isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0) {
    const [first] = body.errors;
    throw new Error(
      `GitHub rejected the starred-list query: ${isRecord(first) ? text(first.message) : "unknown error"}`,
    );
  }
  return body;
}

function listNodes(body: unknown): unknown[] {
  const data = isRecord(body) ? body.data : undefined;
  const user = isRecord(data) ? data.user : undefined;
  const lists = isRecord(user) ? user.lists : undefined;
  const nodes = isRecord(lists) ? lists.nodes : undefined;
  return Array.isArray(nodes) ? nodes : [];
}

export async function fetchProjectList(
  login: string,
  slug: string,
  origins: readonly string[],
): Promise<ProjectList> {
  const key = `${login}/${slug}`;
  const list = listNodes(await request(login)).find(
    (node) => isRecord(node) && text(node.slug) === slug,
  );
  if (!isRecord(list)) {
    throw new Error(`${login} has no public starred list called ${slug}`);
  }
  const items = isRecord(list.items) ? list.items.nodes : undefined;
  const projects = (Array.isArray(items) ? items : [])
    .map((node) => readProject(node, origins))
    .filter((project): project is ListedProject => project !== undefined)
    .sort((left, right) => right.stars - left.stars || left.name.localeCompare(right.name));
  if (projects.length === 0) {
    throw new Error(`The starred list ${key} is empty`);
  }
  return { description: text(list.description), projects };
}
