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

(function bindAddHome() {
  const home = document.querySelector(".home");
  const openBtn = document.querySelector(".add-home");
  const dialog = document.getElementById("add-home-dialog");
  if (!openBtn || !dialog || typeof dialog.showModal !== "function") return;

  const tabs = Array.from(dialog.querySelectorAll(".add-home-tabs [role='tab']"));
  const panes = Array.from(dialog.querySelectorAll(".add-home-pane"));

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (home && standalone) home.classList.add("is-standalone");

  function detectPlatform() {
    const ua = navigator.userAgent || "";
    const iPadOs =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua) || iPadOs) return "ios";
    return "ios";
  }

  function setPlatform(platform) {
    const next = platform === "android" ? "android" : "ios";
    tabs.forEach((tab) => {
      const selected = tab.getAttribute("data-platform") === next;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });
    panes.forEach((pane) => {
      pane.hidden = pane.getAttribute("data-platform") !== next;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setPlatform(tab.getAttribute("data-platform"));
    });
  });

  openBtn.addEventListener("click", () => {
    if (dialog.open) return;
    setPlatform(detectPlatform());
    dialog.showModal();
  });

  dialog.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => dialog.close());
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
