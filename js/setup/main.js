import TileCityAudio from "../audio.js";
import Carcassonne from "../game/index.js";
import TileCityI18n from "../i18n.js";

const SETUP_KEY = "tile-city-setup";
const palette = Carcassonne.COLOR_PALETTE;
const min = Carcassonne.PLAYERS_MIN;
const max = Carcassonne.PLAYERS_MAX;
const nameMax = Carcassonne.NAME_MAX;
const strengths = Carcassonne.BOT_STRENGTHS;

function defaultRoster() {
  return Carcassonne.normalizePlayers(
    Carcassonne.PLAYERS.map((player) => ({ id: player.id, name: player.name, bot: false }))
  );
}

function isLegacyColorName(player) {
  const color = palette.find((item) => item.id === player.id);
  if (!color) return false;
  const name = String(player.name || "").trim();
  if (!name) return true;
  if (name.toLowerCase() === color.label.toLowerCase()) return true;
  if (name === color.id) return true;
  const en = TileCityI18n.colorLabel(player.id, "en");
  const ja = TileCityI18n.colorLabel(player.id, "ja");
  return name === en || name === ja;
}

function withPlayerDefaults(list) {
  return list.map((player, index) => {
    if (player.bot || !isLegacyColorName(player)) return player;
    return Object.assign({}, player, { name: Carcassonne.defaultPlayerName(index) });
  });
}

function load() {
  try {
    const raw = sessionStorage.getItem(SETUP_KEY);
    if (raw) return withPlayerDefaults(Carcassonne.normalizePlayers(JSON.parse(raw)));
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

function strengthLabel(id, lang) {
  if (id === "standard") return TileCityI18n.t("botStrengthStandard", lang);
  return id;
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
    const strengthOpts = strengths.map((item) => {
      const selected = (player.botStrength || "standard") === item.id ? " selected" : "";
      return '<option value="' + item.id + '"' + selected + ">" +
        strengthLabel(item.id, lang) + "</option>";
    }).join("");
    return '<li class="player-row' + (player.bot ? " is-bot" : "") + '" data-index="' + index + '">' +
      '<input type="text" maxlength="' + nameMax + '" value="' + player.name.replace(/"/g, "&quot;") +
      '" data-name="' + index + '" aria-label="' + TileCityI18n.t("playerName", lang) + '"' +
      (player.bot ? " readonly tabindex=\"-1\"" : "") + ">" +
      '<div class="player-kind">' +
      '<label class="kind-label">' +
      '<span class="sr-only">' + TileCityI18n.t("playerKind", lang) + "</span>" +
      '<select data-kind="' + index + '" aria-label="' + TileCityI18n.t("playerKind", lang) + '">' +
      '<option value="human"' + (player.bot ? "" : " selected") + ">" +
      TileCityI18n.t("playerKindHuman", lang) + "</option>" +
      '<option value="bot"' + (player.bot ? " selected" : "") + ">" +
      TileCityI18n.t("playerKindBot", lang) + "</option>" +
      "</select></label>" +
      '<label class="strength-label' + (player.bot ? "" : " is-idle") + '">' +
      '<span class="sr-only">' + TileCityI18n.t("botStrength", lang) + "</span>" +
      '<select data-strength="' + index + '" aria-label="' + TileCityI18n.t("botStrength", lang) + '"' +
      (player.bot ? "" : " disabled") + ">" + strengthOpts + "</select></label>" +
      "</div>" +
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
  if (!input || input.readOnly) return;
  const index = Number(input.getAttribute("data-name"));
  if (players[index].bot) return;
  players[index].name = input.value.slice(0, nameMax);
  setErr("");
});

document.getElementById("player-list").addEventListener("change", (event) => {
  const kind = event.target.closest("[data-kind]");
  if (kind) {
    const index = Number(kind.getAttribute("data-kind"));
    const bot = kind.value === "bot";
    const player = players[index];
    if (bot && !player.bot) {
      player.humanName = player.name;
      player.name = Carcassonne.botNameForColor(player.id);
    } else if (!bot && player.bot) {
      const restored = (player.humanName || "").trim().slice(0, nameMax);
      player.name = restored || Carcassonne.nextPlayerName(players);
      player.humanName = null;
    }
    player.bot = bot;
    player.botStrength = bot
      ? Carcassonne.normalizeBotStrength(player.botStrength, true)
      : null;
    setErr("");
    paint();
    return;
  }
  const strength = event.target.closest("[data-strength]");
  if (strength) {
    const index = Number(strength.getAttribute("data-strength"));
    players[index].botStrength = Carcassonne.normalizeBotStrength(strength.value, true);
    setErr("");
  }
});

document.getElementById("player-list").addEventListener("click", (event) => {
  const colorBtn = event.target.closest("[data-color]");
  if (colorBtn && !colorBtn.disabled) {
    const index = Number(colorBtn.getAttribute("data-index"));
    players[index].id = colorBtn.getAttribute("data-color");
    if (players[index].bot) {
      players[index].name = Carcassonne.botNameForColor(players[index].id);
    }
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
    name: Carcassonne.nextPlayerName(players),
    bot: false,
    botStrength: null,
  });
  setErr("");
  paint();
});

document.getElementById("start-game").addEventListener("click", () => {
  const lang = TileCityI18n.getLang();
  const cleaned = [];
  for (const player of players) {
    const name = player.bot
      ? Carcassonne.botNameForColor(player.id)
      : ((player.name || "").trim().slice(0, nameMax) ||
        Carcassonne.nextPlayerName(cleaned));
    cleaned.push({
      id: player.id,
      name: name,
      bot: !!player.bot,
      botStrength: player.bot
        ? Carcassonne.normalizeBotStrength(player.botStrength, true)
        : null,
    });
  }
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
