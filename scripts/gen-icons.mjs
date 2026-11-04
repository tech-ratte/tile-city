/**
 * Render game tiles → icon PNGs at game/rules proportions (--s: 120px).
 * Usage: node scripts/gen-icons.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { monasteryHTML } from "../js/game/catalog.js";
import { tileHTML } from "../js/game/tiles.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "icons");
fs.mkdirSync(outDir, { recursive: true });

const harnessPath = path.join(outDir, "_harness.html");
const cssHref = pathToFileURL(path.join(root, "css", "tiles.css")).href;

fs.writeFileSync(
  harnessPath,
  `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${cssHref}">
<style>
  html, body { margin: 0; background: transparent; }
  .row { display: flex; gap: 64px; padding: 96px; align-items: flex-end; }

  /* Same face size as rules catalog / play board cells. */
  .tile { --s: 120px; }

  /* Monastery alone — room above for the cross. */
  #mono-host {
    position: relative;
    width: 180px;
    height: 180px;
    background: transparent;
    overflow: visible;
  }
  #mono-host .monastery {
    left: 50%;
    top: 55%;
    filter: none !important;
  }

  /* Castle alone — large pad so tower roofs are never clipped. */
  #keep-host {
    position: relative;
    width: 240px;
    height: 240px;
    background: transparent;
    overflow: visible;
  }
  #keep-host .tile {
    position: absolute;
    left: 60px;
    top: 70px;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
  }
  #keep-host .city {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    filter: none !important;
    overflow: visible !important;
  }
  #keep-host .city::before,
  #keep-host .city::after,
  #keep-host .city-pillar,
  #keep-host .pennant {
    display: none !important;
  }
  /* Leave roof drop-shadow as in game; host padding absorbs it. */

  #tile-a .tile { overflow: hidden; }
</style>
</head><body>
  <div class="row">
    <div id="mono-host">${monasteryHTML(false)}</div>
    <div id="keep-host">${tileHTML("C", 0)}</div>
    <div id="tile-a">${tileHTML("A", 0)}</div>
  </div>
</body></html>`,
  "utf8"
);

const DPR = 4;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: DPR });
await page.goto(pathToFileURL(harnessPath).href, { waitUntil: "networkidle" });

function write(file, buf) {
  const dest = path.join(outDir, file);
  fs.writeFileSync(dest, buf);
  console.log("wrote", dest, buf.length);
}

function toDataUrl(buf) {
  return "data:image/png;base64," + Buffer.from(buf).toString("base64");
}

async function shotHost(selector, omitBackground = true) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  return el.screenshot({ type: "png", omitBackground });
}

/** Page clip — includes paint that overflows an element's own box. */
async function shotClip(selector, pad, omitBackground = true) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  const box = await el.boundingBox();
  if (!box) throw new Error("no box " + selector);
  const clip = {
    x: Math.max(0, box.x - pad.left),
    y: Math.max(0, box.y - pad.top),
    width: box.width + pad.left + pad.right,
    height: box.height + pad.top + pad.bottom,
  };
  return page.screenshot({ type: "png", clip, omitBackground });
}

async function fitSquare(srcBuf, size, outName) {
  const file = path.join(outDir, `_fit-${outName}.html`);
  fs.writeFileSync(
    file,
    `<!DOCTYPE html><html><body>
<canvas id="c"></canvas>
<script>
window.__run = (async () => {
  const img = new Image();
  img.src = ${JSON.stringify(toDataUrl(srcBuf))};
  await img.decode();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  pctx.drawImage(img, 0, 0);
  const data = pctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Ignore soft shadow / AA halo so the crop hugs the solid art.
      if (data[(y * w + x) * 4 + 3] >= 48) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) {
    minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
  }
  // 1px fringe — as large as possible without clipping.
  const margin = 1;
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(w - 1, maxX + margin);
  maxY = Math.min(h - 1, maxY + margin);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const pad = 1;
  const out = document.getElementById("c");
  out.width = ${size};
  out.height = ${size};
  const ctx = out.getContext("2d");
  ctx.clearRect(0, 0, ${size}, ${size});
  const scale = Math.min(
    (${size} - pad * 2) / cw,
    (${size} - pad * 2) / ch
  );
  const dw = cw * scale;
  const dh = ch * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img, minX, minY, cw, ch,
    (${size} - dw) / 2, (${size} - dh) / 2, dw, dh
  );
  return out.toDataURL("image/png");
})();
</script></body></html>`,
    "utf8"
  );
  const p = await browser.newPage();
  await p.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  const dataUrl = await p.evaluate(async () => await window.__run);
  await p.close();
  fs.unlinkSync(file);
  write(outName, Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function resizeTile(srcBuf, size, outName) {
  const file = path.join(outDir, `_resize-${outName}.html`);
  fs.writeFileSync(
    file,
    `<!DOCTYPE html><html><body>
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
window.__run = (async () => {
  const img = new Image();
  img.src = ${JSON.stringify(toDataUrl(srcBuf))};
  await img.decode();
  const c = document.getElementById("c");
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, ${size}, ${size});
  return c.toDataURL("image/png");
})();
</script></body></html>`,
    "utf8"
  );
  const p = await browser.newPage();
  await p.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  const dataUrl = await p.evaluate(async () => await window.__run);
  await p.close();
  fs.unlinkSync(file);
  write(outName, Buffer.from(dataUrl.split(",")[1], "base64"));
}

const monoRaw = await shotClip(
  "#mono-host .monastery",
  { top: 28, right: 12, bottom: 8, left: 12 },
  true
);
const castleRaw = await shotClip(
  "#keep-host .city-keep",
  { top: 48, right: 24, bottom: 12, left: 24 },
  true
);
const tileABuf = await shotHost("#tile-a .tile", false);
write("tile-a.png", tileABuf);

await fitSquare(monoRaw, 256, "monastery.png");
await fitSquare(castleRaw, 256, "castle.png");

await fitSquare(castleRaw, 32, "favicon-32.png");
await fitSquare(castleRaw, 48, "favicon-48.png");
await fitSquare(castleRaw, 192, "favicon-192.png");
fs.copyFileSync(path.join(outDir, "favicon-32.png"), path.join(outDir, "favicon.png"));

await resizeTile(tileABuf, 180, "apple-touch-icon.png");
await resizeTile(tileABuf, 192, "icon-192.png");
await resizeTile(tileABuf, 512, "icon-512.png");

{
  const file = path.join(outDir, "_compose-og.html");
  const side = 420;
  fs.writeFileSync(
    file,
    `<!DOCTYPE html><html><head><style>
      html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
      body {
        background:
          radial-gradient(ellipse 70% 50% at 50% 40%, rgba(196,165,116,0.22), transparent 55%),
          #142018;
        color: #f3efe6;
        font-family: Georgia, "Times New Roman", serif;
      }
      .wrap {
        display: flex; align-items: center; height: 630px;
        padding: 0 72px; gap: 56px; box-sizing: border-box;
      }
      .tile { width: ${side}px; height: ${side}px; flex: none; }
      .tile img { width: 100%; height: 100%; object-fit: fill; display: block; }
      h1 { margin: 0; font-size: 72px; font-weight: 700; }
      p {
        margin: 18px 0 0; font-size: 28px;
        font-family: "Segoe UI", sans-serif; opacity: 0.72; font-weight: 500;
      }
    </style></head><body>
      <div class="wrap">
        <div class="tile"><img src="${toDataUrl(tileABuf)}" alt=""></div>
        <div>
          <h1>TileCity</h1>
          <p>Roads · Cities · Monasteries</p>
        </div>
      </div>
    </body></html>`,
    "utf8"
  );
  const p = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1200, height: 630 },
  });
  await p.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  const buf = await p.screenshot({ type: "png" });
  await p.close();
  fs.unlinkSync(file);
  fs.writeFileSync(path.join(root, "assets", "og.png"), buf);
  console.log("wrote", path.join(root, "assets", "og.png"), buf.length);
}

await browser.close();
fs.unlinkSync(harnessPath);
console.log("done");
