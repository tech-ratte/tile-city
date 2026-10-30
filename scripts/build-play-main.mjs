import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const raw = fs.readFileSync(path.join(root, "js", "play", "_raw_main.js"), "utf8");

// Replace global Carcassonne / TileCityI18n usages: keep as-is after importing defaults onto locals.
const header = `import Carcassonne from "../game/index.js";
import TileCityI18n from "../i18n.js";

`;

const body = raw
  .replace(/^\\s*const t = \\(key\\) => TileCityI18n\\.t\\(key\\);/m, "const t = (key) => TileCityI18n.t(key);");

fs.writeFileSync(path.join(root, "js", "play", "main.js"), header + body);
console.log("wrote js/play/main.js", header.length + body.length);

// Slim play.html
let play = fs.readFileSync(path.join(root, "play.html"), "utf8");
const styleStart = play.indexOf("<style>");
const styleEnd = play.indexOf("</style>") + "</style>".length;
play = play.slice(0, styleStart) +
  '<link rel="stylesheet" href="css/play.css">\n' +
  play.slice(styleEnd);

const scriptsStart = play.indexOf('<script src="js/game.js"></script>');
const scriptsEnd = play.lastIndexOf("</script>") + "</script>".length;
play = play.slice(0, scriptsStart) +
  '<script type="module" src="js/play/main.js"></script>\n' +
  play.slice(scriptsEnd);

fs.writeFileSync(path.join(root, "play.html"), play);
console.log("updated play.html", play.length);
