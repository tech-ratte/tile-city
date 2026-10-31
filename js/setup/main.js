import TileCityAudio from "../audio.js";
import Carcassonne from "../game/index.js";
import TileCityI18n from "../i18n.js";

const SETUP_KEY = "tile-city-setup";
const palette = Carcassonne.COLOR_PALETTE;
const min = Carcassonne.PLAYERS_MIN;
const max = Carcassonne.PLAYERS_MAX;
const nameMax = Carcassonne.NAME_MAX;

function defaultRoster() {
  return Carcassonne.PLAYERS.map((player) => ({ id: player.id, name: player.name }));
}

function load() {
  try {
    const raw = sessionStorage.getItem(SETUP_KEY);
    if (raw) return Carcassonne.normalizePlayers(JSON.parse(raw));
  } catch (err) {}
  return defaultRoster();
}

let players = load();

function usedColors(exceptIndex) {
  const used = new Set();
  players.forEach((player, index) => {
    if (index === exceptIndex) return;
    used.add(player.id);
  });
  return used;
}

function nextFreeColor() {
  const used = usedColors(-1);
  return palette.find((color) => !used.has(color.id));
}

function setErr(msg) {
  document.getElementById("err").textContent = msg || "";
}

function paint() {
  const list = document.getElementById("player-list");
  const canRemove = players.length > min;
  const lang = TileCityI18n.getLang();
  list.innerHTML = players.map((player, index) => {
    const used = usedColors(index);
    const swatches = palette.map((color) => {
      const taken = used.has(color.id);
      const on = color.id === player.id ? " on" : "";
      const disabled = taken && color.id !== player.id ? " disabled" : "";
      return '<button type="button" class="' + on.trim() + '" data-color="' + color.id +
        '" data-index="' + index + '" style="--swatch:' + color.hex + '"' + disabled +
        ' aria-label="' + TileCityI18n.colorLabel(color.id, lang) + '"></button>';
    }).join("");
    return '<li class="player-row" data-index="' + index + '">' +
      '<input type="text" maxlength="' + nameMax + '" value="' + player.name.replace(/"/g, "&quot;") +
      '" data-name="' + index + '" aria-label="' + TileCityI18n.t("playerName", lang) + '">' +
      '<div class="color-picks">' + swatches + "</div>" +
      '<button type="button" class="remove-player" data-remove="' + index + '"' +
      (canRemove ? "" : " disabled") + ' aria-label="' + TileCityI18n.t("removePlayer", lang) +
      '">×</button></li>';
  }).join("");
  document.getElementById("add-player").disabled = players.length >= max || !nextFreeColor();
  document.getElementById("count-hint").textContent =
    TileCityI18n.t("playersCount", lang, { n: players.length, max: max });
}

document.getElementById("player-list").addEventListener("input", (event) => {
  const input = event.target.closest("[data-name]");
  if (!input) return;
  const index = Number(input.getAttribute("data-name"));
  players[index].name = input.value.slice(0, nameMax);
  setErr("");
});

document.getElementById("player-list").addEventListener("click", (event) => {
  const colorBtn = event.target.closest("[data-color]");
  if (colorBtn && !colorBtn.disabled) {
    const index = Number(colorBtn.getAttribute("data-index"));
    players[index].id = colorBtn.getAttribute("data-color");
    setErr("");
    paint();
    return;
  }
  const remove = event.target.closest("[data-remove]");
  if (remove && !remove.disabled) {
    players.splice(Number(remove.getAttribute("data-remove")), 1);
    setErr("");
    paint();
  }
});

document.getElementById("add-player").addEventListener("click", () => {
  if (players.length >= max) return;
  const color = nextFreeColor();
  if (!color) return;
  players.push({
    id: color.id,
    name: TileCityI18n.colorLabel(color.id).slice(0, nameMax),
  });
  setErr("");
  paint();
});

document.getElementById("start-game").addEventListener("click", () => {
  const lang = TileCityI18n.getLang();
  const cleaned = players.map((player) => ({
    id: player.id,
    name: (player.name || "").trim().slice(0, nameMax) ||
      TileCityI18n.colorLabel(player.id, lang).slice(0, nameMax),
  }));
  const ids = cleaned.map((player) => player.id);
  if (cleaned.length < min || cleaned.length > max) {
    setErr(TileCityI18n.t("errNeedPlayers", lang, { min: min, max: max }));
    return;
  }
  if (new Set(ids).size !== ids.length) {
    setErr(TileCityI18n.t("errUniqueColor", lang));
    return;
  }
  try {
    localStorage.removeItem("tile-city-save");
  } catch (err) {}
  sessionStorage.setItem(SETUP_KEY, JSON.stringify(cleaned));
  location.href = "play.html";
});

TileCityI18n.bindLangBar(() => {
  setErr("");
  paint();
});
TileCityAudio.bindVolumeBar();
paint();
