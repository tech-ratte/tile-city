import { BY_ID, MARKUP, MEEPLE_LAYOUTS, TYPES } from "./catalog.js";

export function keyOf(x, y) {
  return x + "," + y;
}


export function rotateEdges(edges, turns) {
  const n = ((turns % 4) + 4) % 4;
  const next = edges.slice();
  for (let i = 0; i < n; i++) next.unshift(next.pop());
  return next;
}


export function rotClass(rot) {
  const deg = ((rot % 4) + 4) % 4 * 90;
  return deg ? "rot-" + deg : "";
}


export function tileHTML(id, rot) {
  if (!MARKUP[id]) throw new Error("unknown tile " + id);
  const cls = ["tile", rotClass(rot)].filter(Boolean).join(" ");
  return '<div class="' + cls + '" aria-hidden="true">' + MARKUP[id] + "</div>";
}


export function copyCities(cities) {
  return cities.map((city) => ({ edges: city.edges.slice(), pennant: !!city.pennant }));
}


export function copyRoads(roads) {
  return roads.map((road) => road.slice());
}


export function makeTile(id, start) {
  const type = BY_ID[id];
  if (!type) throw new Error("unknown tile " + id);
  return {
    id: type.id,
    name: type.name,
    edges: type.edges.slice(),
    cities: copyCities(type.cities),
    roads: copyRoads(type.roads),
    monastery: type.monastery,
    start: !!start,
  };
}


export function buildTiles() {
  const tiles = [];
  for (const type of TYPES) {
    for (let i = 0; i < type.count; i++) {
      tiles.push(makeTile(type.id, type.id === "D" && i === 0));
    }
  }
  return tiles;
}


export function clonePlaced(tile, rot, owner) {
  return {
    id: tile.id,
    name: tile.name,
    edges: tile.edges.slice(),
    cities: copyCities(tile.cities),
    roads: copyRoads(tile.roads),
    monastery: tile.monastery,
    start: !!tile.start,
    rot: ((rot % 4) + 4) % 4,
    owner: owner || null,
    meeple: null,
  };
}


// Clockwise 90° in screen coordinates (y grows down).
export function rotatePoint(point, rot) {
  let x = point.x - 0.5;
  let y = point.y - 0.5;
  const turns = ((rot % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) {
    const nextX = -y;
    y = x;
    x = nextX;
  }
  return { x: x + 0.5, y: y + 0.5 };
}


export function listMeepleSlots(tile) {
  const layout = MEEPLE_LAYOUTS[tile.id];
  if (!layout) return [];
  const rot = tile.rot || 0;
  return layout.map((slot) => {
    const point = rotatePoint(slot, rot);
    return {
      id: slot.id,
      kind: slot.kind,
      index: slot.index == null ? null : slot.index,
      x: point.x,
      y: point.y,
    };
  });
}
