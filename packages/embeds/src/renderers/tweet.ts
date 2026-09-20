import type { IconNode } from "lucide";
import { Bookmark, Ellipsis, Heart, MessageCircle, Repeat2, Share } from "lucide";
import { lucideSvg } from "../lib/icons.ts";
import { optionalCount, optionalString, readRecord, readString } from "../lib/props.ts";
import type { EmbedProps, EmbedRenderer, EscapeHtml } from "../types.ts";

type Count = string | number;

export interface TweetUser {
  name: string;
  username: string;
  profileLink: string;
  pfp?: string | undefined;
  verified?: unknown;
}

interface Tweet {
  content: string;
  link: string;
  user: TweetUser;
  timestamp?: string | undefined;
  views?: Count | undefined;
  likes?: Count | undefined;
  comments?: Count | undefined;
  retweets?: Count | undefined;
  bookmarks?: Count | undefined;
}

interface TweetAction {
  key: "comments" | "retweets" | "likes" | "bookmarks";
  icon: IconNode;
  label: (count: Count) => string;
  hover: string;
}

const defaultAvatar = "/assets/content/pulkit-portrait.webp";

const verifiedPath =
  "M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z";

const actionIcon = "size-4 shrink-0 transition-transform duration-200";

const actions: readonly TweetAction[] = [
  {
    key: "comments",
    icon: MessageCircle,
    label: (count) => `Reply. ${count} replies`,
    hover: "hover:text-[#3b82f6] focus:text-[#3b82f6]",
  },
  {
    key: "retweets",
    icon: Repeat2,
    label: (count) => `Retweet. ${count} retweets`,
    hover: "hover:text-[#16a34a] focus:text-[#16a34a]",
  },
  {
    key: "likes",
    icon: Heart,
    label: (count) => `Like. ${count} likes`,
    hover: "hover:text-[#ef4444] focus:text-[#ef4444]",
  },
  {
    key: "bookmarks",
    icon: Bookmark,
    label: (count) => `Bookmark. ${count} bookmarks`,
    hover: "hover:text-[#3b82f6] focus:text-[#3b82f6]",
  },
];

function displayCount(count: Count): string {
  if (typeof count === "number") {
    return count > 0 ? String(count) : "";
  }
  return count ? String(count) : "";
}

function actionButton(action: TweetAction, count: Count, escapeHtml: EscapeHtml): string {
  const shown = displayCount(count);
  return `<button type="button" class="group/btn inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border-0 bg-transparent px-2.5 font-medium text-[14px] text-inherit transition-colors hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] ${action.hover}" aria-label="${escapeHtml(action.label(count))}">${lucideSvg(action.icon, actionIcon)}${shown ? `<span class="text-xs tabular-nums sm:text-[14px]">${escapeHtml(shown)}</span>` : ""}</button>`;
}

export function renderTweet(
  {
    content,
    link,
    user,
    timestamp,
    views,
    likes = 0,
    comments = 0,
    retweets = 0,
    bookmarks = 0,
  }: Tweet,
  escapeHtml: EscapeHtml,
): string {
  const counts: Record<TweetAction["key"], Count> = { likes, comments, retweets, bookmarks };
  const avatar = user.pfp ?? defaultAvatar;
  const profile = escapeHtml(user.profileLink);
  const name = escapeHtml(user.name);
  const header = `<header class="mb-3 flex items-start justify-between gap-2 sm:gap-4"><div class="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3"><a href="${profile}" target="_blank" rel="noopener noreferrer" class="relative z-10 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]" aria-label="View ${name}'s profile"><img src="${escapeHtml(avatar)}" alt="${name}" width="40" height="40" loading="lazy" decoding="async" class="block size-10 rounded-full object-cover object-top-left sm:size-12" /></a><div class="flex min-w-0 flex-1 flex-col"><div class="flex min-w-0 items-center gap-1.5 sm:gap-2"><h3 class="m-0 truncate font-semibold text-base leading-[1.5] sm:font-bold sm:text-[18px] sm:leading-[1.556]">${name}</h3>${user.verified ? `<svg class="size-4 shrink-0 text-[#3b82f6]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${verifiedPath}" /></svg>` : ""}</div><a href="${profile}" target="_blank" rel="noopener noreferrer" class="relative z-10 inline-block max-w-full truncate py-0.5 text-[14px] text-muted no-underline leading-[1.43] transition-colors hover:text-fg focus:text-fg focus:outline-none">@${escapeHtml(user.username)}</a></div></div><button type="button" class="relative z-10 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-muted transition-colors hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] sm:size-8" aria-label="More options">${lucideSvg(Ellipsis, "size-4 shrink-0")}</button></header>`;
  const body = `<div class="mb-3 break-words text-base leading-[1.625] sm:mb-4 sm:text-[18px]">${escapeHtml(content).replaceAll("\n", "<br />")}</div>`;
  const meta =
    timestamp || views
      ? `<div class="mb-4 flex flex-wrap items-center gap-1 text-xs leading-[1.333] text-muted sm:mb-5 sm:text-[14px] sm:leading-[1.43]">${timestamp ? `<time>${escapeHtml(timestamp)}</time>` : ""}${views ? `<span aria-hidden="true"> · </span><span class="font-semibold tabular-nums text-fg">${escapeHtml(views)}</span><span> Views</span>` : ""}</div>`
      : "";
  const hasActions = [comments, retweets, likes, bookmarks].some(Boolean);
  const footer = hasActions
    ? `<footer class="relative z-10 border-t border-line pt-3 sm:pt-4"><div class="flex items-center justify-between text-muted"><div role="group" class="flex items-center gap-4 sm:gap-8" aria-label="Tweet actions">${actions.map((action) => actionButton(action, counts[action.key], escapeHtml)).join("")}</div><button type="button" class="inline-flex h-11 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent px-2.5 text-inherit transition-colors hover:text-[#3b82f6] focus:text-[#3b82f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]" aria-label="Share tweet">${lucideSvg(Share, "size-4 shrink-0")}</button></div></footer>`
    : "";
  return `<article class="group relative isolate mx-auto w-full max-w-[42rem] cursor-pointer rounded-[14px] border-2 border-line bg-bg p-4 text-fg leading-[1.5] shadow-[0_10px_15px_-3px_rgb(0_0_0/0.1),0_4px_6px_-4px_rgb(0_0_0/0.1)] transition-[background-color,box-shadow] hover:bg-surface hover:shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_0/0.1)] sm:p-6" data-tweet><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="absolute inset-0 z-0 rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"><span class="sr-only">Open tweet on X</span></a>${header}${body}${meta}${footer}</article>`;
}

function readTweetUser(value: unknown, embed: string): TweetUser {
  const user = readRecord(value, `${embed} user`);
  return {
    name: readString(user, "name", embed),
    username: readString(user, "username", embed),
    profileLink: readString(user, "profileLink", embed),
    pfp: optionalString(user, "pfp", embed),
    verified: user.verified,
  };
}

function readTweet(props: EmbedProps): Tweet {
  return {
    content: readString(props, "content", "tweet"),
    link: readString(props, "link", "tweet"),
    user: readTweetUser(props.user, "tweet"),
    timestamp: optionalString(props, "timestamp", "tweet"),
    views: optionalCount(props, "views", "tweet"),
    likes: optionalCount(props, "likes", "tweet"),
    comments: optionalCount(props, "comments", "tweet"),
    retweets: optionalCount(props, "retweets", "tweet"),
    bookmarks: optionalCount(props, "bookmarks", "tweet"),
  };
}

export const render: EmbedRenderer = (props, { escapeHtml }) =>
  renderTweet(readTweet(props), escapeHtml);
