import TileCityAudio from "./audio.js";
import { MARKUP } from "./game/catalog.js";
import TileCityI18n from "./i18n.js";

TileCityI18n.bindLangBar();
TileCityAudio.bindVolumeBar();

/** Keep rules catalog tiles identical to in-game MARKUP. */
document.querySelectorAll(".tile[data-id]").forEach((tile) => {
  const id = tile.getAttribute("data-id");
  if (id && MARKUP[id]) tile.innerHTML = MARKUP[id];
});
