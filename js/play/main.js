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

function scoresGained(before) {
  return game.scores.some((score, index) => score > (before[index] || 0));
}
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.05;
const ZOOM_WHEEL = 0.025;
const TILE_TOTAL = Carcassonne.TYPES.reduce((sum, type) => sum + type.count, 0);
let exitConfirmOpen = false;

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
let boardZoom = 0.8;
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

function playersHTML() {
  const order = game.finished && game.standings
    ? game.standings
    : game.players.map((_, index) => index);
  return '<ul class="players">' + order.map((index) => {
    const player = game.players[index];
    const on = !game.finished && index === game.player ? " on" : "";
    const rank = game.finished ? '<span class="rank">' + (order.indexOf(index) + 1) + "</span>" : "";
    return '<li class="' + player.id + on + '">' +
      rank +
      '<span class="pname">' + player.name + "</span>" +
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

function meepleMarksHTML(tile, pending) {
  const marks = [];
  if (tile.meeple) {
    const fieldClass = tile.meeple.kind === "field" ? " field-meeple" : "";
    const earned = tile.meeple.earned
      ? '<span class="meeple-earned">+' + tile.meeple.earned + "</span>"
      : "";
    marks.push(
      '<span class="meeple-pin" style="left:' + (tile.meeple.x * 100) + "%;top:" +
      (tile.meeple.y * 100) + '%">' +
      '<i class="meeple on-tile ' + tile.meeple.color + fieldClass + '" aria-hidden="true"></i>' +
      earned + "</span>"
    );
  }
  if (!pending) return marks.join("");
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
    '<button type="button" id="undo-place" aria-label="' + t("undoPlace") +
    '" title="' + t("undoPlace") + '">' +
    '<svg class="undo-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12.5 8C9.85 8 7.45 9 5.6 10.6L2 7v9h9l-3.62-3.62' +
    'C8.77 11.22 10.54 10.5 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>' +
    '</svg></button>' +
    '<button type="button" id="skip-meeple">' + t("skip") + "</button>" +
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
      '<span class="rank-name ' + player.id + '">' + player.name + "</span>" +
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
  document.getElementById("players-root").innerHTML = playersHTML();
  document.getElementById("stats-root").innerHTML = statsHTML();
  document.getElementById("hand-root").innerHTML = handHTML();
  document.getElementById("foot-root").innerHTML = footHTML();
  paintDiscardOverlay();
  paintLegend();
}

function paintGrid() {
  const bounds = game.bounds(1);
  const hints = game.pendingMeeple || game.pendingDiscard || exitConfirmOpen
    ? { now: [], later: [] }
    : game.hints();
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

function centerOn(pos) {
  const el = document.querySelector('#grid [data-pos="' + pos + '"]');
  if (!el) return;
  const frame = scroller().getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const box = scroller();
  box.scrollLeft += rect.left + rect.width / 2 - (frame.left + frame.width / 2);
  box.scrollTop += rect.top + rect.height / 2 - (frame.top + frame.height / 2);
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
  if (game.finished || game.pendingMeeple || game.pendingDiscard || !game.current) return;
  game.rotate(1);
  render({ keep: true });
}

function render(opts) {
  opts = opts || {};
  game.reconcileHand();
  const anchor = opts.keep ? captureAnchor() : null;
  paintSide();
  paintGrid();
  persistGame();
  if (opts.center) requestAnimationFrame(() => centerOn(opts.center));
  else if (anchor) restoreAnchor(anchor);
}

document.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".slot")) event.preventDefault();
  if (!event.target.closest("#scroller")) return;
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

document.addEventListener("click", (event) => {
  if (skipClick) {
    skipClick = false;
    return;
  }
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "zoom-in") {
    setBoardZoom(boardZoom + ZOOM_STEP);
    return;
  }
  if (button.id === "zoom-out") {
    setBoardZoom(boardZoom - ZOOM_STEP);
    return;
  }
  if (button.id === "ok-discard") {
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
    const before = game.scores.slice();
    if (game.skipMeeple()) {
      if (scoresGained(before)) playSound("point");
      render({ keep: true });
    }
    return;
  }
  if (button.id === "undo-place") {
    if (game.undoPlace()) render({ keep: true });
    return;
  }
  if (button.dataset.meepleSlot) {
    const before = game.scores.slice();
    if (game.placeMeeple(button.dataset.meepleSlot)) {
      if (scoresGained(before)) playSound("point");
      render({ keep: true });
    }
    return;
  }
  if (button.dataset.rotate != null) {
    rotateClockwise();
    return;
  }
  if (button.dataset.setRot != null) {
    game.setRotation(Number(button.dataset.setRot));
    render({ keep: true });
    return;
  }
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
  syncBoardPadding();
});
window.addEventListener("pagehide", () => {
  persistGame();
});
