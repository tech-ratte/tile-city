import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mainPath = path.join(root, "js", "play", "main.js");
let src = fs.readFileSync(mainPath, "utf8");

// Strip header imports for reassembly later
src = src.replace(/^import Carcassonne from "\.\.\/game\/index\.js";\r?\nimport TileCityI18n from "\.\.\/i18n\.js";\r?\n\r?\n/, "");

function cutFunction(name) {
  const re = new RegExp(`\\n    function ${name}\\(`);
  const m = src.match(re);
  if (!m) throw new Error("missing function " + name);
  const start = m.index + 1; // keep leading newline out
  // find matching brace from first {
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const end = i + 1;
        const block = src.slice(start, end);
        src = src.slice(0, start) + src.slice(end);
        return block.replace(/^    /gm, "");
      }
    }
  }
  throw new Error("unclosed " + name);
}

const storageFns = [
  "loadRoster", "clearSave", "readSave", "loadSavedGame", "persistGame", "restoreView",
].map(cutFunction);

const viewFns = [
  "zoomPercent", "applyBoardZoom", "gridPadBox", "scroller", "centerBoard",
  "mapZoomCoord", "setBoardZoom", "captureAnchor", "centerOn", "restoreAnchor",
  "showGhost", "rotateClockwise",
].map((name) => {
  try { return cutFunction(name); }
  catch (err) { return null; }
}).filter(Boolean);

// Some names may differ — detect available
const available = [...src.matchAll(/\\n    function ([A-Za-z0-9_]+)\\(/g)].map((m) => m[1]);
console.log("remaining functions sample", available.slice(0, 20));

fs.writeFileSync(path.join(root, "js", "play", "_after_cut.js"), src);
fs.writeFileSync(path.join(root, "js", "play", "storage.partial.js"), storageFns.join("\n\n"));
fs.writeFileSync(path.join(root, "js", "play", "view.partial.js"), viewFns.join("\n\n"));
console.log("partials written; remaining main", src.length);
