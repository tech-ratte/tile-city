import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js", "game.js"), "utf8");

// Extract factory body between `function () {` after factory and final `return {`
const factoryStart = src.indexOf("}, function () {") + "}, function () {".length;
const returnAt = src.lastIndexOf("\n  return {");
if (factoryStart < 0 || returnAt < 0) throw new Error("cannot locate factory body");
const body = src.slice(factoryStart, returnAt);
const returnBlock = src.slice(returnAt, src.lastIndexOf("});") + 1);

const outDir = path.join(root, "js", "game");
fs.mkdirSync(outDir, { recursive: true });

// Save full body for reference during manual module authoring verification
fs.writeFileSync(path.join(outDir, "_body.js"), body);
fs.writeFileSync(path.join(outDir, "_return.js"), returnBlock);
console.log("body lines", body.split("\n").length);
console.log("wrote js/game/_body.js for splitting");
