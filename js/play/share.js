import { toPng } from "html-to-image";
import { SITE_ORIGIN } from "../site-origin.js";

const RANK_HEX = {
  red: "#ff5d78",
  blue: "#49c4ff",
  green: "#3dff9a",
  yellow: "#ffe14a",
  orange: "#ff9a3d",
  purple: "#7c3aed",
  white: "#f4f7fb",
  brown: "#a67c52",
};

/* Instagram Stories / Reels friendly 9:16 */
const SHARE_W = 1080;
const SHARE_H = 1920;

function siteUrl() {
  // Prefer .../index.html so X/Twitter can fetch OG tags (directory URLs often fail).
  if (SITE_ORIGIN) {
    return String(SITE_ORIGIN).replace(/\/$/, "") + "/index.html";
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
      color: player.id,
      hex: RANK_HEX[player.id] || "#f4f7fb",
      bot: !!player.bot,
      botMaster: !!(player.bot && player.botStrength === "master"),
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

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function measureFilledCrop(grid, pixelRatio, marginCss) {
  const slots = grid.querySelectorAll(".slot.filled");
  if (!slots.length) return null;
  const gridRect = grid.getBoundingClientRect();
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  slots.forEach((el) => {
    const r = el.getBoundingClientRect();
    minL = Math.min(minL, r.left);
    minT = Math.min(minT, r.top);
    maxR = Math.max(maxR, r.right);
    maxB = Math.max(maxB, r.bottom);
  });
  const margin = marginCss * pixelRatio;
  const x = (minL - gridRect.left) * pixelRatio - margin;
  const y = (minT - gridRect.top) * pixelRatio - margin;
  const w = (maxR - minL) * pixelRatio + margin * 2;
  const h = (maxB - minT) * pixelRatio + margin * 2;
  return { x, y, w, h };
}

function clampCrop(crop, imgW, imgH) {
  if (!crop) {
    return { x: 0, y: 0, w: imgW, h: imgH };
  }
  const x = Math.max(0, Math.floor(crop.x));
  const y = Math.max(0, Math.floor(crop.y));
  const right = Math.min(imgW, Math.ceil(crop.x + crop.w));
  const bottom = Math.min(imgH, Math.ceil(crop.y + crop.h));
  return {
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
  };
}

async function captureBoardPng() {
  const grid = document.getElementById("grid");
  const box = document.getElementById("scroller");
  if (!grid || !box) throw new Error("board missing");

  // Capture the tile grid itself (not the scroll viewport). The scroller has a
  // full-viewport pad on each side; html-to-image resets scroll to 0, so a
  // viewport shot was only empty sand — and overflow:scroll drew scrollbars.
  const prevPad = grid.style.padding;
  const scrollLeft = box.scrollLeft;
  const scrollTop = box.scrollTop;
  // Hide end-game +N chips and the last-place owner ring for a clean share board.
  const hidden = [];
  grid.querySelectorAll(".meeple-earned, .recent-ring").forEach((el) => {
    hidden.push([el, el.style.visibility]);
    el.style.visibility = "hidden";
  });
  grid.style.padding = "0";
  void grid.offsetWidth;

  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  // Crop to placed tiles only — exclude the empty placeable ring from bounds(1).
  const crop = measureFilledCrop(grid, pixelRatio, 10);

  try {
    await waitFrame();
    const dataUrl = await toPng(grid, {
      cacheBust: true,
      pixelRatio,
      style: {
        overflow: "visible",
        padding: "0",
      },
    });
    return { dataUrl, crop };
  } finally {
    hidden.forEach(([el, value]) => {
      el.style.visibility = value;
    });
    grid.style.padding = prevPad;
    void grid.offsetWidth;
    box.scrollLeft = scrollLeft;
    box.scrollTop = scrollTop;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

const SIDE_PAD = 48;
const SIDE_GAP = 28;
/* Compact card — not full canvas width — so type can stay large. */
const RANK_WIDTH = 720;

function rankingCardSize(rows) {
  const pad = 36;
  const rowH = 72;
  const titleH = 64;
  return {
    pad,
    rowH,
    titleH,
    width: RANK_WIDTH,
    height: pad * 2 + titleH + rows.length * rowH,
  };
}

/** Same robot mark as HUD `.bot-badge` (viewBox 0 0 24 24). */
const BOT_ICO_PATH =
  "M9 3h6v2h3a2 2 0 0 1 2 2v5h-2V7H6v5H4V7a2 2 0 0 1 2-2h3V3zm-3 9h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2h2v2h-2V2z";

function drawBotBadge(ctx, cx, cy, master) {
  const size = 34;
  const x = cx - size / 2;
  const y = cy - size / 2;
  ctx.save();
  if (master) {
    ctx.fillStyle = "rgba(140, 60, 20, 0.55)";
    ctx.strokeStyle = "rgba(255, 196, 72, 0.9)";
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
  }
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, size, size, 6);
  ctx.fill();
  ctx.stroke();
  if (master) {
    ctx.shadowColor = "rgba(255, 160, 40, 0.55)";
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = master ? "#ffe7a8" : "#d7e6f5";
  ctx.translate(x + 4, y + 4);
  ctx.scale((size - 8) / 24, (size - 8) / 24);
  ctx.fill(new Path2D(BOT_ICO_PATH));
  ctx.restore();
  return size;
}

function drawRankingCard(ctx, rows, labels, x, y) {
  const { pad, rowH, titleH, width, height } = rankingCardSize(rows);

  ctx.fillStyle = "rgba(10, 16, 28, 0.88)";
  ctx.strokeStyle = "rgba(140, 220, 255, 0.35)";
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, width, height, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f4f7fb";
  ctx.font = "700 42px 'Segoe UI', 'Yu Gothic UI', sans-serif";
  ctx.fillText(labels.ranking, x + pad, y + pad + 38);

  rows.forEach((row, i) => {
    const top = y + pad + titleH + i * rowH;
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    roundRect(ctx, x + 22, top, width - 44, rowH - 12, 14);
    ctx.fill();

    ctx.fillStyle = "#93a8be";
    ctx.font = "700 32px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    ctx.fillText(String(row.rank), x + 44, top + 42);

    ctx.fillStyle = "#f4f7fb";
    ctx.font = "700 38px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    const score = String(row.score);
    const sw = ctx.measureText(score).width;
    const scoreX = x + width - 44 - sw;
    ctx.fillText(score, scoreX, top + 42);

    const nameMax = row.bot ? 10 : 12;
    const name = row.name.length > nameMax ? row.name.slice(0, nameMax - 1) + "…" : row.name;
    ctx.fillStyle = row.hex;
    ctx.font = "700 36px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    const nameX = x + 88;
    ctx.fillText(name, nameX, top + 42);
    if (row.bot) {
      const nameW = ctx.measureText(name).width;
      drawBotBadge(ctx, nameX + nameW + 22, top + 30, row.botMaster);
    }
  });

  return { x, y, w: width, h: height };
}

function drawBrandMark(ctx, x, y, url) {
  const label = "TileCity";
  const link = String(url || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/index\.html$/i, "")
    .replace(/\/$/, "");
  const padX = 32;
  const padY = 22;
  const gap = 14;

  ctx.save();
  ctx.font = "700 64px Georgia, 'Times New Roman', serif";
  const titleMetrics = ctx.measureText(label);
  const titleAscent = titleMetrics.actualBoundingBoxAscent || 50;
  const titleDescent = titleMetrics.actualBoundingBoxDescent || 14;
  const titleW = titleMetrics.width;

  ctx.font = "600 36px 'Segoe UI', 'Yu Gothic UI', sans-serif";
  const linkMetrics = ctx.measureText(link);
  const linkAscent = linkMetrics.actualBoundingBoxAscent || 28;
  const linkDescent = linkMetrics.actualBoundingBoxDescent || 8;
  const linkW = linkMetrics.width;

  const innerW = Math.max(titleW, linkW);
  const w = innerW + padX * 2;
  const h =
    padY + titleAscent + titleDescent + gap + linkAscent + linkDescent + padY;

  ctx.fillStyle = "rgba(10, 16, 28, 0.55)";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();

  ctx.fillStyle = "#f3efe6";
  ctx.font = "700 64px Georgia, 'Times New Roman', serif";
  ctx.fillText(label, x + padX, y + padY + titleAscent);

  ctx.fillStyle = "rgba(243, 239, 230, 0.85)";
  ctx.font = "600 36px 'Segoe UI', 'Yu Gothic UI', sans-serif";
  ctx.fillText(
    link,
    x + padX,
    y + padY + titleAscent + titleDescent + gap + linkAscent
  );
  ctx.restore();
  return { x, y, w, h };
}

export async function composeShareImage(game, nameOf, labels) {
  const rows = rankingRows(game, nameOf);
  const captured = await captureBoardPng();
  const board = await loadImage(captured.dataUrl);
  const crop = clampCrop(captured.crop, board.width, board.height);

  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#b69256";
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // Portrait: title+link (top-left) → board → ranking (bottom).
  const brand = drawBrandMark(ctx, SIDE_PAD, SIDE_PAD, siteUrl());
  const rankSize = rankingCardSize(rows);
  const rankY = SHARE_H - SIDE_PAD - rankSize.height;
  const rankX = Math.round((SHARE_W - rankSize.width) / 2);

  const boardArea = {
    x: SIDE_PAD,
    y: brand.y + brand.h + SIDE_GAP,
    w: SHARE_W - SIDE_PAD * 2,
    h: Math.max(120, rankY - SIDE_GAP - (brand.y + brand.h + SIDE_GAP)),
  };
  const scale = Math.min(boardArea.w / crop.w, boardArea.h / crop.h);
  const dw = crop.w * scale;
  const dh = crop.h * scale;
  const dx = boardArea.x + (boardArea.w - dw) / 2;
  const dy = boardArea.y + (boardArea.h - dh) / 2;
  ctx.drawImage(board, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);

  drawRankingCard(ctx, rows, labels, rankX, rankY);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
  const dataUrl = canvas.toDataURL("image/png");
  return { blob, dataUrl, fileName: "tilecity-ranking.png" };
}

function isAppleTouch() {
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function snsLinks(text) {
  const url = siteUrl();
  const encodedUrl = encodeURIComponent(url);
  const body = text + "\n" + url;
  const withUrl = encodeURIComponent(body);
  // social-plugins.line.me often loops LINE↔Safari on iOS (esp. private /
  // ITP). The R/msg/text scheme opens the LINE compose screen directly.
  const line = isAppleTouch()
    ? "https://line.me/R/msg/text/?" + withUrl
    : "https://social-plugins.line.me/lineit/share?url=" +
      encodedUrl +
      "&text=" +
      encodeURIComponent(text);
  return {
    url,
    x: "https://twitter.com/intent/tweet?text=" + withUrl,
    facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodedUrl,
    line,
    threads: "https://www.threads.net/intent/post?text=" + withUrl,
    text,
  };
}

export async function nativeShare({ blob, fileName, text, url }) {
  const payload = { title: "TileCity", text, url };
  if (blob) {
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ ...payload, files: [file] });
      return "files";
    }
  }
  if (navigator.share) {
    await navigator.share(payload);
    return "text";
  }
  return null;
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

export async function downloadBlob(blob, fileName) {
  // iPhone/iPad: <a download> and Web Share both fail to feel like "save".
  // Share… already opens the system sheet (with Save Image). For this button,
  // point at the in-sheet preview so the user can long-press → Add to Photos.
  if (isAppleTouch()) {
    return "ios-hint";
  }

  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
  return "download";
}

export { siteUrl, rankingRows };
