/**
 * Meeple-conflict claim scenes: shared fixtures for unit tests.
 * Each scene lists board placements (id, rot, optional meeple color) and
 * expected claim modes/colors so layouts stay reviewable in one place.
 */
import { COLOR_PALETTE } from "./game/constants.js";
import { makeTile } from "./game/tiles.js";

export const CLAIM_SCENE_PLAYERS = COLOR_PALETTE.map((color) => ({
  id: color.id,
  name: color.label,
  bot: false,
}));

export const CLAIM_SCENE_PI = Object.fromEntries(
  COLOR_PALETTE.map((color, index) => [color.id, index])
);

/** @param {{ id: string, rot?: number, meeple?: string|null, meepleKind?: string, meepleIndex?: number|null }} cell */
export function placedFromScene(cell) {
  const tile = makeTile(cell.id);
  tile.rot = cell.rot || 0;
  tile.owner = cell.meeple || "red";
  tile.meeple = null;
  if (cell.meeple) {
    const kind = cell.meepleKind || (tile.cities && tile.cities.length ? "city" : tile.roads && tile.roads.length ? "road" : "monastery");
    const index = cell.meepleIndex !== undefined
      ? cell.meepleIndex
      : kind === "monastery"
        ? null
        : 0;
    const layoutY = kind === "city" ? 0.18 : kind === "monastery" ? 0.4 : 0.5;
    tile.meeple = {
      player: CLAIM_SCENE_PI[cell.meeple],
      color: cell.meeple,
      slot: kind === "monastery" ? "monastery" : kind + "-" + index,
      kind: kind,
      index: index,
      x: 0.5,
      y: layoutY,
    };
  }
  return tile;
}

export function applyClaimScene(game, scene) {
  game.board.clear();
  game.players = CLAIM_SCENE_PLAYERS.slice();
  for (const cell of scene.tiles) {
    game.board.set(cell.x + "," + cell.y, placedFromScene(cell));
  }
}

/**
 * ascii: optional board sketch for humans (not parsed).
 * expect: map key "x,y:feat" -> { mode?, colors?, tie?, face? }
 *   mode "solo" means tie===false and colors length 1.
 */
export const CLAIM_SCENES = [
  {
    id: "road-even-adjacent",
    title: "道 偶数境界（隣接ミープル）0.25+0.25",
    ascii: `
      U(red)
      U(blue)
    `,
    tiles: [
      { x: 0, y: 0, id: "U", rot: 0, meeple: "red", meepleKind: "road" },
      { x: 0, y: 1, id: "U", rot: 0, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "half-a", colors: ["red", "blue"] },
      "0,1:road-0": { mode: "half-b", colors: ["red", "blue"] },
    },
  },
  {
    id: "road-odd-five",
    title: "道 奇数会合（5タイル中央）0.25+0.25",
    ascii: `
      U(red) U · U · U(blue)
    `,
    tiles: [
      { x: 0, y: 0, id: "U", rot: 0, meeple: "red", meepleKind: "road" },
      { x: 0, y: 1, id: "U", rot: 0 },
      { x: 0, y: 2, id: "U", rot: 0 },
      { x: 0, y: 3, id: "U", rot: 0 },
      { x: 0, y: 4, id: "U", rot: 0, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "solo", colors: ["red"] },
      "0,1:road-0": { mode: "solo", colors: ["red"] },
      "0,2:road-0": { mode: "full", colors: ["red", "blue"] },
      "0,3:road-0": { mode: "solo", colors: ["blue"] },
      "0,4:road-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "city-odd-bar",
    title: "都市 奇数会合 → hub + 川橋",
    ascii: `
      E(blue@E) — F — E(red@W)
    `,
    tiles: [
      { x: 0, y: 0, id: "F", rot: 0 },
      { x: -1, y: 0, id: "E", rot: 1, meeple: "blue" },
      { x: 1, y: 0, id: "E", rot: 3, meeple: "red" },
    ],
    expect: {
      "-1,0:city-0": { mode: "bridge", face: "blue" },
      "1,0:city-0": { mode: "bridge", face: "red" },
      "0,0:city-0": { mode: "hub", colors: ["blue", "red"] },
    },
  },
  {
    id: "diag-elbow-second-tile",
    title: "斜め都市が互いに2枚目 — hub、ミープルはソリッド",
    ascii: `
           E(red@S)
               |
           N(hub) — E(blue@W)
    `,
    tiles: [
      { x: 0, y: 0, id: "N", rot: 0 },
      { x: 0, y: -1, id: "E", rot: 2, meeple: "red" },
      { x: 1, y: 0, id: "E", rot: 3, meeple: "blue" },
    ],
    expect: {
      "0,0:city-0": { mode: "hub", colors: ["blue", "red"] },
      "0,-1:city-0": { mode: "bridge", face: "red" },
      "1,0:city-0": { mode: "bridge", face: "blue" },
    },
  },
  {
    id: "diag-nn-second-frontier",
    title: "斜め都市どうしが2枚目で接続 — bridge、キャップは純色",
    ascii: `
      E(red@S)
          |
      N(bridge) — N(bridge)
                      |
                  E(blue@N)
    `,
    tiles: [
      { x: 0, y: -1, id: "E", rot: 2, meeple: "red" },
      { x: 0, y: 0, id: "N", rot: 0 },
      { x: 1, y: 0, id: "N", rot: 2 },
      { x: 1, y: 1, id: "E", rot: 0, meeple: "blue" },
    ],
    expect: {
      "0,0:city-0": { mode: "bridge", face: "red", colors: ["red", "blue"] },
      "1,0:city-0": { mode: "bridge", face: "blue", colors: ["blue", "red"] },
      "0,-1:city-0": { mode: "solo", colors: ["red"] },
      "1,1:city-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "rr-ee-bridge",
    title: "R|R 偶数境界は bridge、E キャップは純色",
    ascii: `
      E(red) E(blue)
      R      R@270
    `,
    tiles: [
      { x: 0, y: -1, id: "E", rot: 2, meeple: "red" },
      { x: 1, y: -1, id: "E", rot: 2, meeple: "blue" },
      { x: 0, y: 0, id: "R", rot: 0 },
      { x: 1, y: 0, id: "R", rot: 3 },
    ],
    expect: {
      "0,0:city-0": { mode: "bridge", face: "red" },
      "1,0:city-0": { mode: "bridge", face: "blue" },
      "0,-1:city-0": { mode: "solo", colors: ["red"] },
      "1,-1:city-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "bend-road-even",
    title: "カーブ道 V の偶数境界（0.25+0.25）",
    ascii: `
      V@2(blue) — V@0(red)
    `,
    tiles: [
      { x: 0, y: 0, id: "V", rot: 0, meeple: "red", meepleKind: "road" },
      { x: -1, y: 0, id: "V", rot: 2, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "-1,0:road-0": { mode: "half-a", colors: ["blue", "red"] },
      "0,0:road-0": { mode: "half-b", colors: ["blue", "red"] },
    },
  },
  {
    id: "bend-city-road-P",
    title: "P（都市+カーブ道）道の奇数会合",
    ascii: `
      P@0(red road) — U@90 — P@180(blue road)
    `,
    tiles: [
      { x: 0, y: 0, id: "P", rot: 0, meeple: "red", meepleKind: "road" },
      { x: 1, y: 0, id: "U", rot: 1 },
      { x: 2, y: 0, id: "P", rot: 2, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "solo", colors: ["red"] },
      "1,0:road-0": { mode: "full", colors: ["blue", "red"] },
      "2,0:road-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "elbow-three-color",
    title: "肘都市 3色等距離 → N は hub",
    ascii: `
      E(green) — R@180 — E(orange)
                      |
                      N  — G — E(brown)
    `,
    tiles: [
      { x: 0, y: 0, id: "N", rot: 0 },
      { x: 0, y: -1, id: "R", rot: 2 },
      { x: -1, y: -1, id: "E", rot: 1, meeple: "green" },
      { x: 1, y: -1, id: "E", rot: 3, meeple: "orange" },
      { x: 1, y: 0, id: "G", rot: 0 },
      { x: 2, y: 0, id: "E", rot: 3, meeple: "brown" },
    ],
    expect: {
      "0,0:city-0": { mode: "hub", colorCount: 3, tie: true },
      "-1,-1:city-0": { mode: "bridge", face: "green" },
      "1,-1:city-0": { mode: "bridge", face: "orange" },
      "1,0:city-0": { mode: "bridge", face: "brown" },
      "2,0:city-0": { mode: "solo", colors: ["brown"] },
    },
  },
  {
    id: "stack-90r-no-upper-fan",
    title: "90R 会合の上の 90R はソリッド、会合は hub",
    ascii: `
      R@90
      R@90  — G(green)
      E(red)
    `,
    tiles: [
      { x: 0, y: -1, id: "R", rot: 1 },
      { x: 0, y: 0, id: "R", rot: 1 },
      { x: 0, y: 1, id: "E", rot: 0, meeple: "red" },
      { x: 1, y: 0, id: "G", rot: 0, meeple: "green" },
    ],
    expect: {
      "0,0:city-0": { mode: "hub", colors: ["green", "red"] },
      "0,-1:city-0": { mode: "bridge", face: "green" },
      "0,1:city-0": { mode: "bridge", face: "red" },
      "1,0:city-0": { mode: "bridge", face: "green" },
    },
  },
  {
    id: "road-even-three",
    title: "道 3タイル奇数会合（端ミープル）",
    ascii: `U(red) U U(blue) → full on middle`,
    tiles: [
      { x: 0, y: 0, id: "U", rot: 0, meeple: "red", meepleKind: "road" },
      { x: 0, y: 1, id: "U", rot: 0 },
      { x: 0, y: 2, id: "U", rot: 0, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "solo", colors: ["red"] },
      "0,1:road-0": { mode: "full", colors: ["red", "blue"] },
      "0,2:road-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "road-bend-V-U-V",
    title: "V—U—V カーブ道の奇数会合",
    ascii: `V@0(red) — U@90 — V@2(blue)`,
    tiles: [
      { x: 0, y: 0, id: "V", rot: 0, meeple: "red", meepleKind: "road" },
      { x: -1, y: 0, id: "U", rot: 1 },
      { x: -2, y: 0, id: "V", rot: 2, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "solo", colors: ["red"] },
      "-1,0:road-0": { mode: "full", colors: ["red", "blue"] },
      "-2,0:road-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "city-H-split-independent",
    title: "H 分離都市は独立（片側のみクレーム）",
    ascii: `H with meeple on north city only`,
    tiles: [
      { x: 0, y: 0, id: "H", rot: 0, meeple: "red", meepleKind: "city", meepleIndex: 0 },
      { x: 0, y: -1, id: "E", rot: 2 },
    ],
    expect: {
      "0,0:city-0": { mode: "solo", colors: ["red"] },
      "0,-1:city-0": { mode: "solo", colors: ["red"] },
    },
  },
  {
    id: "city-mouth-even",
    title: "R|R 口都市の偶数境界 → bridge",
    ascii: `R(red) — R(blue)`,
    tiles: [
      { x: 0, y: 0, id: "R", rot: 0, meeple: "red" },
      { x: 1, y: 0, id: "R", rot: 0, meeple: "blue" },
    ],
    expect: {
      "0,0:city-0": { mode: "bridge", face: "red", colors: ["red", "blue"] },
      "1,0:city-0": { mode: "bridge", face: "blue", colors: ["blue", "red"] },
    },
  },
  {
    id: "city-bar-even",
    title: "F|F 横都市の偶数境界 → bridge",
    ascii: `E(red) — F — F — E(blue)`,
    tiles: [
      { x: -1, y: 0, id: "E", rot: 1, meeple: "red" },
      { x: 0, y: 0, id: "F", rot: 0 },
      { x: 1, y: 0, id: "F", rot: 0 },
      { x: 2, y: 0, id: "E", rot: 3, meeple: "blue" },
    ],
    expect: {
      "-1,0:city-0": { mode: "solo", colors: ["red"] },
      "0,0:city-0": { mode: "bridge", face: "red" },
      "1,0:city-0": { mode: "bridge", face: "blue" },
      "2,0:city-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "bend-J-even",
    title: "J|K 都市付きカーブ道の偶数境界",
    ascii: `J(red road) — U — K(blue road)`,
    tiles: [
      { x: 0, y: 0, id: "J", rot: 0, meeple: "red", meepleKind: "road" },
      { x: 1, y: 0, id: "U", rot: 1 },
      { x: 2, y: 0, id: "K", rot: 0, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "solo", colors: ["red"] },
      "1,0:road-0": { mode: "full", colors: ["blue", "red"] },
      "2,0:road-0": { mode: "solo", colors: ["blue"] },
    },
  },
  {
    id: "crossroad-W-three",
    title: "W 三叉路で3色（各枝ミープル）",
    ascii: `U(red) west, U(blue) east, U(green) south into W`,
    tiles: [
      { x: 0, y: 0, id: "W", rot: 0 },
      { x: -1, y: 0, id: "U", rot: 1, meeple: "red", meepleKind: "road" },
      { x: 1, y: 0, id: "U", rot: 1, meeple: "blue", meepleKind: "road" },
      { x: 0, y: 1, id: "U", rot: 0, meeple: "green", meepleKind: "road" },
    ],
    expect: {
      "-1,0:road-0": { mode: "solo", colors: ["red"] },
      "1,0:road-0": { mode: "solo", colors: ["blue"] },
      "0,1:road-0": { mode: "solo", colors: ["green"] },
    },
  },
  {
    id: "monastery-solo",
    title: "修道院ソロクレーム",
    ascii: `B(green meeple)`,
    tiles: [
      { x: 0, y: 0, id: "B", rot: 0, meeple: "green", meepleKind: "monastery" },
    ],
    expect: {
      "0,0:monastery": { mode: "solo", colors: ["green"] },
    },
  },
  {
    id: "diag-N-N-adjacent-meeples",
    title: "斜め都市 N|N 隣接ミープル → bridge",
    ascii: `N(red) — N@180(blue)`,
    tiles: [
      { x: 0, y: 0, id: "N", rot: 0, meeple: "red" },
      { x: 1, y: 0, id: "N", rot: 2, meeple: "blue" },
    ],
    expect: {
      "0,0:city-0": { mode: "bridge", face: "red", colors: ["red", "blue"] },
      "1,0:city-0": { mode: "bridge", face: "blue", colors: ["blue", "red"] },
    },
  },
  {
    id: "gate-S-road-odd",
    title: "S 門道の奇数会合",
    ascii: `S(red road) — U — S@180(blue road)`,
    tiles: [
      { x: 0, y: 0, id: "S", rot: 0, meeple: "red", meepleKind: "road" },
      { x: 0, y: 1, id: "U", rot: 0 },
      { x: 0, y: 2, id: "S", rot: 2, meeple: "blue", meepleKind: "road" },
    ],
    expect: {
      "0,0:road-0": { mode: "solo", colors: ["red"] },
      "0,1:road-0": { mode: "full", colors: ["red", "blue"] },
      "0,2:road-0": { mode: "solo", colors: ["blue"] },
    },
  },
];
