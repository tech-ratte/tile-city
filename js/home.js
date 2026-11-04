import TileCityAudio from "./audio.js";
import { tileHTML } from "./game/tiles.js";
import TileCityI18n from "./i18n.js";

TileCityI18n.bindLangBar();
TileCityAudio.bindVolumeBar();

document.querySelectorAll(".tile-spin").forEach((btn) => {
  const id = btn.getAttribute("data-tile");
  if (!id) return;
  let rot = 0;
  let suppressClickUntil = 0;

  function paint() {
    btn.innerHTML = tileHTML(id, rot);
  }

  function rotate() {
    rot = (rot + 1) % 4;
    paint();
  }

  paint();

  // Match play: rotate on pointerdown for touch/pen so taps stay snappy and
  // iOS does not fall through to double-tap zoom while waiting on click.
  btn.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (!event.isPrimary) return;
    if (event.button !== 0 && event.button !== -1) return;
    event.preventDefault();
    rotate();
    suppressClickUntil = Date.now() + 700;
  });

  btn.addEventListener("click", () => {
    if (Date.now() < suppressClickUntil) return;
    rotate();
  });
});
