import TileCityAudio from "./audio.js";
import { monasteryHTML } from "./game/catalog.js";
import TileCityI18n from "./i18n.js";

TileCityI18n.bindLangBar();
TileCityAudio.bindVolumeBar();

document.querySelectorAll(".hero .monastery").forEach((node) => {
  node.outerHTML = monasteryHTML(false);
});
