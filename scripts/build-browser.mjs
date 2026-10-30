import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args) {
  const result = spawnSync("npx", ["--yes", "esbuild", ...args], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

const jobs = [
  ["js/game/index.js", "--bundle", "--format=iife", "--global-name=Carcassonne", "--outfile=js/carcassonne.iife.js"],
  ["js/i18n.js", "--bundle", "--format=iife", "--global-name=TileCityI18n", "--outfile=js/i18n.iife.js"],
  ["js/play/main.js", "--bundle", "--format=iife", "--outfile=js/play.bundle.js"],
  ["js/setup/main.js", "--bundle", "--format=iife", "--outfile=js/setup.bundle.js"],
  ["js/home.js", "--bundle", "--format=iife", "--outfile=js/home.bundle.js"],
  ["js/rules.js", "--bundle", "--format=iife", "--outfile=js/rules.bundle.js"],
];

for (const args of jobs) run(args);
console.log("browser bundles ready");
