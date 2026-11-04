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

const SHARE_W = 1200;
const SHARE_H = 675;

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
      color: player.id,
      hex: RANK_HEX[player.id] || "#f4f7fb",
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

const SIDE_PAD = 24;
const SIDE_GAP = 16;
const RANK_WIDTH = 280;
const RANK_SCALE = 1.3;

function drawRankingCard(ctx, rows, labels, x, y) {
  const pad = 18;
  const rowH = 34;
  const titleH = 36;
  const width = RANK_WIDTH;
  const height = pad * 2 + titleH + rows.length * rowH;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(RANK_SCALE, RANK_SCALE);

  ctx.fillStyle = "rgba(10, 16, 28, 0.88)";
  ctx.strokeStyle = "rgba(140, 220, 255, 0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, 0, 0, width, height, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f4f7fb";
  ctx.font = "700 18px 'Segoe UI', 'Yu Gothic UI', sans-serif";
  ctx.fillText(labels.ranking, pad, pad + 20);

  rows.forEach((row, i) => {
    const top = pad + titleH + i * rowH;
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    roundRect(ctx, 12, top, width - 24, rowH - 6, 8);
    ctx.fill();

    ctx.fillStyle = "#93a8be";
    ctx.font = "700 13px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    ctx.fillText(String(row.rank), 22, top + 18);

    ctx.fillStyle = row.hex;
    ctx.font = "700 14px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    const name = row.name.length > 12 ? row.name.slice(0, 11) + "…" : row.name;
    ctx.fillText(name, 42, top + 18);

    ctx.fillStyle = "#f4f7fb";
    ctx.font = "700 15px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    const score = String(row.score);
    const sw = ctx.measureText(score).width;
    ctx.fillText(score, width - 22 - sw, top + 18);
  });
  ctx.restore();
  return { x, y, w: width * RANK_SCALE, h: height * RANK_SCALE };
}

function drawBrandMark(ctx, x, y) {
  const label = "TileCity";
  const padX = 22;
  const padY = 16;

  ctx.save();
  ctx.font = "700 44px Georgia, 'Times New Roman', serif";
  const metrics = ctx.measureText(label);
  const ascent = metrics.actualBoundingBoxAscent || 35;
  const descent = metrics.actualBoundingBoxDescent || 10;
  const tw = metrics.width;
  const w = tw + padX * 2;
  const h = ascent + descent + padY * 2;

  ctx.fillStyle = "rgba(10, 16, 28, 0.55)";
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = "#f3efe6";
  ctx.fillText(label, x + padX, y + padY + ascent);
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

  // Left column for title + ranking; board fits the remaining right area.
  const sideW = Math.max(RANK_WIDTH * RANK_SCALE, 220) + SIDE_PAD * 2;
  const boardArea = {
    x: sideW,
    y: SIDE_PAD,
    w: SHARE_W - sideW - SIDE_PAD,
    h: SHARE_H - SIDE_PAD * 2,
  };
  const scale = Math.min(boardArea.w / crop.w, boardArea.h / crop.h);
  const dw = crop.w * scale;
  const dh = crop.h * scale;
  const dx = boardArea.x + boardArea.w - dw;
  const dy = boardArea.y + (boardArea.h - dh) / 2;
  ctx.drawImage(board, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);

  const brand = drawBrandMark(ctx, SIDE_PAD, SIDE_PAD);
  drawRankingCard(ctx, rows, labels, SIDE_PAD, brand.y + brand.h + SIDE_GAP);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
  const dataUrl = canvas.toDataURL("image/png");
  return { blob, dataUrl, fileName: "tilecity-ranking.png" };
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

export function downloadBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export { siteUrl, rankingRows };
