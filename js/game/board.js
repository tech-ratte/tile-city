import { DIR_NAME, EDGE_NAME, NEI } from "./constants.js";
import { keyOf, rotateEdges } from "./tiles.js";

export function canPlace(board, x, y, edges) {
  if (board.has(keyOf(x, y))) return false;
  let touch = 0;
  for (const step of NEI) {
    const other = board.get(keyOf(x + step.dx, y + step.dy));
    if (!other) continue;
    touch += 1;
    const facing = rotateEdges(other.edges, other.rot || 0);
    if (edges[step.dir] !== facing[step.opp]) return false;
  }
  return touch > 0;
}


export function openCells(board) {
  const found = new Set();
  for (const key of board.keys()) {
    const [x, y] = key.split(",").map(Number);
    for (const step of NEI) {
      const next = keyOf(x + step.dx, y + step.dy);
      if (!board.has(next)) found.add(next);
    }
  }
  return [...found].map((key) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  });
}


export function byPos(a, b) {
  return a.y - b.y || a.x - b.x;
}


export function boardErrors(board) {
  const errors = [];
  for (const [key, tile] of board) {
    const [x, y] = key.split(",").map(Number);
    const edges = rotateEdges(tile.edges, tile.rot || 0);
    let touch = 0;
    for (const step of NEI) {
      const other = board.get(keyOf(x + step.dx, y + step.dy));
      if (!other) continue;
      touch += 1;
      const facing = rotateEdges(other.edges, other.rot || 0);
      if (edges[step.dir] !== facing[step.opp]) errors.push(key);
    }
    if (key !== "0,0" && touch === 0) errors.push("float " + key);
  }
  return errors;
}


export function edgeText(edges) {
  return DIR_NAME.map((dir, index) => dir + " " + EDGE_NAME[edges[index]]).join(" · ");
}
