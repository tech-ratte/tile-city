/** First-player name roulette for new games. */

import TileCityAudio from "../audio.js";

const START_TICKS = { thr: 0.05, minGap: 0.04 };
// lead: pull name flips slightly ahead of RMS peaks (peaks sit after click onset).
const SLOW_TICKS = { thr: 0.09, minGap: 0.12, lead: 0.3 };
const START_DURATION_FALLBACK = 2.7;

/** Fallback flip times when audio decode/tick detection fails. */
function fallbackTicks(durationSec, kind) {
  const dur = Math.max(0.4, durationSec || (kind === "slow" ? 2.9 : START_DURATION_FALLBACK));
  const times = [];
  if (kind === "slow") {
    let t = 0.05;
    let gap = 0.12;
    while (t < dur - 0.05) {
      times.push(t);
      gap = Math.min(0.75, gap * 1.28);
      t += gap;
    }
    if (!times.length) times.push(dur * 0.5);
    return times;
  }
  for (let t = 0.02; t < dur - 0.05; t += 0.052) times.push(t);
  return times;
}

function hexFor(palette, id) {
  const hit = palette.find((item) => item.id === id);
  return hit ? hit.hex : "#f4f7fb";
}

export function openFirstRoulette(opts) {
  const {
    overlay,
    players,
    winner,
    palette,
    nameOf,
    t,
    onSpin,
    onDone,
  } = opts;
  if (!overlay || !players || !players.length) {
    if (typeof onDone === "function") onDone();
    return { close() {} };
  }

  const nameEl = overlay.querySelector("#roulette-name");
  const result = overlay.querySelector("#roulette-result");
  const actionBtn = overlay.querySelector("#roulette-action");
  if (!nameEl || !actionBtn) {
    if (typeof onDone === "function") onDone();
    return { close() {} };
  }

  const startSrc = TileCityAudio.SOUNDS.rouletteStart;
  const slowSrc = TileCityAudio.SOUNDS.rouletteSlow;
  const stopSrc = TileCityAudio.SOUNDS.rouletteStop;

  let spinning = false;
  let decided = false;
  let finished = false;
  let startDuration = START_DURATION_FALLBACK;
  let startTicks = fallbackTicks(startDuration, "start");
  let slowTicks = fallbackTicks(2.9, "slow");

  // Warm decode/HTML cache while the dialog is visible (before the Start tap).
  TileCityAudio.preloadSounds([startSrc, slowSrc, stopSrc]);
  void (async () => {
    const detectedStart = await TileCityAudio.peekTicks(startSrc, START_TICKS);
    const detectedSlow = await TileCityAudio.peekTicks(slowSrc, SLOW_TICKS);
    if (detectedStart.length) startTicks = detectedStart;
    if (detectedSlow.length) slowTicks = detectedSlow;
    const dur = TileCityAudio.getSoundDuration(startSrc);
    if (dur && dur > 0) startDuration = dur;
  })();

  function paintName(index) {
    const player = players[((index % players.length) + players.length) % players.length];
    nameEl.textContent = nameOf(player);
    nameEl.style.color = "";
    nameEl.className = "roulette-name " + player.id;
  }

  paintName(0);
  if (result) {
    result.hidden = true;
    result.textContent = "";
  }
  actionBtn.hidden = false;
  actionBtn.disabled = false;
  actionBtn.dataset.phase = "start";
  actionBtn.textContent = t("rouletteStart");
  overlay.hidden = false;
  overlay.removeAttribute("hidden");

  function finish() {
    if (finished) return;
    finished = true;
    overlay.hidden = true;
    overlay.setAttribute("hidden", "");
    if (typeof onDone === "function") onDone();
  }

  function reveal() {
    spinning = false;
    decided = true;
    paintName(winner);
    const player = players[winner];
    if (result) {
      result.hidden = false;
      result.innerHTML =
        '<span class="roulette-winner-swatch ' +
        player.id +
        '" style="--ink:' +
        hexFor(palette, player.id) +
        '"></span>' +
        "<strong>" +
        nameOf(player) +
        "</strong> " +
        t("rouletteGoesFirst");
    }
    // stop plays together with the "goes first" reveal.
    TileCityAudio.playSound("rouletteStop");
    actionBtn.disabled = false;
    actionBtn.dataset.phase = "ok";
    actionBtn.textContent = t("ok");
    actionBtn.focus();
  }

  async function runSpin() {
    if (spinning || finished || decided) return;
    spinning = true;
    actionBtn.disabled = true;
    if (typeof onSpin === "function") onSpin();
    // Kick AudioContext resume inside the tap gesture (do not await network first).
    void TileCityAudio.unlockAudio();
    if (result) {
      result.hidden = true;
      result.textContent = "";
    }

    // Play only the first half of start before moving to slow.
    const halfStart = Math.max(0.35, startDuration * 0.5);
    const startTicksHalf = startTicks.filter((at) => at < halfStart);
    const activeStartTicks = startTicksHalf.length
      ? startTicksHalf
      : fallbackTicks(halfStart, "start");

    const n = players.length;
    const total = Math.max(1, activeStartTicks.length + slowTicks.length);
    let flip = 0;
    const offset = ((winner - (total - 1)) % n + n) % n;
    const onTick = () => {
      paintName(offset + flip);
      flip += 1;
    };

    await TileCityAudio.playWithTicks(
      startSrc,
      Object.assign({}, START_TICKS, { maxPlaySec: halfStart }),
      onTick,
      activeStartTicks
    );
    if (finished) return;
    await TileCityAudio.playWithTicks(slowSrc, SLOW_TICKS, onTick, slowTicks);
    if (finished) return;

    paintName(winner);
    reveal();
  }

  actionBtn.addEventListener("click", () => {
    if (actionBtn.dataset.phase === "ok") finish();
    else void runSpin();
  });

  return {
    close: finish,
    isOpen: () => !overlay.hidden,
  };
}
