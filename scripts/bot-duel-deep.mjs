/**
 * Deeper master-vs-standard weakness probe.
 * Focus: when they disagree, which move actually yields more end points from that state?
 */
import { createGame } from "../js/game/engine.js";
import { chooseBotAction, BOT_WEIGHTS, turnsAfterThis, cloneGame } from "../js/game/bot.js";
import {
  analyzeClosability,
  deckSupply,
  listIncompleteCities,
  masterExtraScore,
  scoreLag,
  closeChancePaths,
} from "../js/game/botMaster.js";
import { finalizeScores } from "../js/game/scoring.js";
import { absDir, findCityIndexByAbsEdge } from "../js/game/features.js";
import { DIR_INDEX, NEI, OPP_DIR } from "../js/game/constants.js";
import { keyOf } from "../js/game/tiles.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function countOpenEdges(board, kind, parts) {
  let open = 0;
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile || kind !== "city") {
      open += 1;
      continue;
    }
    const rot = tile.rot || 0;
    const city = tile.cities && tile.cities[part.index];
    if (!city) {
      open += 1;
      continue;
    }
    for (const catalogDir of city.edges) {
      const dir = absDir(catalogDir, rot);
      const step = NEI[DIR_INDEX[dir]];
      const neighbor = board.get(keyOf(part.x + step.dx, part.y + step.dy));
      if (!neighbor || findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) < 0) open += 1;
    }
  }
  return open;
}

function applyAction(game, action) {
  if (!action) return false;
  if (action.type === "meeple") {
    if (action.slotId) return !!game.placeMeeple(action.slotId);
    return !!game.skipMeeple();
  }
  if (action.type === "place") {
    game.setRotation(action.rot);
    if (!game.place(action.x, action.y)) return false;
    if (action.slotId) {
      if (!game.placeMeeple(action.slotId)) return !!game.skipMeeple();
      return true;
    }
    return !!game.skipMeeple();
  }
  return false;
}

function finishGameFrom(game, strengthFor) {
  const g = cloneGame(game);
  let guard = 0;
  while (!g.finished && ++guard < 200) {
    while (g.pendingDiscard) g.acknowledgeDiscard();
    if (g.finished) break;
    if (g.pendingMeeple) {
      const me = g.pendingMeeple.player;
      const a = chooseBotAction(g, strengthFor(me));
      if (!applyAction(g, a || { type: "meeple", slotId: null })) break;
      continue;
    }
    if (!g.current) break;
    const me = g.player;
    const a = chooseBotAction(g, strengthFor(me));
    if (!applyAction(g, a)) break;
  }
  if (!g.finalScored) finalizeScores(g);
  return g.scores.slice();
}

function playFast(seed, masterSeat) {
  const players = [
    { id: "red", name: "A", bot: true, botStrength: masterSeat === 0 ? "master" : "standard" },
    { id: "blue", name: "B", bot: true, botStrength: masterSeat === 1 ? "master" : "standard" },
  ];
  const game = createGame(mulberry32(seed), players);
  let guard = 0;
  while (!game.finished && ++guard < 200) {
    while (game.pendingDiscard) game.acknowledgeDiscard();
    if (game.finished) break;
    if (game.pendingMeeple) {
      const me = game.pendingMeeple.player;
      const a = chooseBotAction(game, game.players[me].botStrength);
      if (!applyAction(game, a || { type: "meeple", slotId: null })) break;
      continue;
    }
    if (!game.current) break;
    const a = chooseBotAction(game, game.players[game.player].botStrength);
    if (!applyAction(game, a)) break;
  }
  if (!game.finalScored) finalizeScores(game);
  const m = masterSeat;
  return {
    win: game.scores[m] > game.scores[1 - m] ? 1 : game.scores[m] < game.scores[1 - m] ? 0 : 0.5,
    diff: game.scores[m] - game.scores[1 - m],
    masterScore: game.scores[m],
    stdScore: game.scores[1 - m],
  };
}

const GAMES = Number(process.argv[2]) || 80;
const results = [];
for (let i = 0; i < GAMES; i++) {
  results.push(playFast(3000 + i * 19, i % 2));
  if ((i + 1) % 20 === 0) process.stderr.write(`fast ${i + 1}/${GAMES}\n`);
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(
  JSON.stringify(
    {
      games: GAMES,
      masterWinRate: +mean(results.map((r) => r.win)).toFixed(3),
      avgDiff: +mean(results.map((r) => r.diff)).toFixed(2),
      avgMaster: +mean(results.map((r) => r.masterScore)).toFixed(2),
      avgStd: +mean(results.map((r) => r.stdScore)).toFixed(2),
    },
    null,
    2
  )
);

// Disagreement rollout: from std-played positions, if std≠master pick,
// finish both lines with STANDARD thereafter (isolates one-move error).
process.stderr.write("disagreement rollouts...\n");
const roll = {
  n: 0,
  masterMoveBetter: 0,
  stdMoveBetter: 0,
  tie: 0,
  avgSwingIfMasterWrong: 0,
  swings: [],
  cases: [],
};

for (let i = 0; i < 35; i++) {
  const seed = 7000 + i * 41;
  const game = createGame(mulberry32(seed), [
    { id: "red", name: "S0", bot: true, botStrength: "standard" },
    { id: "blue", name: "S1", bot: true, botStrength: "standard" },
  ]);
  let steps = 0;
  while (!game.finished && steps < 35) {
    steps += 1;
    while (game.pendingDiscard) game.acknowledgeDiscard();
    if (game.finished || !game.current || game.pendingMeeple) {
      if (game.pendingMeeple) {
        const a = chooseBotAction(game, "standard");
        applyAction(game, a || { type: "meeple", slotId: null });
      }
      continue;
    }
    if (game.deck.length <= 48 && game.deck.length >= 18 && steps % 4 === 0) {
      const me = game.player;
      const std = chooseBotAction(game, "standard");
      const mas = chooseBotAction(game, "master");
      if (
        roll.n < 28 &&
        std &&
        mas &&
        std.type === "place" &&
        mas.type === "place" &&
        (std.x !== mas.x || std.y !== mas.y || std.rot !== mas.rot || std.slotId !== mas.slotId)
      ) {
        const afterStd = cloneGame(game);
        const afterMas = cloneGame(game);
        applyAction(afterStd, std);
        applyAction(afterMas, mas);
        // Both continue as standard — measures one-move quality
        const scoresStd = finishGameFrom(afterStd, () => "standard");
        const scoresMas = finishGameFrom(afterMas, () => "standard");
        const stdLine = scoresStd[me] - scoresStd[1 - me];
        const masLine = scoresMas[me] - scoresMas[1 - me];
        const swing = masLine - stdLine;
        roll.n += 1;
        roll.swings.push(swing);
        if (swing > 0.5) roll.masterMoveBetter += 1;
        else if (swing < -0.5) roll.stdMoveBetter += 1;
        else roll.tie += 1;

        const extra = masterExtraScore({
          before: game,
          after: afterMas,
          me,
          weights: BOT_WEIGHTS.master,
          placed: { x: mas.x, y: mas.y },
          countOpenEdges,
          turnsAfter: turnsAfterThis(game, me),
        });
        const lag = scoreLag(game.scores, me, 10);
        if (roll.cases.length < 8) {
          roll.cases.push({
            seed,
            deck: game.deck.length,
            scores: game.scores.slice(),
            me,
            swing: +swing.toFixed(1),
            masterExtra: +extra.toFixed(2),
            lag: +lag.toFixed(2),
            stdSlot: std.slotId,
            masSlot: mas.slotId,
            sameCell: std.x === mas.x && std.y === mas.y && std.rot === mas.rot,
          });
        }
      }
    }
    const action = chooseBotAction(game, "standard");
    if (!applyAction(game, action)) break;
  }
}

roll.avgSwing = roll.swings.length ? +mean(roll.swings).toFixed(2) : 0;
roll.masterMoveBetterRate = roll.n ? +(roll.masterMoveBetter / roll.n).toFixed(3) : 0;
console.log("\n=== ONE-MOVE ROLLOUT (disagree → both finish as standard) ===");
console.log(JSON.stringify(roll, null, 2));

// Catalog-true dead claims during mid game by master
process.stderr.write("dead-claim midgame scan...\n");
let midImpossibleClaims = 0;
let midClaims = 0;
for (let i = 0; i < 20; i++) {
  const game = createGame(mulberry32(11000 + i), [
    { id: "red", name: "M", bot: true, botStrength: "master" },
    { id: "blue", name: "S", bot: true, botStrength: "standard" },
  ]);
  let steps = 0;
  while (!game.finished && steps < 40) {
    steps += 1;
    while (game.pendingDiscard) game.acknowledgeDiscard();
    if (game.finished) break;
    if (game.pendingMeeple) {
      const me = game.pendingMeeple.player;
      const a = chooseBotAction(game, game.players[me].botStrength);
      applyAction(game, a || { type: "meeple", slotId: null });
      continue;
    }
    if (!game.current) break;
    const me = game.player;
    const before = cloneGame(game);
    const a = chooseBotAction(game, game.players[me].botStrength);
    if (!applyAction(game, a)) break;
    if (game.players[me].botStrength === "master" && a && a.slotId && String(a.slotId).startsWith("city")) {
      midClaims += 1;
      const cities = listIncompleteCities(game.board, 2, countOpenEdges);
      const supply = deckSupply(game);
      for (const c of cities) {
        if (!c.winners.includes(me)) continue;
        const an = analyzeClosability(game.board, "city", c.parts, supply);
        if (an.impossible && (an.reason === "catalog" || an.reason === "blocked")) {
          midImpossibleClaims += 1;
          break;
        }
      }
    }
    void before;
  }
}
console.log("\n=== MASTER CITY CLAIMS THAT ARE CATALOG-IMPOSSIBLE (mid) ===");
console.log(JSON.stringify({ midClaims, midImpossibleClaims }, null, 2));
