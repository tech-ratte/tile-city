import { SITE_ORIGIN } from "../site-origin.js";

function siteUrl() {
  if (SITE_ORIGIN) {
    return String(SITE_ORIGIN).replace(/\/$/, "") + "/";
  }
  try {
    return new URL("index.html", location.href).href;
  } catch (err) {
    return location.href;
  }
}

function rankingRows(game, nameOf) {
  const order = game.standings || game.players.map((_, index) => index);
  return order.map((index, rank) => {
    const player = game.players[index];
    return {
      rank: rank + 1,
      name: nameOf(player),
      score: game.scores[index],
    };
  });
}

export function buildShareText(game, nameOf, labels) {
  const rows = rankingRows(game, nameOf);
  const lines = [labels.title, ""].concat(
    rows.map((row) => row.rank + ". " + row.name + " — " + row.score),
    ["", labels.hashtag]
  );
  return lines.join("\n");
}

export function snsLinks(text) {
  const url = siteUrl();
  const encodedUrl = encodeURIComponent(url);
  const withUrl = encodeURIComponent(text + "\n" + url);
  return {
    url,
    x: "https://twitter.com/intent/tweet?text=" + withUrl,
    facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodedUrl,
    line: "https://social-plugins.line.me/lineit/share?url=" + encodedUrl,
    bluesky: "https://bsky.app/intent/compose?text=" + withUrl,
    threads: "https://www.threads.net/intent/post?text=" + withUrl,
    text,
  };
}

export async function nativeShare({ text, url }) {
  if (!navigator.share) return null;
  await navigator.share({ title: "TileCity", text, url });
  return "text";
}

export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

export { siteUrl, rankingRows };
