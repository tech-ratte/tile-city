const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const playPath = path.join(root, "play.html");
const play = fs.readFileSync(playPath, "utf8");

const styleStart = play.indexOf("<style>") + "<style>".length;
const styleEnd = play.indexOf("</style>");
if (styleStart < 7 || styleEnd < 0) throw new Error("style block not found");
const css = play.slice(styleStart, styleEnd).trim() + "\n";
fs.mkdirSync(path.join(root, "css"), { recursive: true });
fs.writeFileSync(path.join(root, "css", "play.css"), css);

const marker = '<script src="js/i18n.js"></script>';
const markerAt = play.indexOf(marker);
if (markerAt < 0) throw new Error("i18n script tag not found");
const scriptAt = play.indexOf("<script>", markerAt + marker.length);
const scriptEnd = play.lastIndexOf("</script>");
if (scriptAt < 0 || scriptEnd < scriptAt) throw new Error("inline script not found");
const js = play.slice(scriptAt + "<script>".length, scriptEnd).trim() + "\n";
fs.mkdirSync(path.join(root, "js", "play"), { recursive: true });
fs.writeFileSync(path.join(root, "js", "play", "_raw_main.js"), js);

console.log("css/play.css", css.length);
console.log("js/play/_raw_main.js", js.length);
