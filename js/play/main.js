import TileCityAudio from "../audio.js";
import Carcassonne from "../game/index.js";
import TileCityI18n from "../i18n.js";
import {
  clearSave,
  loadRoster as loadRosterFromStorage,
  loadSetupOptions as loadSetupOptionsFromStorage,
  loadSavedGame as loadSavedGameFromStorage,
  writeSave,
} from "./storage.js";
import {
  buildShareText,
  composeShareImage,
  copyText,
  downloadBlob,
  nativeShare,
  snsLinks,
} from "./share.js";

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

function loadSetupOptions() {
  return loadSetupOptionsFromStorage(Carcassonne);
}

function loadSavedGame() {
  return loadSavedGameFromStorage(Carcassonne);
}

let readyToPersist = false;
let persistTimer = null;
const PERSIST_ZOOM_MS = 200;

function persistGame() {
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const box = document.getElementById("scroller");
  writeSave(Carcassonne, game, {
    zoom: boardZoom,
    left: box ? box.scrollLeft : 0,
    top: box ? box.scrollTop : 0,
  }, readyToPersist);
}

/** Coalesce zoom-driven saves; move/render paths still call persistGame(). */
function persistGameSoon() {
  if (persistTimer != null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistGame();
  }, PERSIST_ZOOM_MS);
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
let game = saved
  ? saved.game
  : Carcassonne.createGame(undefined, roster, loadSetupOptions());
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

/** Last padding written by syncBoardPadding; avoids getComputedStyle on zoom. */
let syncedPadX = -1;
let syncedPadY = -1;

function gridPadBox(grid) {
  let left = syncedPadX;
  let top = syncedPadY;
  let right = syncedPadX;
  let bottom = syncedPadY;
  if (!(left >= 0) || !(top >= 0)) {
    const style = getComputedStyle(grid);
    left = parseFloat(style.paddingLeft) || 0;
    top = parseFloat(style.paddingTop) || 0;
    right = parseFloat(style.paddingRight) || 0;
    bottom = parseFloat(style.paddingBottom) || 0;
  }
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
  if (padX === syncedPadX && padY === syncedPadY) return;
  const before = gridPadBox(grid);
  const midX = box.scrollLeft + box.clientWidth / 2;
  const midY = box.scrollTop + box.clientHeight / 2;
  const boardX = midX - before.left;
  const boardY = midY - before.top;
  grid.style.padding = padY + "px " + padX + "px";
  syncedPadX = padX;
  syncedPadY = padY;
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
  persistGameSoon();
}

let zoomRaf = null;
let zoomGoal = null;

/** One zoom apply per frame; wheel deltas accumulate into the goal zoom. */
function scheduleBoardZoom(next, pivot) {
  zoomGoal = { zoom: next, pivot };
  if (zoomRaf != null) return;
  zoomRaf = requestAnimationFrame(() => {
    zoomRaf = null;
    const goal = zoomGoal;
    zoomGoal = null;
    if (goal) setBoardZoom(goal.zoom, goal.pivot);
  });
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
  if (game.pendingConfirm) return game.pendingConfirm.player;
  if (game.pendingMeeple) return game.pendingMeeple.player;
  return game.player;
}

function undoButtonHTML() {
  return '<button type="button" id="undo-place" aria-label="' + t("undoPlace") +
    '" title="' + t("undoPlace") + '">' +
    '<svg class="undo-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>' +
    "</svg></button>";
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

function boardCap() {
  return Math.max(
    game.board.size,
    TILE_TOTAL - game.discards.length - (game.pendingDiscard ? 1 : 0)
  );
}

function statsHTML() {
  const exitTop = game.finished
    ? ""
    : '<button type="button" class="exit-chip js-exit">' + t("exit") + "</button>";
  const cap = boardCap();
  return '<div class="meters"><div><span>' + t("deck") + "</span><b>" + game.deck.length +
    '</b></div><div><span>' + t("board") + "</span><b>" + game.board.size +
    '</b></div><div><span>' + t("discards") + "</span><b>" + game.discards.length +
    '</b></div></div><div class="hud-meta">' + exitTop +
    '<div class="deck-short">' +
    '<span class="deck-chip">' + t("deck") + " " + game.deck.length + "</span>" +
    '<span class="deck-chip">' + t("board") + " " + game.board.size + "/" + cap + "</span>" +
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
  let earned = "";
  if (pin.earned) {
    const label = pin.earnedDim ? String(pin.earned) : ("+" + pin.earned);
    earned = '<span class="meeple-earned' + (pin.earnedDim ? " sub" : "") + '">' +
      label + "</span>";
  }
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

  // After meeple: OK + ← (undo meeple back to pick phase).
  if (game.pendingConfirm) {
    marks.push(
      '<div class="meeple-layer confirm-layer">' +
      '<div class="meeple-actions">' +
      '<button type="button" id="confirm-turn">' + t("ok") + "</button>" +
      undoButtonHTML() +
      "</div></div>"
    );
    return marks.join("");
  }

  if (!game.pendingMeeple) return marks.join("");
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
  // Pick phase: OK + ← (no Skip). OK without a meeple ends the turn.
  marks.push(
    '<div class="meeple-layer">' +
    '<p class="meeple-prompt">' + prompt + "</p>" +
    spots +
    '<div class="meeple-actions">' +
    '<button type="button" id="confirm-turn">' + t("ok") + "</button>" +
    undoButtonHTML() +
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

let sharePayload = null;
let shareBusy = false;

function shareLabels() {
  return {
    title: t("shareTextTitle"),
    ranking: t("gameOver"),
    hashtag: "#TileCity",
  };
}

function setShareStatus(message, kind) {
  const status = document.getElementById("share-status");
  if (!status) return;
  if (!message) {
    status.hidden = true;
    status.textContent = "";
    status.className = "share-status";
    return;
  }
  status.hidden = false;
  status.textContent = message;
  status.className = "share-status" + (kind ? " " + kind : "");
}

function bindShareLinks(text) {
  const links = snsLinks(text);
  const map = {
    "share-x": links.x,
    "share-line": links.line,
    "share-facebook": links.facebook,
    "share-threads": links.threads,
  };
  Object.entries(map).forEach(([id, href]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.href = href;
    // LINE deep links should stay in this tab. A leftover _blank Safari page
    // can bounce LINE↔browser in a loop after the handoff.
    if (id === "share-line" && href.indexOf("line.me/R/msg/text") !== -1) {
      el.removeAttribute("target");
    } else {
      el.target = "_blank";
    }
  });
  return links;
}

async function openShareSheet() {
  if (!game.finished || shareBusy) return;
  const sheet = document.getElementById("share-sheet");
  const preview = document.getElementById("share-preview");
  const nativeBtn = document.getElementById("share-native");
  if (!sheet || !preview) return;

  shareBusy = true;
  sharePayload = null;
  setShareStatus(t("sharePreparing"));
  sheet.hidden = false;
  preview.removeAttribute("src");
  preview.alt = t("shareTitle");
  if (nativeBtn) nativeBtn.hidden = !navigator.share;

  const wasOpen = game.rankingOpen;
  game.rankingOpen = false;
  paintSide();

  try {
    const labels = shareLabels();
    const text = buildShareText(game, displayPlayerName, labels);
    const image = await composeShareImage(game, displayPlayerName, labels);
    sharePayload = { ...image, text, links: bindShareLinks(text) };
    preview.src = image.dataUrl;
    setShareStatus("");
  } catch (err) {
    console.error(err);
    const labels = shareLabels();
    const text = buildShareText(game, displayPlayerName, labels);
    sharePayload = {
      blob: null,
      dataUrl: "",
      fileName: "tilecity-ranking.png",
      text,
      links: bindShareLinks(text),
    };
    setShareStatus(t("shareCaptureFail"), "error");
  } finally {
    game.rankingOpen = wasOpen;
    paintSide();
    shareBusy = false;
  }
}

function closeShareSheet() {
  const sheet = document.getElementById("share-sheet");
  if (sheet) sheet.hidden = true;
  sharePayload = null;
  setShareStatus("");
}

function pulseSharePreview() {
  const wrap = document.querySelector(".share-preview-wrap");
  if (!wrap) return;
  wrap.classList.remove("save-hint");
  void wrap.offsetWidth;
  wrap.classList.add("save-hint");
  window.setTimeout(() => wrap.classList.remove("save-hint"), 1800);
}

async function onShareNative() {
  if (!sharePayload) return;
  try {
    const mode = await nativeShare({
      blob: sharePayload.blob,
      fileName: sharePayload.fileName,
      text: sharePayload.text,
      url: sharePayload.links.url,
    });
    // Web Share does not report whether the user sent, copied, or saved —
    // only that the sheet closed without abort. Avoid claiming a specific action.
    if (mode) setShareStatus("");
    else setShareStatus(t("shareNativeUnavailable"), "error");
  } catch (err) {
    if (err && err.name === "AbortError") return;
    console.error(err);
    setShareStatus(t("shareNativeUnavailable"), "error");
  }
}

async function onShareDownload() {
  if (!sharePayload || !sharePayload.blob) {
    setShareStatus(t("shareCaptureFail"), "error");
    return;
  }
  try {
    const mode = await downloadBlob(sharePayload.blob, sharePayload.fileName);
    if (mode === "abort") return;
    if (mode === "ios-hint") {
      pulseSharePreview();
      setShareStatus(t("shareSaveHint"), "ok");
      return;
    }
    setShareStatus(t("shareSaved"), "ok");
  } catch (err) {
    console.error(err);
    setShareStatus(t("shareCaptureFail"), "error");
  }
}

async function onShareCopyText() {
  if (!sharePayload) return;
  const ok = await copyText(sharePayload.text + "\n" + sharePayload.links.url);
  setShareStatus(ok ? t("shareCopied") : t("shareCopyFail"), ok ? "ok" : "error");
}

async function onShareCopyUrl() {
  if (!sharePayload) return;
  const ok = await copyText(sharePayload.links.url);
  setShareStatus(ok ? t("shareLinkCopied") : t("shareCopyFail"), ok ? "ok" : "error");
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

const CLAIM_HEX = Object.fromEntries(
  Carcassonne.COLOR_PALETTE.map((color) => [color.id, color.hex])
);

/** ~180° apart = E–W / N–S; ~90° = diagonal (N–E etc.). */
function claimAxisKind(claim) {
  const sectors = claim.sectors;
  if (!sectors || sectors.length < 2) return "ortho";
  if (sectors.length > 2) return "fan";
  let d = Math.abs(sectors[1].angle - sectors[0].angle);
  d = Math.min(d, 360 - d);
  return d >= 150 ? "ortho" : "diag";
}

/**
 * Conic fan for 3+ edges. Soft width is a fixed fraction of each sector
 * so every seam (blue–red, yellow–blue, …) looks the same.
 */
function claimFanGradient(claim, wall, softMaxDeg) {
  const sectors = claim.sectors && claim.sectors.length >= 2
    ? claim.sectors
    : [
        { color: claim.colors[0], angle: 270 },
        { color: claim.colors[1], angle: 90 },
      ];
  const softMax = softMaxDeg == null ? 20 : softMaxDeg;
  const n = sectors.length;
  const bounds = [];
  for (let i = 0; i < n; i++) {
    const a = sectors[i].angle;
    const b = sectors[(i + 1) % n].angle;
    const span = ((b - a) % 360 + 360) % 360;
    bounds.push(((a + span / 2) % 360 + 360) % 360);
  }
  const origin = bounds[n - 1];
  const parts = [];
  for (let i = 0; i < n; i++) {
    const hex = CLAIM_HEX[sectors[i].color] || "#ff5d78";
    const paint = wall ? "color-mix(in srgb, " + hex + " 52%, #1a0c08 48%)" : hex;
    let left = ((bounds[(i - 1 + n) % n] - origin) % 360 + 360) % 360;
    let right = ((bounds[i] - origin) % 360 + 360) % 360;
    if (right <= left) right += 360;
    const half = (right - left) / 2;
    const soft = Math.min(softMax, Math.max(5, half * 0.22));
    const solidL = left + soft;
    const solidR = right - soft;
    if (i === 0) parts.push(paint + " 0deg");
    parts.push(paint + " " + solidL + "deg");
    parts.push(paint + " " + solidR + "deg");
  }
  const firstHex = CLAIM_HEX[sectors[0].color] || "#ff5d78";
  const firstPaint = wall
    ? "color-mix(in srgb, " + firstHex + " 52%, #1a0c08 48%)"
    : firstHex;
  parts.push(firstPaint + " 360deg");
  return "conic-gradient(from " + origin + "deg, " + parts.join(", ") + ")";
}

const EDGE_DIRS = ["N", "E", "S", "W"];
/** Large keep tiles: shared gate when two of these cities meet. */
const GATE_CITY_IDS = new Set(["C", "M", "N", "O", "P", "Q", "R", "S", "T"]);
/** Cap / bar / elbow-lite cities: small house when meeting any city. */
const HOUSE_CITY_IDS = new Set(["D", "E", "F", "G", "H", "I", "J", "K", "L"]);
const GATE_OPP = { N: "S", E: "W", S: "N", W: "E" };
/* Gate: 柱 | 城壁+扉 | 柱 （見た目は従来の門端デザイン） */
const CITY_GATE_HTML =
  '<span class="gate-pillar a"><span class="roof"></span><span class="win"></span></span>' +
  '<span class="gate-wall"><span class="door"></span></span>' +
  '<span class="gate-pillar b"><span class="roof"></span><span class="win"></span></span>';
const CITY_HOUSE_HTML =
  '<span class="roof"></span>' +
  '<span class="body">' +
    '<span class="win a"></span>' +
    '<span class="win b"></span>' +
    '<span class="door"></span>' +
  "</span>";

function boardEdgeIsCity(tile, boardDir) {
  if (!tile || !tile.edges) return false;
  const edges = Carcassonne.rotateEdges(tile.edges, tile.rot || 0);
  const index = EDGE_DIRS.indexOf(String(boardDir || "").toUpperCase());
  return index >= 0 && edges[index] === "C";
}

function clearCitySeamDecor() {
  document.querySelectorAll("#grid .city-gate, #grid .city-house").forEach((node) => node.remove());
}

/** Stable 90/270 pick so vertical seam decor does not flicker on repaint. */
function seamVertRotDeg(pos, kind) {
  let h = 2166136261;
  const salt = String(pos || "") + ":" + String(kind || "");
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) & 1 ? 90 : 270;
}

/** Face color of a city claim on this tile toward boardDir (bridge/hub/solo). */
function cityFaceToward(pos, boardDir, claims) {
  if (!claims || !pos || !boardDir) return null;
  const prefix = pos + ":city-";
  let solo = null;
  for (const [key, claim] of claims.entries()) {
    if (!key.startsWith(prefix) || !claim || !claim.colors || !claim.colors.length) continue;
    if (claim.mode === "bridge" && claim.boardDir === boardDir) {
      return claim.face || claim.colors[0] || null;
    }
    if (
      claim.mode === "hub" &&
      (claim.bridges || []).some((bridge) => bridge.dir === boardDir)
    ) {
      return claim.face || claim.colors[0] || null;
    }
    if (!claim.tie && claim.colors.length === 1) solo = claim.colors[0];
    else if (claim.face) solo = claim.face;
  }
  return solo;
}

function tintGateStone(el, colorId) {
  if (!el || !colorId) return;
  const hex = CLAIM_HEX[colorId];
  if (!hex) return;
  el.style.setProperty("--tower", "color-mix(in srgb, " + hex + " 58%, #1a0c08 42%)");
  el.style.setProperty("--tower-lit", "color-mix(in srgb, " + hex + " 70%, #2a1410 30%)");
  el.style.setProperty("--tower-dark", "color-mix(in srgb, " + hex + " 34%, #0a0402 66%)");
  el.style.setProperty("--tower-mortar", "color-mix(in srgb, " + hex + " 18%, #050302 82%)");
  el.style.setProperty("--tower-roof", "color-mix(in srgb, " + hex + " 48%, #3e2010 52%)");
  el.style.setProperty("--tower-roof-dark", "color-mix(in srgb, " + hex + " 28%, #1a0a04 72%)");
  el.style.setProperty("--tower-window", "color-mix(in srgb, " + hex + " 22%, #101820 78%)");
  el.style.setProperty("--tower-door-frame", "color-mix(in srgb, " + hex + " 35%, #c9a45a 65%)");
  el.style.setProperty("--gate-wall", "color-mix(in srgb, " + hex + " 52%, #1a0c08 48%)");
  el.style.setProperty("--gate-wall-lit", "color-mix(in srgb, " + hex + " 64%, #2a1410 36%)");
  el.style.setProperty("--gate-wall-dark", "color-mix(in srgb, " + hex + " 30%, #0a0402 70%)");
}

function mountCityGate(slot, boardDir, colorA, colorB, vertRot) {
  if (!slot) return;
  const dir = String(boardDir || "n").toLowerCase();
  const gate = document.createElement("span");
  let cls = "city-gate edge-" + dir;
  if ((dir === "e" || dir === "w") && vertRot) cls += " rot-" + vertRot;
  gate.className = cls;
  gate.setAttribute("aria-hidden", "true");
  gate.innerHTML = CITY_GATE_HTML;
  if (colorA && colorB) {
    if (colorA === colorB) {
      gate.querySelectorAll(".gate-pillar, .gate-wall").forEach((el) => {
        tintGateStone(el, colorA);
      });
    } else {
      tintGateStone(gate.querySelector(".gate-pillar.a"), colorA);
      tintGateStone(gate.querySelector(".gate-pillar.b"), colorB);
    }
  }
  slot.appendChild(gate);
}

function mountCityHouse(slot, boardDir, vertRot) {
  if (!slot) return;
  const dir = String(boardDir || "n").toLowerCase();
  const house = document.createElement("span");
  let cls = "city-house edge-" + dir;
  if ((dir === "e" || dir === "w") && vertRot) cls += " rot-" + vertRot;
  house.className = cls;
  house.setAttribute("aria-hidden", "true");
  house.innerHTML = CITY_HOUSE_HTML;
  slot.appendChild(house);
}

/**
 * Seam decor: gate for C/M/N/O/P/Q/R/S/T↔same; house when a D–L city meets any city.
 * Mounted on the E/S partner so overflow paints above the W/N neighbor.
 */
function applyCityGates(claims) {
  clearCitySeamDecor();
  const board = game.board;
  for (const [pos, tile] of board.entries()) {
    const comma = pos.indexOf(",");
    const x = Number(pos.slice(0, comma));
    const y = Number(pos.slice(comma + 1));
    for (const step of [
      { dir: "E", dx: 1, dy: 0 },
      { dir: "S", dx: 0, dy: 1 },
    ]) {
      if (!boardEdgeIsCity(tile, step.dir)) continue;
      const nPos = (x + step.dx) + "," + (y + step.dy);
      const neighbor = board.get(nPos);
      if (!neighbor) continue;
      const opp = GATE_OPP[step.dir];
      if (!boardEdgeIsCity(neighbor, opp)) continue;

      const bothGate = GATE_CITY_IDS.has(tile.id) && GATE_CITY_IDS.has(neighbor.id);
      const anyHouse = HOUSE_CITY_IDS.has(tile.id) || HOUSE_CITY_IDS.has(neighbor.id);
      if (!bothGate && !anyHouse) continue;

      const slot = document.querySelector('#grid [data-pos="' + nPos + '"]');
      const colorA = cityFaceToward(pos, step.dir, claims);
      const colorB = cityFaceToward(nPos, opp, claims);
      if (bothGate) {
        const vertRot = step.dir === "E" ? seamVertRotDeg(nPos, "gate") : 0;
        mountCityGate(slot, opp, colorA, colorB, vertRot);
      } else {
        const vertRot = step.dir === "E" ? seamVertRotDeg(nPos, "house") : 0;
        mountCityHouse(slot, opp, vertRot);
      }
    }
  }
}

/** Last child of recent slots so the owner ring stacks above keep / gate / house. */
function applyRecentRings() {
  document.querySelectorAll("#grid .slot.filled.recent").forEach((slot) => {
    const ring = document.createElement("span");
    ring.className = "recent-ring";
    ring.setAttribute("aria-hidden", "true");
    slot.appendChild(ring);
  });
}

function tileRotTurns(el) {
  const tile = el.closest(".tile") || el;
  const names = [...tile.classList];
  const deg = names.find((name) => /^rot-(90|180|270)$/.test(name));
  if (deg) return Number(deg.slice(4)) / 90;
  const turn = names.find((name) => /^rot-[0-3]$/.test(name));
  return turn ? Number(turn.slice(4)) : 0;
}

function localDirFromBoard(boardDir, rotTurns) {
  const index = EDGE_DIRS.indexOf(String(boardDir || "").toUpperCase());
  if (index < 0) return boardDir;
  return EDGE_DIRS[(index - ((rotTurns % 4) + 4) % 4 + 4) % 4];
}

function clearClaimEdgeGrads(el) {
  const feat = el.getAttribute("data-feat");
  const tile = el.closest(".tile");
  if (!tile) return;
  const sel = feat
    ? ':scope > .claim-edge-grad[data-feat="' + feat + '"]'
    : ":scope > .claim-edge-grad";
  tile.querySelectorAll(sel).forEach((node) => node.remove());
  if (!tile.querySelector(":scope > .claim-edge-grad")) {
    tile.classList.remove("has-claim-edge");
  }
}

/** CSS angle toward a local edge (0 = up). */
const TOWARD_LOCAL_EDGE = { N: "0deg", E: "90deg", S: "180deg", W: "270deg" };

/**
 * Half of a pillar-width seam band, flush inside this tile's connecting edge.
 * Local edge follows tile rot-*. Ramp is face → 50/50 mid toward the seam so
 * partners meet cleanly without overflowing into the neighbor tile.
 */
function mountEdgeGrad(el, boardDir, faceHex, otherHex) {
  const tile = el.closest(".tile") || el;
  const rot = tileRotTurns(el);
  const localDir = String(localDirFromBoard(boardDir, rot) || "n").toUpperCase();
  const mid = "color-mix(in srgb, " + faceHex + " 50%, " + otherHex + " 50%)";
  tile.classList.add("has-claim-edge");
  const band = document.createElement("span");
  band.className = "claim-edge-grad claim-edge-" + localDir.toLowerCase();
  const feat = el.getAttribute("data-feat");
  if (feat) band.setAttribute("data-feat", feat);
  band.style.setProperty("--edge-from", faceHex);
  band.style.setProperty("--edge-to", mid);
  band.style.setProperty("--edge-grad-angle", TOWARD_LOCAL_EDGE[localDir] || "90deg");
  tile.appendChild(band);
}

function applyFeatureClaims(claims) {
  document.querySelectorAll("#grid .slot.filled").forEach((slot) => {
    const pos = slot.dataset.pos;
    if (!pos) return;
    slot.querySelectorAll("[data-feat]").forEach((el) => {
      const feat = el.getAttribute("data-feat");
      if (!feat) return;
      const claim = claims.get(pos + ":" + feat);
      el.classList.remove(
        "claim-solo", "claim-blend", "claim-half-a", "claim-half-b",
        "claim-fan", "claim-full", "claim-diag", "claim-corner",
        "claim-hub", "claim-bridge"
      );
      clearClaimEdgeGrads(el);
      el.style.removeProperty("--claim");
      el.style.removeProperty("--claim-a");
      el.style.removeProperty("--claim-b");
      el.style.removeProperty("--claim-c");
      el.style.removeProperty("--claim-mid");
      el.style.removeProperty("--claim-angle");
      el.style.removeProperty("--claim-side-angle");
      el.style.removeProperty("--claim-edge-a");
      el.style.removeProperty("--claim-edge-b");
      el.style.removeProperty("--claim-fan");
      el.style.removeProperty("--claim-fan-wall");
      if (!Carcassonne.claimColorEnabled(game.options, feat)) return;
      if (!claim || !claim.colors.length) return;

      // City odd meeting: one connected color as face + edge grads to neighbors.
      if (claim.mode === "hub") {
        const face = claim.face || claim.colors[0];
        const faceHex = CLAIM_HEX[face] || "#ff5d78";
        el.classList.add("claim-solo", "claim-hub");
        el.style.setProperty("--claim", faceHex);
        for (const bridge of claim.bridges || []) {
          const boardDir = bridge.dir;
          if (!boardDir) continue;
          const otherHex = CLAIM_HEX[bridge.color] || "#ff5d78";
          mountEdgeGrad(el, boardDir, faceHex, otherHex);
        }
        return;
      }

      // City even / hub partner: pure face + shared-edge color band.
      if (claim.mode === "bridge") {
        const face = claim.face || claim.colors[0];
        // boardDir only — never fall back to local `dir` (wrong edge when rotated).
        const boardDir = claim.boardDir;
        const faceHex = CLAIM_HEX[face] || "#ff5d78";
        const partner = claim.colors[0] === face ? claim.colors[1] : claim.colors[0];
        const otherHex = CLAIM_HEX[partner] || "#49c4ff";
        el.classList.add("claim-solo", "claim-bridge");
        el.style.setProperty("--claim", faceHex);
        if (boardDir && partner) mountEdgeGrad(el, boardDir, faceHex, otherHex);
        return;
      }

      if (claim.tie && claim.colors.length >= 2) {
        const hexA = CLAIM_HEX[claim.colors[0]] || "#ff5d78";
        const hexB = CLAIM_HEX[claim.colors[1]] || "#49c4ff";
        // Completed-feature tie: keep both hues as a flat mix (no geometry).
        if (claim.mode === "mix") {
          el.classList.add("claim-solo");
          el.style.setProperty(
            "--claim",
            "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)"
          );
          return;
        }
        el.classList.add("claim-blend");
        if (claim.mode === "half-a") {
          el.classList.add("claim-half-a");
          el.style.setProperty("--claim-a", hexA);
          el.style.setProperty("--claim-b", hexB);
          el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
          el.style.setProperty("--claim-angle", (claim.angle != null ? claim.angle : 135) + "deg");
          return;
        }
        if (claim.mode === "half-b") {
          el.classList.add("claim-half-b");
          el.style.setProperty("--claim-a", hexA);
          el.style.setProperty("--claim-b", hexB);
          el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
          el.style.setProperty("--claim-angle", (claim.angle != null ? claim.angle : 135) + "deg");
          return;
        }

        const axis = claimAxisKind(claim);
        if (claim.colors.length === 2 && (axis === "ortho" || axis === "diag")) {
          // Road odd meeting: center 0.25+0.25, edge quarters pure.
          el.classList.add("claim-full");
          if (axis === "diag") el.classList.add("claim-diag");
          el.style.setProperty("--claim-a", hexA);
          el.style.setProperty("--claim-b", hexB);
          el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
          el.style.setProperty("--claim-angle", (claim.angle != null ? claim.angle : 90) + "deg");
          if (axis === "ortho") {
            el.style.setProperty("--claim-edge-a", "25%");
            el.style.setProperty("--claim-edge-b", "75%");
          } else {
            el.style.setProperty("--claim-edge-a", "42%");
            el.style.setProperty("--claim-edge-b", "58%");
          }
          return;
        }

        // Road 3+ edges: proportional fan.
        el.classList.add("claim-fan");
        el.style.setProperty("--claim-a", hexA);
        el.style.setProperty("--claim-b", hexB);
        el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
        el.style.setProperty("--claim-fan", claimFanGradient(claim, false, 20));
        el.style.setProperty("--claim-fan-wall", claimFanGradient(claim, true, 20));
        return;
      }
      el.classList.add("claim-solo");
      el.style.setProperty("--claim", CLAIM_HEX[claim.colors[0]] || "#ff5d78");
    });
  });
}

function paintGrid() {
  const bounds = game.bounds(1);
  const lockHints = game.pendingMeeple || game.pendingConfirm || game.pendingDiscard ||
    exitConfirmOpen || humanControlsLocked();
  const hints = lockHints ? { now: [], later: [] } : game.hints();
  const now = new Set(hints.now.map((cell) => cell.x + "," + cell.y));
  const later = new Map(hints.later.map((cell) => [cell.x + "," + cell.y, cell.rots]));
  const pendingKey = game.pendingConfirm
    ? game.pendingConfirm.x + "," + game.pendingConfirm.y
    : game.pendingMeeple
      ? game.pendingMeeple.x + "," + game.pendingMeeple.y
      : null;
  const cols = bounds.maxX - bounds.minX + 1;
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = "repeat(" + cols + ", var(--cell))";
  grid.style.setProperty("--sand-min-x", String(bounds.minX));
  grid.style.setProperty("--sand-min-y", String(bounds.minY));
  const claims = Carcassonne.buildFeatureClaims(game);
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
  applyFeatureClaims(claims);
  applyCityGates(claims);
  applyRecentRings();
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
  if (game.finished || game.pendingMeeple || game.pendingConfirm || game.pendingDiscard || !game.current) return;
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
  if (button.id === "share-ranking" || button.classList.contains("js-share")) {
    openShareSheet();
    return;
  }
  if (button.id === "share-sheet-close") {
    closeShareSheet();
    return;
  }
  if (button.id === "share-native") {
    void onShareNative();
    return;
  }
  if (button.id === "share-download") {
    onShareDownload();
    return;
  }
  if (button.id === "share-copy") {
    void onShareCopyText();
    return;
  }
  if (button.id === "share-copy-url") {
    void onShareCopyUrl();
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
  if (button.id === "confirm-turn") {
    if (humanControlsLocked()) return;
    const before = game.scores.slice();
    if (game.confirmTurnEnd()) {
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
    if (game.pendingConfirm) return;
    const before = game.scores.slice();
    const color = game.players[game.pendingMeeple.player].id;
    if (game.placeMeeple(button.dataset.meepleSlot)) {
      playMeepleSound(color);
      // Confirm-style waits for OK before scoring / ending the turn.
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

const shareSheetEl = document.getElementById("share-sheet");
if (shareSheetEl) {
  shareSheetEl.addEventListener("click", (event) => {
    if (event.target.id === "share-sheet") closeShareSheet();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const sheet = document.getElementById("share-sheet");
    if (sheet && !sheet.hidden) {
      event.preventDefault();
      closeShareSheet();
      return;
    }
  }
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
  if (game.finished || game.pendingMeeple || game.pendingConfirm || game.pendingDiscard || !game.current) return;
  event.preventDefault();
  rotateClockwise();
});

document.getElementById("scroller").addEventListener("wheel", (event) => {
  event.preventDefault();
  const steps = Math.max(1, Math.min(3, Math.round(Math.abs(event.deltaY) / 100)));
  const delta = (event.deltaY > 0 ? -ZOOM_WHEEL : ZOOM_WHEEL) * steps;
  const base = zoomGoal ? zoomGoal.zoom : boardZoom;
  scheduleBoardZoom(base + delta, { x: event.clientX, y: event.clientY });
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
  scheduleBoardZoom(pinch.zoom * (dist / pinch.dist), pinchMidpoint(event.touches));
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
TileCityAudio.unlockAudio();
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
