import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Dedent play/main.js body (was nested in HTML <script>)
const playMainPath = path.join(root, "js", "play", "main.js");
const playMain = fs.readFileSync(playMainPath, "utf8");
const [header, ...rest] = playMain.split("\n");
const headerLines = [];
let i = 0;
const lines = playMain.split("\n");
while (i < lines.length && (lines[i].startsWith("import ") || lines[i] === "")) {
  headerLines.push(lines[i]);
  i++;
}
const body = lines.slice(i).map((line) => (line.startsWith("    ") ? line.slice(4) : line)).join("\n");
fs.writeFileSync(playMainPath, headerLines.join("\n") + "\n" + body.replace(/\n+$/, "\n"));
console.log("dedented play/main.js");

// Extract setup
const setupHtmlPath = path.join(root, "setup.html");
let setupHtml = fs.readFileSync(setupHtmlPath, "utf8");
const setupScriptStart = setupHtml.indexOf("<script src=\"js/game.js\"></script>");
const setupInlineStart = setupHtml.indexOf("<script>", setupScriptStart);
const setupInlineEnd = setupHtml.lastIndexOf("</script>");
const setupJs = setupHtml
  .slice(setupInlineStart + "<script>".length, setupInlineEnd)
  .trim()
  .replace(/^    /gm, "");

fs.mkdirSync(path.join(root, "js", "setup"), { recursive: true });
fs.writeFileSync(
  path.join(root, "js", "setup", "main.js"),
  `import Carcassonne from "../game/index.js";\nimport TileCityI18n from "../i18n.js";\n\n${setupJs}\n`
);

setupHtml =
  setupHtml.slice(0, setupScriptStart) +
  '<script type="module" src="js/setup/main.js"></script>\n' +
  setupHtml.slice(setupInlineEnd + "</script>".length);
fs.writeFileSync(setupHtmlPath, setupHtml);
console.log("extracted setup");

// index.html
let indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
indexHtml = indexHtml
  .replace(/<script src="js\/i18n\.js"><\/script>\s*<script>[\s\S]*?<\/script>/, '<script type="module" src="js/home.js"></script>');
fs.writeFileSync(path.join(root, "index.html"), indexHtml);
fs.writeFileSync(
  path.join(root, "js", "home.js"),
  `import TileCityI18n from "./i18n.js";\n\nTileCityI18n.bindLangBar();\n`
);
console.log("updated index");

// tiles.html
let tilesHtml = fs.readFileSync(path.join(root, "tiles.html"), "utf8");
tilesHtml = tilesHtml.replace(
  /<script src="js\/i18n\.js"><\/script>\s*<script>\s*TileCityI18n\.bindLangBar\(\);\s*<\/script>/,
  '<script type="module" src="js/rules.js"></script>'
);
fs.writeFileSync(path.join(root, "tiles.html"), tilesHtml);
fs.writeFileSync(
  path.join(root, "js", "rules.js"),
  `import TileCityI18n from "./i18n.js";\n\nTileCityI18n.bindLangBar();\n`
);
console.log("updated tiles");

// Cleanup generated temps
const temps = [
  "js/game/_body.js",
  "js/game/_return.js",
  "js/game/_symbols.json",
  "js/game/constants.raw.js",
  "js/game/catalog.raw.js",
  "js/game/tiles.raw.js",
  "js/game/board.raw.js",
  "js/game/features.raw.js",
  "js/game/scoring.raw.js",
  "js/game/engine.raw.js",
  "js/game/persist.raw.js",
  "js/play/_raw_main.js",
  "js/game-global.js",
];
for (const rel of temps) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log("cleaned temps");
