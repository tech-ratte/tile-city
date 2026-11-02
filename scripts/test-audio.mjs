import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function startServer(mp3DelayMs) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/scripts/audio-harness.html" : urlPath;
      const filePath = path.normalize(path.join(root, rel));
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("not found: " + rel);
          return;
        }
        const send = () => {
          res.writeHead(200, { "Content-Type": contentType(filePath) });
          res.end(data);
        };
        if (mp3DelayMs > 0 && filePath.endsWith(".mp3")) {
          setTimeout(send, mp3DelayMs);
          return;
        }
        send();
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function summarize(list) {
  const ok = list.filter((x) => x.ok).length;
  const fail = list.length - ok;
  const names = {};
  for (const item of list) {
    if (item.ok) continue;
    const key = item.name || item.reason || "unknown";
    names[key] = (names[key] || 0) + 1;
  }
  return { total: list.length, ok, fail, failNames: names };
}

async function runDelayedHtmlCase(page) {
  // Old production pattern: new Audio(src); audio.play() inside setTimeout (bot).
  // With slow MP3 responses this races and rejects / never starts reliably.
  return page.evaluate(async () => {
    const src = "assets/sound/tile.mp3";
    const results = [];
    for (let i = 0; i < 20; i++) {
      results.push(
        await new Promise((resolve) => {
          setTimeout(() => {
            try {
              const audio = new Audio(src);
              audio.volume = 0.01;
              // Mirror old audio.js: fire-and-forget play with empty catch.
              const p = audio.play();
              if (!p || !p.then) {
                resolve({ ok: false, name: "NoPromise" });
                return;
              }
              p.then(
                () => resolve({ ok: true }),
                (err) => resolve({ ok: false, name: err && err.name, message: String(err && err.message || err) })
              );
            } catch (err) {
              resolve({ ok: false, name: "Throw", message: String(err) });
            }
          }, 30);
        })
      );
    }
    return results;
  });
}

async function runBotStyleWebCase(page) {
  // New path: unlock once, then bot-like delayed plays via TileCityAudio.
  return page.evaluate(async () => {
    const results = [];
    for (let i = 0; i < 20; i++) {
      results.push(
        await new Promise((resolve) => {
          setTimeout(() => {
            window.TileCityAudio.playSoundAsync("tile")
              .then((info) => {
                resolve({
                  ok: !!(info && info.ok && info.mode === "web-audio"),
                  name: info && info.ok ? undefined : (info && info.reason) || "web-fail",
                  mode: info && info.mode,
                  ctxState: info && info.ctxState,
                });
              })
              .catch((err) => resolve({ ok: false, name: "Throw", message: String(err) }));
          }, 30);
        })
      );
    }
    return results;
  });
}

async function runOverlapAbortCase(page) {
  // Classic HTMLMediaElement failure: start play, then immediately reassign src
  // (or create competing loads). Old code avoided shared elements but still hit
  // AbortError when the browser cancelled a not-yet-started play under load.
  return page.evaluate(async () => {
    const src = "assets/sound/tile.mp3";
    const results = [];
    for (let i = 0; i < 20; i++) {
      results.push(
        await new Promise((resolve) => {
          setTimeout(() => {
            const audio = new Audio();
            audio.volume = 0.01;
            audio.src = src;
            const p = audio.play();
            // Interrupt like a rapid re-render / second SFX path.
            audio.src = src;
            p.then(
              () => resolve({ ok: true }),
              (err) => resolve({ ok: false, name: err && err.name, message: String(err && err.message || err) })
            );
          }, 0);
        })
      );
    }
    return results;
  });
}

const MP3_DELAY_MS = 120;
const { server, port } = await startServer(MP3_DELAY_MS);
const browser = await chromium.launch({
  headless: true,
  args: [
    "--autoplay-policy=document-user-activation-required",
    "--disable-features=AutoplayIgnoreWebAudio",
  ],
});

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/scripts/audio-harness.html`, {
    waitUntil: "networkidle",
  });

  // Expose module API on window for bot-style case.
  await page.evaluate(async () => {
    const mod = await import("/js/audio.js");
    window.TileCityAudio = mod.default || mod.TileCityAudio || window.TileCityAudio;
    window.__audioUnlockedForTest = false;
    document.getElementById("unlock").onclick = async () => {
      window.TileCityAudio.setVolume(0.05);
      window.TileCityAudio.unlockAudio();
      // Must play inside the user-gesture stack so AudioContext can run.
      await window.TileCityAudio.playSoundAsync("tile");
      await window.TileCityAudio.playSoundAsync("point");
      await window.TileCityAudio.playSoundAsync("clear");
      window.__audioUnlockedForTest = true;
    };
  });

  await page.click("#unlock");
  await page.waitForFunction(() => window.__audioUnlockedForTest === true);

  const htmlDelayed = summarize(await runDelayedHtmlCase(page));
  const webBot = summarize(await runBotStyleWebCase(page));
  const htmlAbort = summarize(await runOverlapAbortCase(page));
  const debug = await page.evaluate(() => window.TileCityAudio.getAudioDebugState());

  const report = {
    mp3DelayMs: MP3_DELAY_MS,
    oldHtmlTimerAfterUnlock: htmlDelayed,
    newWebBotTimerAfterUnlock: webBot,
    oldHtmlAbortInterrupt: htmlAbort,
    debug,
  };

  console.log("\n=== Bot-audio reliability (slow MP3 = " + MP3_DELAY_MS + "ms) ===");
  console.log(
    `old HTMLAudio + setTimeout: ok=${htmlDelayed.ok}/${htmlDelayed.total} fail=${htmlDelayed.fail}` +
      (htmlDelayed.fail ? ` ${JSON.stringify(htmlDelayed.failNames)}` : "")
  );
  console.log(
    `new WebAudio + setTimeout:  ok=${webBot.ok}/${webBot.total} fail=${webBot.fail}` +
      (webBot.fail ? ` ${JSON.stringify(webBot.failNames)}` : "")
  );
  console.log(
    `old HTMLAudio abort race:   ok=${htmlAbort.ok}/${htmlAbort.total} fail=${htmlAbort.fail}` +
      (htmlAbort.fail ? ` ${JSON.stringify(htmlAbort.failNames)}` : "")
  );
  console.log("debug:", debug);

  // Pass if new path is perfect after unlock, and we demonstrated at least one
  // old-path failure mode OR new path is strictly >= old path with 0 failures.
  const improved =
    webBot.fail === 0 &&
    debug.ctxState === "running" &&
    debug.bufferCount >= 1 &&
    (htmlDelayed.fail > 0 || htmlAbort.fail > 0 || webBot.ok >= htmlDelayed.ok);

  report.pass = improved;
  console.log("PASS:", report.pass);

  if (!report.pass) {
    console.error("\nAudio reliability check FAILED");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } else {
    console.log("\nAudio reliability check PASSED");
    if (htmlDelayed.fail > 0 || htmlAbort.fail > 0) {
      console.log("Old HTMLAudio path showed failures; new WebAudio path had 0.");
    } else {
      console.log("New WebAudio path stayed at 0 failures under bot-timer load.");
    }
  }
} finally {
  await browser.close();
  server.close();
}
