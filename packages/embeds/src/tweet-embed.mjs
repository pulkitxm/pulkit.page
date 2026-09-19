import { renderTweet } from "./tweet.mjs";

const author = {
  name: "Pulkit",
  profileLink: "https://x.com/_pulkitxm",
  username: "_pulkitxm",
  verified: true,
};

export function render({ tweetUrl, content, stats, timestamp }, { escapeHtml }) {
  const tweet = renderTweet(
    {
      likes: stats.likes,
      bookmarks: stats.bookmarks,
      comments: stats.comments,
      retweets: stats.retweets,
      timestamp,
      views: stats.views,
      content,
      link: tweetUrl,
      user: author,
    },
    escapeHtml,
  );
  return `<div class="my-8 flex items-center justify-center">${tweet}</div>`;
}
