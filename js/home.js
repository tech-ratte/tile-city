import TileCityAudio from "./audio.js";
import { tileHTML } from "./game/tiles.js";
import TileCityI18n from "./i18n.js";

TileCityI18n.bindLangBar();
TileCityAudio.bindVolumeBar();

document.querySelectorAll(".tile-spin").forEach((btn) => {
  const id = btn.getAttribute("data-tile");
  if (!id) return;
  let rot = 0;

  function paint() {
    btn.innerHTML = tileHTML(id, rot);
  }

  paint();
  btn.addEventListener("click", () => {
    rot = (rot + 1) % 4;
    paint();
  });
});
