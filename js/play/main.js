import TileCityAudio from "../audio.js";
import Carcassonne from "../game/index.js";
import TileCityI18n from "../i18n.js";
import {
  clearSave,
  loadRoster as loadRosterFromStorage,
  loadSavedGame as loadSavedGameFromStorage,
  writeSave,
} from "./storage.js";

const t = (key) => TileCityI18n.t(key);
const playSound = (name) => TileCityAudio.playSound(name);
const playMeepleSound = (color) => TileCityAudio.playMeepleSound(color);

function scoresGained(before) {
  return game.scores.some((score, index) => score > (before[index] || 0));
}
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.05;
const ZOOM_WHEEL = 0.025;
const LEAVE_FX_MS = 2000;
const BOT_MOVE_MS = 450;
const BOT_MEEPLE_MS = 380;
const BOT_DISCARD_MS = 550;
const BOT_CENTER_MS = 1000;
const TILE_TOTAL = Carcassonne.TYPES.reduce((sum, type) => sum + type.count, 0);
let exitConfirmOpen = false;
let leaveFxTimer = null;
let endFanfareStarted = false;
let botTimer = null;
let botBusy = false;
let centerAnim = null;
let centerAnimDone = null;

function loadRoster() {
  return loadRosterFromStorage(Carcassonne);
}

function loadSavedGame() {
  return loadSavedGameFromStorage(Carcassonne);
}

let readyToPersist = false;

function persistGame() {
  const box = document.getElementById("scroller");
  writeSave(Carcassonne, game, {
    zoom: boardZoom,
    left: box ? box.scrollLeft : 0,
    top: box ? box.scrollTop : 0,
  }, readyToPersist);
}

function restoreView(view) {
  if (!view) return;
  const zoom = Number(view.zoom);
  if (Number.isFinite(zoom)) {
    boardZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    applyBoardZoom();
    syncBoardPadding();
  }
  const box = scroller();
  const left = Number(view.left);
  const top = Number(view.top);
  requestAnimationFrame(() => {
    void document.getElementById("grid").offsetWidth;
    if (Number.isFinite(left)) box.scrollLeft = left;
    if (Number.isFinite(top)) box.scrollTop = top;
    persistGame();
  });
}

const saved = loadSavedGame();
const roster = loadRoster();
if (!saved && !roster) {
  location.replace("setup.html");
  throw new Error("setup required");
}
let game = saved ? saved.game : Carcassonne.createGame(undefined, roster);
let pan = null;
let skipClick = false;
/** Suppress hand rotate/set-rot clicks until this time (touch pointerdown already rotated). */
let suppressHandClickUntil = 0;
let boardZoom = 0.8;
endFanfareStarted = !!game.finished;
window.__game = game;

function zoomPercent() {
  return Math.round(boardZoom * 100) + "%";
}

function applyBoardZoom() {
  document.documentElement.style.setProperty("--board-zoom", String(boardZoom));
  const label = document.getElementById("zoom-label");
  if (label) label.textContent = zoomPercent();
}

function gridPadBox(grid) {
  const style = getComputedStyle(grid);
  const left = parseFloat(style.paddingLeft) || 0;
  const top = parseFloat(style.paddingTop) || 0;
  const right = parseFloat(style.paddingRight) || 0;
  const bottom = parseFloat(style.paddingBottom) || 0;
  return {
    left,
    top,
    right,
    bottom,
    innerW: Math.max(0, grid.offsetWidth - left - right),
    innerH: Math.max(0, grid.offsetHeight - top - bottom),
  };
}

// Keep one full scroller viewport of pad on each side so any tile can sit
// anywhere in view, and zoom-out never runs out of scroll range mid-gesture.
function syncBoardPadding() {
  const box = scroller();
  const grid = document.getElementById("grid");
  const padX = Math.max(1, Math.ceil(box.clientWidth));
  const padY = Math.max(1, Math.ceil(box.clientHeight));
  const before = gridPadBox(grid);
  if (before.left === padX && before.right === padX && before.top === padY && before.bottom === padY) {
    return;
  }
  const midX = box.scrollLeft + box.clientWidth / 2;
  const midY = box.scrollTop + box.clientHeight / 2;
  const boardX = midX - before.left;
  const boardY = midY - before.top;
  grid.style.padding = padY + "px " + padX + "px";
  void grid.offsetWidth;
  box.scrollLeft = padX + boardX - box.clientWidth / 2;
  box.scrollTop = padY + boardY - box.clientHeight / 2;
}

// Padding stays fixed; only the tile grid scales with zoom.
function mapZoomCoord(coord, padBefore, innerBefore, padAfter, innerAfter) {
  if (coord <= padBefore) return padAfter + (coord - padBefore);
  if (coord >= padBefore + innerBefore) {
    return padAfter + innerAfter + (coord - padBefore - innerBefore);
  }
  if (!(innerBefore > 0)) return padAfter;
  return padAfter + (coord - padBefore) * (innerAfter / innerBefore);
}

function setBoardZoom(next, pivot) {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 1000) / 1000));
  if (clamped === boardZoom) {
    applyBoardZoom();
    return;
  }
  const box = scroller();
  const grid = document.getElementById("grid");
  syncBoardPadding();
  const rect = box.getBoundingClientRect();
  const px = pivot ? pivot.x - rect.left : rect.width / 2;
  const py = pivot ? pivot.y - rect.top : rect.height / 2;
  const beforePad = gridPadBox(grid);
  const contentX = box.scrollLeft + px;
  const contentY = box.scrollTop + py;
  boardZoom = clamped;
  applyBoardZoom();
  // Flush layout before reading new size / setting scroll.
  void grid.offsetWidth;
  const afterPad = gridPadBox(grid);
  box.scrollLeft = mapZoomCoord(
    contentX, beforePad.left, beforePad.innerW, afterPad.left, afterPad.innerW
  ) - px;
  box.scrollTop = mapZoomCoord(
    contentY, beforePad.top, beforePad.innerH, afterPad.top, afterPad.innerH
  ) - py;
  persistGame();
}

function paintLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML =
    '<div class="hint-legend">' +
    '<p><i class="swatch-key now"></i>' + t("canPlace") + "</p>" +
    '<p><i class="swatch-key later"></i>' + t("needsRotate") + "</p>" +
    '<div class="zoom-controls">' +
    '<button type="button" class="zoom-btn" id="zoom-out" aria-label="' + t("zoomOut") + '">−</button>' +
    '<span class="zoom-label" id="zoom-label">' + zoomPercent() + "</span>" +
    '<button type="button" class="zoom-btn" id="zoom-in" aria-label="' + t("zoomIn") + '">+</button>' +
    "</div></div>" +
    '<p class="rot-hint">' + t("rotHint") + "</p>";
}

function activeSeat() {
  if (game.pendingMeeple) return game.pendingMeeple.player;
  return game.player;
}

function isBotSeat(index) {
  return Carcassonne.isBotPlayer(game.players[index]);
}

function isBotTurn() {
  if (game.finished || exitConfirmOpen) return false;
  return isBotSeat(activeSeat());
}

function humanControlsLocked() {
  return isBotTurn() || botBusy;
}

function displayPlayerName(player) {
  if (player.bot) return Carcassonne.botNameForColor(player.id, TileCityI18n.getLang());
  return player.name;
}

function botBadgeHTML() {
  return '<span class="bot-badge" title="' + t("botThinking") + '" aria-label="' + t("playerKindBot") + '">' +
    '<svg class="bot-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M9 3h6v2h3a2 2 0 0 1 2 2v5h-2V7H6v5H4V7a2 2 0 0 1 2-2h3V3zm-3 9h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2h2v2h-2V2z"/>' +
    "</svg></span>";
}

function playersHTML() {
  const order = game.finished && game.standings
    ? game.standings
    : game.players.map((_, index) => index);
  return '<ul class="players">' + order.map((index) => {
    const player = game.players[index];
    const on = !game.finished && index === game.player ? " on" : "";
    const rank = game.finished ? '<span class="rank">' + (order.indexOf(index) + 1) + "</span>" : "";
    const bot = player.bot ? botBadgeHTML() : "";
    return '<li class="' + player.id + on + (player.bot ? " bot" : "") + '">' +
      rank +
      '<span class="pname">' + displayPlayerName(player) + bot + "</span>" +
      '<span class="meeple-count"><i class="meeple ' + player.id + '" aria-hidden="true"></i>×' +
      game.meeples[index] + "</span>" +
      '<b class="score">' + game.scores[index] + "</b>" +
      "</li>";
  }).join("") + "</ul>";
}

function endActionsHTML(layout) {
  if (layout === "row") {
    return '<button type="button" class="quit-chip js-quit">' + t("home") + "</button>" +
      '<button type="button" class="ranking-chip js-open-ranking">' + t("rank") + "</button>" +
      '<button type="button" class="again-chip js-again">' + t("again") + "</button>";
  }
  return '<button type="button" class="ranking-chip js-open-ranking">' + t("rank") + "</button>" +
    '<div class="end-actions">' +
    '<button type="button" class="quit-chip js-quit">' + t("home") + "</button>" +
    '<button type="button" class="again-chip js-again">' + t("again") + "</button></div>";
}

function statsHTML() {
  const exitTop = game.finished
    ? ""
    : '<button type="button" class="exit-chip js-exit">' + t("exit") + "</button>";
  return '<div class="meters"><div><span>' + t("deck") + "</span><b>" + game.deck.length +
    '</b></div><div><span>' + t("board") + "</span><b>" + game.board.size +
    '</b></div><div><span>' + t("discards") + "</span><b>" + game.discards.length +
    '</b></div></div><div class="hud-meta">' + exitTop +
    '<div class="deck-short">' +
    '<span class="deck-chip">' + t("deck") + " " + game.deck.length + "</span>" +
    '<span class="deck-chip">' + t("board") + " " + game.board.size + "/" + TILE_TOTAL + "</span>" +
    '<span class="deck-chip">' + t("discards") + " " + game.discards.length + "</span></div></div>";
}

function handHTML() {
  if (game.finished) {
    if (!game.rankingOpen) {
      return '<div class="hand ranking-hand">' + endActionsHTML("row") + "</div>";
    }
    return "";
  }
  if (!game.current) return "";
  if (game.pendingDiscard) {
    return '<div class="hand discard-only">' +
      '<div class="preview" aria-label="' + t("unplaceableTile") + '">' +
      '<span class="preview-frame">' + Carcassonne.tileHTML(game.current.id, 0) +
      "</span></div></div>";
  }
  if (humanControlsLocked()) {
    return '<div class="hand bot-hand">' +
      '<div class="preview" aria-label="' + t("botThinking") + '">' +
      '<span class="preview-frame">' + Carcassonne.tileHTML(game.current.id, game.rotation) +
      '</span></div><p class="bot-status">' + t("botThinking") + "</p></div>";
  }
  const counts = game.rotationCounts();
  const thumbs = [0, 1, 2, 3].map((rot) => {
    const on = rot === game.rotation ? " on" : "";
    const able = counts[rot] ? " able" : "";
    return '<button type="button" class="thumb' + on + able + '" data-set-rot="' + rot +
      '" aria-pressed="' + (rot === game.rotation) + '"><span class="mini"><span class="scaler">' +
      Carcassonne.tileHTML(game.current.id, rot) + '</span></span><span class="deg">' +
      (rot * 90) + "°</span></button>";
  }).join("");
  return '<div class="hand"><button type="button" class="preview" data-rotate="1" aria-label="' +
    t("rotateTile") + '">' +
    '<span class="preview-frame">' + Carcassonne.tileHTML(game.current.id, game.rotation) +
    "</span></button>" +
    '<div class="rots">' + thumbs + "</div></div>";
}

function footHTML() {
  if (game.finished && !game.rankingOpen) return endActionsHTML("stack");
  if (game.finished) return "";
  return '<button type="button" class="exit-chip js-exit">' + t("exit") + "</button>";
}

function meeplePinHTML(pin, leaving) {
  const fieldClass = pin.kind === "field" ? " field-meeple" : "";
  const earned = pin.earned
    ? '<span class="meeple-earned">+' + pin.earned + "</span>"
    : "";
  let style = "left:" + (pin.x * 100) + "%;top:" + (pin.y * 100) + "%";
  // Grid rebuilds (rotate etc.) remount pins — negative delay continues the leave anim.
  if (leaving && pin.at) {
    const ageSec = Math.max(0, (Date.now() - pin.at) / 1000);
    style += ";--leave-age:-" + ageSec + "s";
  }
  return '<span class="meeple-pin' + (leaving ? " leaving" : "") +
    '" style="' + style + '">' +
    '<i class="meeple on-tile ' + pin.color + fieldClass + '" aria-hidden="true"></i>' +
    earned + "</span>";
}

function meepleMarksHTML(tile, pending) {
  const marks = [];
  if (tile.meeple) marks.push(meeplePinHTML(tile.meeple, false));
  if (tile.leaveFx) marks.push(meeplePinHTML(tile.leaveFx, true));
  if (!pending) return marks.join("");
  if (humanControlsLocked()) {
    marks.push('<div class="meeple-layer bot-meeple"><p class="meeple-prompt">' + t("botThinking") + "</p></div>");
    return marks.join("");
  }
  const color = game.players[game.pendingMeeple.player].id;
  const slots = game.meepleSlots();
  const spots = slots.map((slot) =>
    '<button type="button" class="meeple-spot spot-' + slot.kind +
    '" data-meeple-slot="' + slot.id + '" style="left:' + (slot.x * 100) +
    "%;top:" + (slot.y * 100) + '%" aria-label="' + t("placeMeeple") +
    '"><i class="meeple ' + color + '" aria-hidden="true"></i></button>'
  ).join("");
  const stock = game.meeples[game.pendingMeeple.player];
  const prompt = slots.length
    ? t("pickMeeple")
    : stock <= 0
      ? t("noMeeplesLeft")
      : t("noOpenSpot");
  marks.push(
    '<div class="meeple-layer">' +
    '<p class="meeple-prompt">' + prompt + "</p>" +
    spots +
    '<div class="meeple-actions">' +
    '<button type="button" id="skip-meeple">' + t("skip") + "</button>" +
    '<button type="button" id="undo-place" aria-label="' + t("undoPlace") +
    '" title="' + t("undoPlace") + '">' +
    '<svg class="undo-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>' +
    '</svg></button>' +
    "</div></div>"
  );
  return marks.join("");
}

function rankingHTML() {
  const order = game.standings || game.players.map((_, index) => index);
  const rows = order.map((index, rank) => {
    const player = game.players[index];
    return '<li>' +
      '<span class="rank-num">' + (rank + 1) + "</span>" +
      '<span class="rank-name ' + player.id + '">' + displayPlayerName(player) + "</span>" +
      '<b class="rank-score">' + game.scores[index] + "</b></li>";
  }).join("");
  return '<ul class="ranking-list">' + rows + "</ul>";
}

function paintDiscardOverlay() {
  const overlay = document.getElementById("discard-overlay");
  const card = document.getElementById("overlay-card");
  const message = document.getElementById("overlay-message");
  const rankingRoot = document.getElementById("ranking-root");
  const rankingActions = document.getElementById("ranking-actions");
  const actions = document.getElementById("overlay-actions");
  const ok = document.getElementById("ok-discard");
  const confirmExit = document.getElementById("confirm-exit");
  const cancelExit = document.getElementById("cancel-exit");
  const minimize = document.getElementById("minimize-ranking");

  function showActions(mode) {
    ok.hidden = mode !== "discard";
    confirmExit.hidden = mode !== "exit";
    cancelExit.hidden = mode !== "exit";
    actions.hidden = mode === "ranking";
    rankingActions.hidden = mode !== "ranking";
    minimize.hidden = mode !== "ranking";
    card.classList.toggle("ranking-open", mode === "ranking");
    card.classList.toggle("exit-open", mode === "exit");
  }

  if (game.pendingDiscard) {
    exitConfirmOpen = false;
    overlay.hidden = false;
    message.hidden = false;
    message.textContent = t("noLegalPlace");
    rankingRoot.hidden = true;
    rankingRoot.innerHTML = "";
    showActions("discard");
    return;
  }
  if (exitConfirmOpen && !game.finished) {
    overlay.hidden = false;
    message.hidden = false;
    message.textContent = t("endThisGame");
    rankingRoot.hidden = true;
    rankingRoot.innerHTML = "";
    showActions("exit");
    return;
  }
  if (game.finished && game.rankingOpen) {
    exitConfirmOpen = false;
    overlay.hidden = false;
    message.hidden = false;
    message.textContent = t("gameOver");
    rankingRoot.hidden = false;
    rankingRoot.innerHTML = rankingHTML();
    showActions("ranking");
    return;
  }
  exitConfirmOpen = false;
  overlay.hidden = true;
  rankingRoot.hidden = true;
  rankingRoot.innerHTML = "";
  showActions("discard");
}

function paintSide() {
  const hudTop = document.querySelector(".hud-top");
  if (hudTop) hudTop.hidden = !!game.finished;
  document.getElementById("players-root").innerHTML = playersHTML();
  document.getElementById("stats-root").innerHTML = statsHTML();
  document.getElementById("hand-root").innerHTML = handHTML();
  document.getElementById("foot-root").innerHTML = footHTML();
  paintDiscardOverlay();
  paintLegend();
}

function paintGrid() {
  const bounds = game.bounds(1);
  const lockHints = game.pendingMeeple || game.pendingDiscard || exitConfirmOpen || humanControlsLocked();
  const hints = lockHints ? { now: [], later: [] } : game.hints();
  const now = new Set(hints.now.map((cell) => cell.x + "," + cell.y));
  const later = new Map(hints.later.map((cell) => [cell.x + "," + cell.y, cell.rots]));
  const pendingKey = game.pendingMeeple
    ? game.pendingMeeple.x + "," + game.pendingMeeple.y
    : null;
  const cols = bounds.maxX - bounds.minX + 1;
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = "repeat(" + cols + ", var(--cell))";
  grid.style.setProperty("--sand-min-x", String(bounds.minX));
  grid.style.setProperty("--sand-min-y", String(bounds.minY));
  const parts = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const pos = x + "," + y;
      const tile = game.board.get(pos);
      if (tile) {
        const owner = tile.owner ? " owner-" + tile.owner : "";
        const recent = tile.owner && game.lastPlacedBy[tile.owner] === pos ? " recent" : "";
        const pending = pendingKey === pos;
        parts.push(
          '<div class="slot filled' + owner + recent + (pending ? " meeple-target" : "") +
          '" data-pos="' + pos + '">' +
          '<div class="scaler">' + Carcassonne.tileHTML(tile.id, tile.rot) + "</div>" +
          meepleMarksHTML(tile, pending) + "</div>"
        );
        continue;
      }
      if (now.has(pos)) {
        parts.push(
          '<button type="button" class="slot empty hint-now" data-pos="' + pos + '" data-place="' + pos +
          '" data-preview-rot="' + game.rotation + '" aria-label="Can place"></button>'
        );
        continue;
      }
      if (later.has(pos)) {
        parts.push(
          '<div class="slot empty hint-rot" data-pos="' + pos +
          '" data-preview-rot="' + game.rotation + '"></div>'
        );
        continue;
      }
      parts.push('<div class="slot empty" data-pos="' + pos + '"></div>');
    }
  }
  grid.innerHTML = parts.join("");
}

function scroller() {
  return document.getElementById("scroller");
}

function captureAnchor() {
  const slots = document.querySelectorAll("#grid [data-pos]");
  if (!slots.length) return null;
  const frame = scroller().getBoundingClientRect();
  const cx = frame.left + frame.width / 2;
  const cy = frame.top + frame.height / 2;
  let best = null;
  let bestD = Infinity;
  slots.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const dist = (rect.left + rect.width / 2 - cx) ** 2 + (rect.top + rect.height / 2 - cy) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = el;
    }
  });
  const rect = best.getBoundingClientRect();
  return {
    pos: best.dataset.pos,
    dx: rect.left + rect.width / 2 - cx,
    dy: rect.top + rect.height / 2 - cy,
  };
}

function finishCenterAnim(runDone) {
  if (centerAnim != null) {
    cancelAnimationFrame(centerAnim);
    centerAnim = null;
  }
  const done = centerAnimDone;
  centerAnimDone = null;
  if (runDone && done) done();
}

function cancelCenterAnim() {
  finishCenterAnim(true);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function centerOn(pos, durationMs, onDone) {
  const done = typeof onDone === "function" ? onDone : null;
  const el = document.querySelector('#grid [data-pos="' + pos + '"]');
  finishCenterAnim(false);
  if (!el) {
    if (done) done();
    return;
  }
  const frame = scroller().getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const box = scroller();
  const dx = rect.left + rect.width / 2 - (frame.left + frame.width / 2);
  const dy = rect.top + rect.height / 2 - (frame.top + frame.height / 2);
  if (!durationMs || durationMs <= 0 || (Math.abs(dx) < 2 && Math.abs(dy) < 2)) {
    box.scrollLeft += dx;
    box.scrollTop += dy;
    if (done) done();
    return;
  }
  const startLeft = box.scrollLeft;
  const startTop = box.scrollTop;
  const endLeft = startLeft + dx;
  const endTop = startTop + dy;
  const start = performance.now();
  centerAnimDone = done;
  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const e = easeInOutCubic(t);
    box.scrollLeft = startLeft + (endLeft - startLeft) * e;
    box.scrollTop = startTop + (endTop - startTop) * e;
    if (t < 1) {
      centerAnim = requestAnimationFrame(tick);
      return;
    }
    finishCenterAnim(true);
  }
  centerAnim = requestAnimationFrame(tick);
}

function restoreAnchor(anchor) {
  const el = document.querySelector('#grid [data-pos="' + anchor.pos + '"]');
  if (!el) return;
  const frame = scroller().getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const box = scroller();
  box.scrollLeft += rect.left + rect.width / 2 - (frame.left + frame.width / 2) - anchor.dx;
  box.scrollTop += rect.top + rect.height / 2 - (frame.top + frame.height / 2) - anchor.dy;
}

function showGhost(slot) {
  if (!slot || slot.querySelector(".ghost") || !game.current || game.pendingDiscard) return;
  const ok = slot.classList.contains("hint-now");
  const blocked = slot.classList.contains("hint-rot");
  if (!ok && !blocked) return;
  const ghost = document.createElement("div");
  ghost.className = ok ? "ghost" : "ghost invalid";
  ghost.innerHTML = '<div class="scaler">' + Carcassonne.tileHTML(game.current.id, game.rotation) + "</div>";
  slot.appendChild(ghost);
}

function rotateClockwise() {
  if (humanControlsLocked()) return;
  if (game.finished || game.pendingMeeple || game.pendingDiscard || !game.current) return;
  game.rotate(1);
  render({ keep: true });
}

function clearBotTimer() {
  if (botTimer != null) {
    clearTimeout(botTimer);
    botTimer = null;
  }
}

function scheduleBot(delay) {
  clearBotTimer();
  if (!isBotTurn() || game.finished) {
    botBusy = false;
    return;
  }
  botBusy = true;
  botTimer = setTimeout(runBotStep, delay == null ? BOT_MOVE_MS : delay);
}

function finishBotMeeple(slotId) {
  const before = game.scores.slice();
  const color = game.players[game.pendingMeeple.player].id;
  let ok = false;
  if (slotId) {
    ok = game.placeMeeple(slotId);
    if (ok) playMeepleSound(color);
  } else {
    ok = game.skipMeeple();
  }
  if (!ok && game.pendingMeeple) ok = game.skipMeeple();
  if (ok && scoresGained(before)) playSound("point");
  botBusy = false;
  render({ keep: true });
}

function commitBotPlace(action) {
  if (!isBotTurn() || game.finished) {
    botBusy = false;
    return;
  }
  game.setRotation(action.rot);
  if (!game.place(action.x, action.y)) {
    botBusy = false;
    render({ keep: true });
    return;
  }
  playSound("tile");
  render({ keep: true, skipBot: true });
  clearBotTimer();
  botBusy = true;
  botTimer = setTimeout(() => finishBotMeeple(action.slotId), BOT_MEEPLE_MS);
}

function runBotStep() {
  botTimer = null;
  if (!isBotTurn() || game.finished) {
    botBusy = false;
    return;
  }
  const seat = activeSeat();
  const strength = game.players[seat].botStrength || "standard";
  const action = Carcassonne.chooseBotAction(game, strength);
  if (!action) {
    botBusy = false;
    return;
  }
  if (action.type === "discard") {
    if (game.acknowledgeDiscard()) {
      botBusy = false;
      render({ keep: true });
    } else {
      botBusy = false;
    }
    return;
  }
  if (action.type === "meeple") {
    finishBotMeeple(action.slotId);
    return;
  }
  if (action.type === "place") {
    game.setRotation(action.rot);
    paintSide();
    const center = action.x + "," + action.y;
    clearBotTimer();
    botBusy = true;
    requestAnimationFrame(() => {
      centerOn(center, BOT_CENTER_MS, () => commitBotPlace(action));
    });
  }
}

function applyHandRotation(button) {
  if (!button) return false;
  if (button.dataset.rotate != null) {
    rotateClockwise();
    return true;
  }
  if (button.dataset.setRot != null) {
    game.setRotation(Number(button.dataset.setRot));
    render({ keep: true });
    return true;
  }
  return false;
}

function firstPlaceColors() {
  const order = game.standings || [];
  if (!order.length) return [];
  const top = game.scores[order[0]];
  const colors = [];
  for (const index of order) {
    if (game.scores[index] !== top) break;
    colors.push(game.players[index].id);
  }
  return colors;
}

function armLeaveFxClear() {
  let earliest = null;
  for (const tile of game.board.values()) {
    if (!tile.leaveFx) continue;
    const at = tile.leaveFx.at || Date.now();
    if (earliest == null || at < earliest) earliest = at;
  }
  clearTimeout(leaveFxTimer);
  leaveFxTimer = null;
  if (earliest == null) return;
  // Don't restart the full duration on every render (rotate was replaying leave FX).
  const remaining = Math.max(0, LEAVE_FX_MS - (Date.now() - earliest));
  leaveFxTimer = setTimeout(() => {
    leaveFxTimer = null;
    const now = Date.now();
    let cleared = false;
    let remainingFx = false;
    for (const tile of game.board.values()) {
      if (!tile.leaveFx) continue;
      if (now - (tile.leaveFx.at || 0) >= LEAVE_FX_MS) {
        tile.leaveFx = null;
        cleared = true;
      } else {
        remainingFx = true;
      }
    }
    if (cleared) {
      document.querySelectorAll(".meeple-pin.leaving").forEach((el) => {
        const tileEl = el.closest("[data-pos]");
        const pos = tileEl && tileEl.dataset.pos;
        const tile = pos ? game.board.get(pos) : null;
        if (!tile || !tile.leaveFx) el.remove();
      });
    }
    if (remainingFx) armLeaveFxClear();
  }, remaining);
}

function maybePlayEndFanfare() {
  if (!game.finished || endFanfareStarted) return;
  endFanfareStarted = true;
  void TileCityAudio.playEndFanfare(firstPlaceColors());
}

function render(opts) {
  opts = opts || {};
  game.reconcileHand();
  const anchor = opts.keep ? captureAnchor() : null;
  paintSide();
  paintGrid();
  persistGame();
  armLeaveFxClear();
  maybePlayEndFanfare();
  if (opts.center) {
    requestAnimationFrame(() => centerOn(opts.center, opts.centerMs));
  } else if (anchor) {
    cancelCenterAnim();
    restoreAnchor(anchor);
  }
  if (opts.skipBot) return;
  if (isBotTurn()) {
    const delay = game.pendingDiscard ? BOT_DISCARD_MS : BOT_MOVE_MS;
    scheduleBot(delay);
  } else {
    botBusy = false;
    clearBotTimer();
  }
}

document.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".slot")) event.preventDefault();
  if (!event.target.closest("#scroller")) return;
  cancelCenterAnim();
  pan = {
    x: event.clientX,
    y: event.clientY,
    left: scroller().scrollLeft,
    top: scroller().scrollTop,
    moved: false,
  };
  scroller().classList.add("dragging");
});

document.addEventListener("mousemove", (event) => {
  if (!pan) return;
  const dx = event.clientX - pan.x;
  const dy = event.clientY - pan.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true;
  if (!pan.moved) return;
  scroller().scrollLeft = pan.left - dx;
  scroller().scrollTop = pan.top - dy;
});

document.addEventListener("mouseup", () => {
  if (!pan) return;
  if (pan.moved) {
    skipClick = true;
    setTimeout(() => { skipClick = false; }, 0);
    persistGame();
  }
  pan = null;
  scroller().classList.remove("dragging");
});

// Touch/pen: rotate on pointerdown so rapid taps are not lost when the hand
// DOM is replaced mid-gesture (click would fire too late / on a dead node).
// Suppress rotate clicks for a window (not a one-shot flag) — duplicate
// compatibility clicks must not rotate again.
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
  if (!event.isPrimary) return;
  if (event.button !== 0 && event.button !== -1) return;
  if (humanControlsLocked()) return;
  const button = event.target.closest("button[data-rotate], button[data-set-rot]");
  if (!button) return;
  event.preventDefault();
  if (!applyHandRotation(button)) return;
  suppressHandClickUntil = Date.now() + 700;
});

document.addEventListener("click", (event) => {
  if (skipClick) {
    skipClick = false;
    return;
  }
  const button = event.target.closest("button");
  if (!button) return;
  if (
    Date.now() < suppressHandClickUntil &&
    (button.dataset.rotate != null || button.dataset.setRot != null)
  ) {
    return;
  }
  if (button.id === "zoom-in") {
    setBoardZoom(boardZoom + ZOOM_STEP);
    return;
  }
  if (button.id === "zoom-out") {
    setBoardZoom(boardZoom - ZOOM_STEP);
    return;
  }
  if (button.id === "ok-discard") {
    if (humanControlsLocked()) return;
    if (game.acknowledgeDiscard()) render({ keep: true });
    return;
  }
  if (button.id === "minimize-ranking") {
    game.rankingOpen = false;
    render({ keep: true });
    return;
  }
  if (button.classList.contains("js-open-ranking")) {
    game.rankingOpen = true;
    exitConfirmOpen = false;
    render({ keep: true });
    return;
  }
  if (button.classList.contains("js-exit")) {
    exitConfirmOpen = true;
    render({ keep: true });
    return;
  }
  if (button.id === "cancel-exit") {
    exitConfirmOpen = false;
    render({ keep: true });
    return;
  }
  if (button.id === "confirm-exit") {
    exitConfirmOpen = false;
    game.finishGame();
    render({ keep: true });
    return;
  }
  if (button.classList.contains("js-again") || button.id === "again-game") {
    clearSave();
    location.href = "setup.html";
    return;
  }
  if (button.classList.contains("js-quit") || button.id === "end-game") {
    clearSave();
    location.href = "index.html";
    return;
  }
  if (button.id === "skip-meeple") {
    if (humanControlsLocked()) return;
    const before = game.scores.slice();
    if (game.skipMeeple()) {
      if (scoresGained(before)) playSound("point");
      render({ keep: true });
    }
    return;
  }
  if (button.id === "undo-place") {
    if (humanControlsLocked()) return;
    if (game.undoPlace()) render({ keep: true });
    return;
  }
  if (button.dataset.meepleSlot) {
    if (humanControlsLocked()) return;
    const before = game.scores.slice();
    const color = game.players[game.pendingMeeple.player].id;
    if (game.placeMeeple(button.dataset.meepleSlot)) {
      playMeepleSound(color);
      if (scoresGained(before)) playSound("point");
      render({ keep: true });
    }
    return;
  }
  if (humanControlsLocked()) return;
  if (applyHandRotation(button)) return;
  if (button.dataset.place) {
    const parts = button.dataset.place.split(",").map(Number);
    if (game.place(parts[0], parts[1])) {
      playSound("tile");
      render({ keep: true });
    }
  }
});

let pointerOnBoard = false;
document.getElementById("scroller").addEventListener("pointerenter", () => {
  pointerOnBoard = true;
});
document.getElementById("scroller").addEventListener("pointerleave", () => {
  pointerOnBoard = false;
});

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (humanControlsLocked()) return;
  if (game.pendingDiscard && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    if (game.acknowledgeDiscard()) render({ keep: true });
    return;
  }
  if (event.key === "r" || event.key === "R") {
    if (!pointerOnBoard || game.pendingDiscard) return;
    event.preventDefault();
    rotateClockwise();
  }
});

document.addEventListener("contextmenu", (event) => {
  if (!event.target.closest("#scroller")) return;
  if (humanControlsLocked()) return;
  if (game.finished || game.pendingMeeple || game.pendingDiscard || !game.current) return;
  event.preventDefault();
  rotateClockwise();
});

document.getElementById("scroller").addEventListener("wheel", (event) => {
  event.preventDefault();
  const steps = Math.max(1, Math.min(3, Math.round(Math.abs(event.deltaY) / 100)));
  const delta = (event.deltaY > 0 ? -ZOOM_WHEEL : ZOOM_WHEEL) * steps;
  setBoardZoom(boardZoom + delta, { x: event.clientX, y: event.clientY });
}, { passive: false });

let pinch = null;

function pinchDistance(touches) {
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.hypot(dx, dy);
}

function pinchMidpoint(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function midpointOverScroller(mid) {
  const box = scroller().getBoundingClientRect();
  return mid.x >= box.left && mid.x <= box.right && mid.y >= box.top && mid.y <= box.bottom;
}

document.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 2) {
    if (event.touches.length < 2) pinch = null;
    return;
  }
  const mid = pinchMidpoint(event.touches);
  if (!midpointOverScroller(mid)) {
    pinch = null;
    return;
  }
  pinch = {
    dist: pinchDistance(event.touches),
    zoom: boardZoom,
  };
}, { passive: true });

document.addEventListener("touchmove", (event) => {
  if (!pinch || event.touches.length !== 2) return;
  const dist = pinchDistance(event.touches);
  if (!(pinch.dist > 0) || !(dist > 0)) return;
  event.preventDefault();
  setBoardZoom(pinch.zoom * (dist / pinch.dist), pinchMidpoint(event.touches));
}, { passive: false });

document.addEventListener("touchend", (event) => {
  if (event.touches.length < 2) pinch = null;
}, { passive: true });

document.addEventListener("touchcancel", () => {
  pinch = null;
}, { passive: true });

// Safari page pinch; keep board zoom as the only zoom gesture.
document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });

document.addEventListener("mouseover", (event) => {
  showGhost(event.target.closest("[data-preview-rot]"));
});

document.addEventListener("mouseout", (event) => {
  const slot = event.target.closest("[data-preview-rot]");
  if (!slot || slot.contains(event.relatedTarget)) return;
  const ghost = slot.querySelector(".ghost");
  if (ghost) ghost.remove();
});

document.addEventListener("focusin", (event) => {
  showGhost(event.target.closest("[data-preview-rot]"));
});

function syncLayoutMode() {
  const root = document.documentElement;
  const ua = navigator.userAgent || "";
  const isIPhone = /iPhone|iPod/i.test(ua);
  // iPadOS 13+ may report as Macintosh + touch; iPad Pro 11/13 exceed 1024px CSS width.
  const isIPad =
    /iPad/i.test(ua) ||
    (!isIPhone && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const narrow = window.matchMedia("(max-width: 1024px)").matches;
  const classicPadViewport = window.matchMedia(
    "(min-width: 768px) and (max-width: 1024px) and (min-height: 700px)"
  ).matches;

  if (isIPhone) {
    root.classList.remove("is-pad");
    root.classList.add("is-overlay");
    return;
  }

  const isPad = isIPad || classicPadViewport;
  root.classList.toggle("is-pad", isPad);
  // Overlay HUD for phones, all iPads (incl. Pro >1024), and narrow windows.
  root.classList.toggle("is-overlay", isPad || narrow);
}

syncLayoutMode();
applyBoardZoom();
syncBoardPadding();
TileCityI18n.apply();
readyToPersist = true;
if (saved) {
  render({ keep: true });
  restoreView(saved.view);
} else {
  render({ center: "0,0" });
}
window.addEventListener("resize", () => {
  syncLayoutMode();
  syncBoardPadding();
});
window.addEventListener("pagehide", () => {
  persistGame();
});
