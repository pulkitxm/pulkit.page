import { optionalCount, optionalString, readRecord, readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";
import { renderTweet, type TweetUser } from "./tweet.ts";

const author: TweetUser = {
  name: "Pulkit",
  profileLink: "https://x.com/_pulkitxm",
  username: "_pulkitxm",
  verified: true,
};

export const render: EmbedRenderer = (props, { escapeHtml }) => {
  const stats = readRecord(props.stats, "tweet-embed stats");
  const tweet = renderTweet(
    {
      likes: optionalCount(stats, "likes", "tweet-embed"),
      bookmarks: optionalCount(stats, "bookmarks", "tweet-embed"),
      comments: optionalCount(stats, "comments", "tweet-embed"),
      retweets: optionalCount(stats, "retweets", "tweet-embed"),
      timestamp: optionalString(props, "timestamp", "tweet-embed"),
      views: optionalCount(stats, "views", "tweet-embed"),
      content: readString(props, "content", "tweet-embed"),
      link: readString(props, "tweetUrl", "tweet-embed"),
      user: author,
    },
    escapeHtml,
  );
  return `<div class="my-8 flex items-center justify-center">${tweet}</div>`;
};
