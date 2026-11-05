import { MEEPLE_LAYOUTS } from "./game/catalog.js";
import { rotatePoint, tileHTML } from "./game/tiles.js";
import { getLang, t } from "./i18n.js";

/** Progressive play-style board: tiles carry over; captions carousel. */

function keyOf(x, y) {
  return x + "," + y;
}

const CLAIM_HEX = {
  red: "#ff5d78",
  blue: "#49c4ff",
  green: "#3dff9a",
  yellow: "#ffe14a",
  orange: "#ff9a3d",
  purple: "#7c3aed",
  white: "#f4f7fb",
  brown: "#a67c52",
};

function meepleAt(tileId, rot, slotId, color, extra) {
  const layout = MEEPLE_LAYOUTS[tileId];
  const slot = layout && layout.find((item) => item.id === slotId);
  if (!slot) return null;
  const point = rotatePoint(slot, rot || 0);
  return Object.assign(
    {
      id: slot.id,
      kind: slot.kind,
      color,
      x: point.x,
      y: point.y,
      field: slot.kind === "field",
    },
    extra || {}
  );
}

function T(x, y, id, rot, owner, meeple) {
  const tile = { x, y, id, rot: rot || 0, owner: owner || null };
  if (meeple) tile.meeple = meeple;
  return tile;
}

function claim(x, y, color, kind, feat, extra) {
  return Object.assign(
    { pos: keyOf(x, y), color: color || null, kind, feat: feat || null },
    extra || {}
  );
}

/** Monastery at (0,1) — the eight cells that can earn monastery points. */
const MONO_RING = [
  keyOf(-1, 0),
  keyOf(0, 0),
  keyOf(1, 0),
  keyOf(-1, 1),
  keyOf(1, 1),
  keyOf(-1, 2),
  keyOf(0, 2),
  keyOf(1, 2),
];

/**
 * Progressive board — fixed footprint for every step.
 *
 *   y\\x -2  -1   0   1   2   3   4   5
 *   -1        E2  A   E1  G   G   E3
 *    0   X   U   D   X   V  E1  I3  E1f
 *    1           B   U       E1  C   E3
 *    2       V2  U1  V1          E0
 */
function boardThrough3(monasteryMeeple) {
  return [
    T(0, 0, "D", 0, "red"),
    T(0, -1, "E", 2, "red"),
    T(-1, 0, "U", 1, "red"),
    T(1, 0, "X", 0, "red"),
    T(-2, 0, "X", 0, "red"),
    T(0, 1, "B", 0, "red", monasteryMeeple || null),
  ];
}

function boardThrough4(monasteryMeeple) {
  return boardThrough3(monasteryMeeple).concat([
    T(2, 0, "V", 0, "red"),
    T(2, -1, "E", 1, "red"),
    T(3, -1, "G", 0, "red"),
    T(4, -1, "G", 0, "blue"),
    T(5, -1, "E", 3, "blue"),
  ]);
}

function boardThrough5() {
  return boardThrough4(null).concat([
    T(-1, 1, "V", 0, "red"),
    T(1, 1, "U", 0, "red"),
    T(-1, 2, "V", 2, "red"),
    T(1, 2, "V", 1, "red"),
    T(0, 2, "U", 1, "red"),
  ]);
}

function boardThrough6() {
  return boardThrough5().concat([
    // I @ 270° north of C (was E@180); E@90 closes I's west city edge.
    T(4, 0, "I", 3, "red"),
    T(3, 0, "E", 1, "red"),
    T(3, 1, "E", 1, "red"),
    T(5, 1, "E", 3, "blue"),
    T(4, 2, "E", 0, "red"),
    T(4, 1, "C", 0, "red"),
  ]);
}

const CLAIMS_CITY1 = [
  claim(0, 0, "red", "city", "city-0"),
  claim(0, -1, "red", "city", "city-0"),
];
/** Only the meeple's road — not every arm of the terminal crossroads. */
const CLAIMS_ROAD1 = [
  claim(-2, 0, "red", "road", "road-1"), // X east arm
  claim(-1, 0, "red", "road", "road-0"), // U
  claim(0, 0, "red", "road", "road-0"), // D
  claim(1, 0, "red", "road", "road-3"), // X west arm
];
const CLAIMS_MONO = [claim(0, 1, "red", "monastery")];
/** Tie city: solid ends, gradient across the 2nd↔3rd tiles. */
const CLAIMS_CITY4 = [
  claim(2, -1, "red", "city", "city-0"),
  claim(3, -1, null, "city", "city-0", {
    mode: "half-a",
    colors: ["red", "blue"],
    angle: 90,
  }),
  claim(4, -1, null, "city", "city-0", {
    mode: "half-b",
    colors: ["red", "blue"],
    angle: 90,
  }),
  claim(5, -1, "blue", "city", "city-0"),
];
/** C-cluster only — I's west city + E@ (3,0) stay default. */
const CLAIMS_CITY6 = [
  claim(4, 0, "red", "city", "city-1"), // I south arm → C
  claim(3, 1, "red", "city", "city-0"),
  claim(5, 1, "red", "city", "city-0"),
  claim(4, 2, "red", "city", "city-0"),
  claim(4, 1, "red", "city", "city-0"),
];

export const STEPS = [
  {
    titleKey: "tut1Title",
    bodyKey: "tut1Body",
    scoreKey: "tut1Score",
    setup: [T(0, 0, "D", 0, "red", meepleAt("D", 0, "city-0", "red"))],
    place: T(0, -1, "E", 2, "red"),
    scores: [{ x: 0, y: 0, points: 4, color: "red", slotId: "city-0", tileId: "D", rot: 0 }],
    settled: [T(0, 0, "D", 0, "red"), T(0, -1, "E", 2, "red")],
    claims: CLAIMS_CITY1,
  },
  {
    titleKey: "tut2Title",
    bodyKey: "tut2Body",
    scoreKey: "tut2Score",
    setup: [
      T(-1, 0, "U", 1, "red", meepleAt("U", 1, "road-0", "red")),
      T(1, 0, "X", 0, "red"),
    ],
    place: T(-2, 0, "X", 0, "red"),
    scores: [{ x: -1, y: 0, points: 4, color: "red", slotId: "road-0", tileId: "U", rot: 1 }],
    settled: [
      T(0, 0, "D", 0, "red"),
      T(0, -1, "E", 2, "red"),
      T(-1, 0, "U", 1, "red"),
      T(1, 0, "X", 0, "red"),
      T(-2, 0, "X", 0, "red"),
    ],
    claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1),
  },
  {
    titleKey: "tut3Title",
    bodyKey: "tut3Body",
    scoreKey: "tut3Score",
    monoRing: true,
    setup: [],
    place: T(0, 1, "B", 0, "red", meepleAt("B", 0, "monastery", "red")),
    scores: [],
    settled: boardThrough3(meepleAt("B", 0, "monastery", "red")),
    claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1),
  },
  {
    titleKey: "tut4Title",
    bodyKey: "tut4Body",
    scoreKey: "tut4Score",
    setup: [
      T(2, 0, "V", 0, "red"),
      T(2, -1, "E", 1, "red", meepleAt("E", 1, "city-0", "red")),
      T(3, -1, "G", 0, "red"),
      T(5, -1, "E", 3, "blue", meepleAt("E", 3, "city-0", "blue")),
    ],
    place: T(4, -1, "G", 0, "blue"),
    scores: [
      { x: 2, y: -1, points: 8, color: "red", slotId: "city-0", tileId: "E", rot: 1 },
      { x: 5, y: -1, points: 8, color: "blue", slotId: "city-0", tileId: "E", rot: 3 },
    ],
    settled: boardThrough4(meepleAt("B", 0, "monastery", "red")),
    claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_CITY4),
  },
  {
    titleKey: "tut5Title",
    bodyKey: "tut5Body",
    scoreKey: "tut5Score",
    monoRing: true,
    setup: [
      T(-1, 1, "V", 0, "red"),
      T(1, 1, "U", 0, "red"),
      T(-1, 2, "V", 2, "red"),
      T(1, 2, "V", 1, "red"),
    ],
    place: T(0, 2, "U", 1, "red"),
    scores: [{ x: 0, y: 1, points: 9, color: "red", slotId: "monastery", tileId: "B", rot: 0 }],
    settled: boardThrough5(),
    claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_MONO, CLAIMS_CITY4),
  },
  {
    titleKey: "tut6Title",
    bodyKey: "tut6Body",
    scoreKey: "tut6Score",
    setup: [
      T(4, 0, "I", 3, "red"),
      T(3, 0, "E", 1, "red"),
      T(3, 1, "E", 1, "red", meepleAt("E", 1, "city-0", "red")),
      T(5, 1, "E", 3, "blue", meepleAt("E", 3, "city-0", "blue")),
      T(4, 2, "E", 0, "red", meepleAt("E", 0, "city-0", "red")),
    ],
    place: T(4, 1, "C", 0, "red"),
    scores: [
      { x: 3, y: 1, points: 12, color: "red", slotId: "city-0", tileId: "E", rot: 1 },
      { x: 4, y: 2, points: 12, color: "red", slotId: "city-0", tileId: "E", rot: 0 },
      { x: 5, y: 1, points: 0, color: "blue", slotId: "city-0", tileId: "E", rot: 3, dim: true },
    ],
    settled: boardThrough6(),
    claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_MONO, CLAIMS_CITY4, CLAIMS_CITY6),
  },
  {
    titleKey: "tut7Title",
    bodyKey: "tut7Body",
    scoreKey: "tut7Score",
    endField: true,
    setup: [
      T(1, -1, "A", 0, "red"),
      T(5, 0, "E", 1, "red", meepleAt("E", 1, "field-0", "red", { earned: 9, stay: true })),
    ],
    place: null,
    scores: [],
    settled: boardThrough6().concat([
      T(1, -1, "A", 0, "red"),
      T(5, 0, "E", 1, "red", meepleAt("E", 1, "field-0", "red", { earned: 9, stay: true })),
    ]),
    claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_MONO, CLAIMS_CITY4, CLAIMS_CITY6),
  },
];

function cloneTile(tile) {
  if (!tile) return null;
  const next = {
    x: tile.x,
    y: tile.y,
    id: tile.id,
    rot: tile.rot || 0,
    owner: tile.owner || null,
  };
  if (tile.meeple) next.meeple = Object.assign({}, tile.meeple);
  return next;
}

function boardMap(tiles) {
  const map = new Map();
  tiles.forEach((tile) => map.set(keyOf(tile.x, tile.y), cloneTile(tile)));
  return map;
}

function previousSettled(index) {
  if (index <= 0) return [];
  return STEPS[index - 1].settled || [];
}

function boundsFor(tiles) {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  if (!tiles.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  tiles.forEach((tile) => {
    minX = Math.min(minX, tile.x);
    maxX = Math.max(maxX, tile.x);
    minY = Math.min(minY, tile.y);
    maxY = Math.max(maxY, tile.y);
  });
  return { minX, maxX, minY, maxY };
}

/** Final board footprint — keep every step on the same grid so tiles never shift. */
const BOARD_BOUNDS = boundsFor(STEPS[STEPS.length - 1].settled || []);

function pinHTML(meeple, leaving) {
  if (!meeple) return "";
  const fieldClass = meeple.field || meeple.kind === "field" ? " field-meeple" : "";
  let earned = "";
  if (meeple.earned != null && meeple.earned !== 0) {
    const dim = meeple.earnedDim ? " sub" : "";
    const color = meeple.color ? " " + meeple.color : "";
    earned =
      '<span class="meeple-earned' +
      color +
      dim +
      '">' +
      (meeple.earnedDim ? String(meeple.earned) : "+" + meeple.earned) +
      "</span>";
  }
  return (
    '<span class="meeple-pin' +
    (leaving ? " leaving" : "") +
    '" style="left:' +
    meeple.x * 100 +
    "%;top:" +
    meeple.y * 100 +
    '%">' +
    '<i class="meeple on-tile ' +
    meeple.color +
    fieldClass +
    '" aria-hidden="true"></i>' +
    earned +
    "</span>"
  );
}

function fitAndCenterBoard(host) {
  const scroller = host.closest(".scroller");
  const board = host.closest(".rules-board");
  const grid = host.querySelector(".board-grid");
  if (!scroller || !board || !grid) return;

  // Restore stylesheet zoom, then shrink only if the fixed footprint overflows.
  board.style.removeProperty("--board-zoom");
  const base =
    parseFloat(getComputedStyle(board).getPropertyValue("--board-zoom")) || 0.48;
  const availW = Math.max(0, scroller.clientWidth - 4);
  const availH = Math.max(0, scroller.clientHeight - 4);
  const needW = grid.offsetWidth;
  const needH = grid.offsetHeight;
  let zoom = base;
  if (needW > availW && needW > 0) zoom = Math.min(zoom, base * (availW / needW));
  if (needH > availH && needH > 0) zoom = Math.min(zoom, base * (availH / needH));
  zoom = Math.max(0.2, Math.min(base, zoom * 0.98));
  if (Math.abs(zoom - base) > 0.001) {
    board.style.setProperty("--board-zoom", String(zoom));
  }

  scroller.scrollLeft = Math.max(0, (grid.offsetWidth - scroller.clientWidth) / 2);
  scroller.scrollTop = Math.max(0, (grid.offsetHeight - scroller.clientHeight) / 2);
}

function claimSelector(kind, feat) {
  let base = ".city";
  if (kind === "road") base = ".road, .bend, i.road, i.bend";
  else if (kind === "monastery") base = ".monastery";
  if (!feat) return base;
  return base
    .split(",")
    .map((part) => part.trim() + '[data-feat="' + feat + '"]')
    .join(", ");
}

function applyClaims(host, claims) {
  (claims || []).forEach((item) => {
    const slot = host.querySelector('.slot[data-pos="' + item.pos + '"]');
    if (!slot) return;
    const els = slot.querySelectorAll(claimSelector(item.kind, item.feat));
    if (!els.length) return;
    if (item.mode === "half-a" || item.mode === "half-b") {
      const colors = item.colors || [];
      const hexA = CLAIM_HEX[colors[0]] || CLAIM_HEX.red;
      const hexB = CLAIM_HEX[colors[1]] || CLAIM_HEX.blue;
      const mid = "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)";
      const angle = (item.angle != null ? item.angle : 90) + "deg";
      els.forEach((el) => {
        el.classList.add("claim-blend", "claim-" + item.mode);
        el.style.setProperty("--claim-a", hexA);
        el.style.setProperty("--claim-b", hexB);
        el.style.setProperty("--claim-mid", mid);
        el.style.setProperty("--claim-angle", angle);
      });
      return;
    }
    const hex = CLAIM_HEX[item.color] || CLAIM_HEX.red;
    els.forEach((el) => {
      el.classList.add("claim-solo");
      el.style.setProperty("--claim", hex);
    });
  });
}

function renderGrid(host, tiles, opts) {
  const options = opts || {};
  const recentKey = options.recentKey || null;
  const placingKey = options.placingKey || null;
  const hintKey = options.hintKey || null;
  const leavePins = options.leavePins || [];
  const monoRing = options.monoRing ? new Set(MONO_RING) : null;
  const bounds = BOARD_BOUNDS;
  const cols = bounds.maxX - bounds.minX + 1;
  const grid = document.createElement("div");
  grid.className = "board-grid";
  grid.style.gridTemplateColumns = "repeat(" + cols + ", var(--cell))";
  grid.style.setProperty("--sand-min-x", String(bounds.minX));
  grid.style.setProperty("--sand-min-y", String(bounds.minY));

  const byKey = boardMap(tiles);
  const parts = [];
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const pos = keyOf(x, y);
      const tile = byKey.get(pos);
      const mono = monoRing && monoRing.has(pos) ? " mono-ring" : "";
      if (tile) {
        const owner = tile.owner ? " owner-" + tile.owner : "";
        const recent = recentKey === pos ? " recent" : "";
        const placing = placingKey === pos ? " is-placing" : "";
        let marks = pinHTML(tile.meeple, false);
        leavePins
          .filter((pin) => pin.pos === pos)
          .forEach((pin) => {
            marks += pinHTML(pin.meeple, true);
          });
        const ring = recent ? '<span class="recent-ring" aria-hidden="true"></span>' : "";
        parts.push(
          '<div class="slot filled' +
            owner +
            recent +
            placing +
            mono +
            '" data-pos="' +
            pos +
            '"><div class="scaler">' +
            tileHTML(tile.id, tile.rot) +
            "</div>" +
            marks +
            ring +
            "</div>"
        );
        continue;
      }
      if (hintKey === pos) {
        parts.push('<div class="slot empty hint-now' + mono + '" data-pos="' + pos + '"></div>');
        continue;
      }
      parts.push('<div class="slot empty' + mono + '" data-pos="' + pos + '"></div>');
    }
  }
  grid.innerHTML = parts.join("");
  host.innerHTML = "";
  host.appendChild(grid);
  if (options.claims) applyClaims(host, options.claims);
  fitAndCenterBoard(host);
}

function mergeTiles(base, extra) {
  const map = boardMap(base);
  (extra || []).forEach((tile) => map.set(keyOf(tile.x, tile.y), cloneTile(tile)));
  return Array.from(map.values());
}

function leavePinsFor(scores) {
  return (scores || [])
    .map((score) => {
      const m = meepleAt(score.tileId, score.rot, score.slotId, score.color, {
        earned: score.points,
        dim: score.dim,
        earnedDim: score.dim,
      });
      if (!m) return null;
      return { pos: keyOf(score.x, score.y), meeple: m };
    })
    .filter(Boolean);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bindTutorial(root) {
  const stage = root.querySelector("[data-tutorial]");
  if (!stage) return null;

  const boardHost = stage.querySelector("[data-tutorial-board]");
  const titleEl = stage.querySelector("[data-tutorial-title]");
  const bodyEl = stage.querySelector("[data-tutorial-body]");
  const scoreEl = stage.querySelector("[data-tutorial-score]");
  const stepEl = stage.querySelector("[data-tutorial-step]");
  const dotsEl = stage.querySelector("[data-tutorial-dots]");
  const prevBtn = stage.querySelector("[data-tutorial-prev]");
  const nextBtn = stage.querySelector("[data-tutorial-next]");

  let index = 0;
  let timers = [];
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {}

  function clearTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function stepOpts(extra) {
    const step = STEPS[index];
    return Object.assign(
      {
        monoRing: !!step.monoRing,
        claims: step.claims || null,
      },
      extra || {}
    );
  }

  function paintCopy() {
    const step = STEPS[index];
    const lang = getLang();
    if (stepEl) stepEl.textContent = t("tutStep", lang, { n: index + 1, total: STEPS.length });
    if (titleEl) titleEl.textContent = t(step.titleKey, lang);
    if (bodyEl) bodyEl.textContent = t(step.bodyKey, lang);
    if (scoreEl) {
      const text = step.scoreKey ? t(step.scoreKey, lang) : "";
      const chips = (step.scores || []).filter((s) => s.points);
      const chipColors = new Set(chips.map((s) => s.color));
      const showChips = chipColors.size > 1;
      if (!text && !showChips) {
        scoreEl.hidden = true;
        scoreEl.innerHTML = "";
      } else {
        scoreEl.hidden = false;
        let html = text ? '<span class="tut-score-text">' + escapeHtml(text) + "</span>" : "";
        if (showChips) {
          chips.forEach((s) => {
            html +=
              '<span class="tut-score-chip ' +
              s.color +
              (s.dim ? " sub" : "") +
              '">' +
              (s.dim ? String(s.points) : "+" + s.points) +
              "</span>";
          });
        }
        scoreEl.innerHTML = html;
      }
    }
    if (dotsEl) {
      dotsEl.querySelectorAll("button").forEach((btn, i) => {
        const on = i === index;
        btn.classList.toggle("on", on);
        if (on) btn.setAttribute("aria-current", "true");
        else btn.removeAttribute("aria-current");
      });
    }
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === STEPS.length - 1;
  }

  function showSettled() {
    renderGrid(boardHost, STEPS[index].settled || [], stepOpts());
  }

  function scheduleLoop(delay) {
    later(() => playStep(true), delay == null ? 1800 : delay);
  }

  function playStep(animate) {
    clearTimers();
    paintCopy();
    const step = STEPS[index];
    const base = previousSettled(index);
    const withSetup = mergeTiles(base, step.setup);
    // During animation, show prior step claims until settle.
    const priorClaims = index > 0 ? STEPS[index - 1].claims : null;

    if (!animate || reduced) {
      showSettled();
      scheduleLoop(reduced ? 3200 : 2200);
      return;
    }

    if (step.place) {
      renderGrid(
        boardHost,
        withSetup,
        stepOpts({ hintKey: keyOf(step.place.x, step.place.y), claims: priorClaims })
      );
    } else if (step.endField) {
      renderGrid(boardHost, base, stepOpts({ claims: priorClaims }));
    } else {
      renderGrid(boardHost, base, stepOpts({ claims: priorClaims }));
    }

    later(() => {
      if (step.place) {
        const placed = mergeTiles(withSetup, [step.place]);
        const placeKey = keyOf(step.place.x, step.place.y);
        renderGrid(
          boardHost,
          placed,
          stepOpts({ recentKey: placeKey, placingKey: placeKey, claims: priorClaims })
        );
        later(() => {
          if (step.scores && step.scores.length) {
            const scored = new Set(step.scores.map((s) => keyOf(s.x, s.y)));
            const during = placed.map((tile) => {
              const copy = cloneTile(tile);
              if (scored.has(keyOf(copy.x, copy.y))) copy.meeple = null;
              return copy;
            });
            renderGrid(boardHost, during, {
              ...stepOpts(),
              recentKey: placeKey,
              leavePins: leavePinsFor(step.scores),
              claims: step.claims || priorClaims,
            });
            later(() => {
              showSettled();
              scheduleLoop(1600);
            }, 2000);
          } else {
            later(() => {
              showSettled();
              scheduleLoop(1600);
            }, 900);
          }
        }, 550);
      } else if (step.endField) {
        renderGrid(boardHost, step.settled || [], stepOpts());
        scheduleLoop(2800);
      } else {
        showSettled();
        scheduleLoop(1800);
      }
    }, step.place ? 700 : 500);
  }

  function go(to, animate) {
    index = Math.max(0, Math.min(STEPS.length - 1, to));
    playStep(animate !== false);
  }

  if (dotsEl) {
    dotsEl.innerHTML = STEPS.map((_, i) => {
      return '<button type="button" data-tut-dot="' + i + '" aria-label="' + (i + 1) + '"></button>';
    }).join("");
    dotsEl.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-tut-dot]");
      if (!btn) return;
      go(Number(btn.getAttribute("data-tut-dot")), true);
    });
  }

  if (prevBtn) prevBtn.addEventListener("click", () => go(index - 1, true));
  if (nextBtn) nextBtn.addEventListener("click", () => go(index + 1, true));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimers();
    else playStep(true);
  });

  let resizeTimer = 0;
  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (boardHost.isConnected) fitAndCenterBoard(boardHost);
    }, 120);
  }
  window.addEventListener("resize", onResize);

  go(0, true);

  return {
    refresh() {
      paintCopy();
    },
    destroy() {
      clearTimers();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    },
  };
}
