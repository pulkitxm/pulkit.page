import { faBookmark, faComment, faHeart } from "@fortawesome/free-regular-svg-icons";
import {
  faArrowUpFromBracket,
  faCircleCheck,
  faEllipsis,
  faRetweet,
} from "@fortawesome/free-solid-svg-icons";
import { type FontAwesomeIcon, faSvg } from "@pulkit/shared/icons";
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
  icon: FontAwesomeIcon;
  label: (count: Count) => string;
  hover: string;
}

const defaultAvatar = "/assets/content/pulkit-portrait.webp";

const actionIcon = "size-4 shrink-0 transition-transform duration-200";

const actions: readonly TweetAction[] = [
  {
    key: "comments",
    icon: faComment,
    label: (count) => `Reply. ${count} replies`,
    hover: "hover:text-[#3b82f6] focus:text-[#3b82f6]",
  },
  {
    key: "retweets",
    icon: faRetweet,
    label: (count) => `Retweet. ${count} retweets`,
    hover: "hover:text-[#16a34a] focus:text-[#16a34a]",
  },
  {
    key: "likes",
    icon: faHeart,
    label: (count) => `Like. ${count} likes`,
    hover: "hover:text-[#ef4444] focus:text-[#ef4444]",
  },
  {
    key: "bookmarks",
    icon: faBookmark,
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
  return `<button type="button" class="group/btn inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border-0 bg-transparent px-2.5 font-medium text-[14px] text-inherit transition-colors hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] ${action.hover}" aria-label="${escapeHtml(action.label(count))}">${faSvg(action.icon, actionIcon)}${shown ? `<span class="text-xs tabular-nums sm:text-[14px]">${escapeHtml(shown)}</span>` : ""}</button>`;
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
  const header = `<header class="mb-3 flex items-start justify-between gap-2 sm:gap-4"><div class="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3"><a href="${profile}" target="_blank" rel="noopener noreferrer" class="relative z-10 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]" aria-label="View ${name}'s profile"><img src="${escapeHtml(avatar)}" alt="${name}" width="40" height="40" loading="lazy" decoding="async" class="block size-10 rounded-full object-cover object-top-left sm:size-12" /></a><div class="flex min-w-0 flex-1 flex-col"><div class="flex min-w-0 items-center gap-1.5 sm:gap-2"><h3 class="m-0 truncate font-semibold text-base leading-[1.5] sm:font-bold sm:text-[18px] sm:leading-[1.556]">${name}</h3>${user.verified ? `${faSvg(faCircleCheck, "size-4 shrink-0 text-[#3b82f6]")}` : ""}</div><a href="${profile}" target="_blank" rel="noopener noreferrer" class="relative z-10 inline-block max-w-full truncate py-0.5 text-[14px] text-muted no-underline leading-[1.43] transition-colors hover:text-fg focus:text-fg focus:outline-none">@${escapeHtml(user.username)}</a></div></div><button type="button" class="relative z-10 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-muted transition-colors hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] sm:size-8" aria-label="More options">${faSvg(faEllipsis, "size-4 shrink-0")}</button></header>`;
  const body = `<div class="mb-3 break-words text-base leading-[1.625] sm:mb-4 sm:text-[18px]">${escapeHtml(content).replaceAll("\n", "<br />")}</div>`;
  const meta =
    timestamp || views
      ? `<div class="mb-4 flex flex-wrap items-center gap-1 text-xs leading-[1.333] text-muted sm:mb-5 sm:text-[14px] sm:leading-[1.43]">${timestamp ? `<time>${escapeHtml(timestamp)}</time>` : ""}${views ? `<span aria-hidden="true"> · </span><span class="font-semibold tabular-nums text-fg">${escapeHtml(views)}</span><span> Views</span>` : ""}</div>`
      : "";
  const hasActions = [comments, retweets, likes, bookmarks].some(Boolean);
  const footer = hasActions
    ? `<footer class="relative z-10 border-t border-line pt-3 sm:pt-4"><div class="flex items-center justify-between text-muted"><div role="group" class="flex items-center gap-4 sm:gap-8" aria-label="Tweet actions">${actions.map((action) => actionButton(action, counts[action.key], escapeHtml)).join("")}</div><button type="button" class="inline-flex h-11 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent px-2.5 text-inherit transition-colors hover:text-[#3b82f6] focus:text-[#3b82f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]" aria-label="Share tweet">${faSvg(faArrowUpFromBracket, "size-4 shrink-0")}</button></div></footer>`
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
