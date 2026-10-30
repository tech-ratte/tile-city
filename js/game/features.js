import { FIELD_PORTS } from "./catalog.js";
import { DIRS, DIR_INDEX, NEI, OPP_DIR } from "./constants.js";
import { keyOf } from "./tiles.js";

export function absDir(catalogDir, rot) {
  return DIRS[(DIR_INDEX[catalogDir] + ((rot % 4) + 4) % 4) % 4];
}


export function findRoadIndexByAbsEdge(tile, absEdge) {
  const rot = tile.rot || 0;
  for (let i = 0; i < (tile.roads || []).length; i++) {
    for (const dir of tile.roads[i]) {
      if (absDir(dir, rot) === absEdge) return i;
    }
  }
  return -1;
}


export function findCityIndexByAbsEdge(tile, absEdge) {
  const rot = tile.rot || 0;
  for (let i = 0; i < (tile.cities || []).length; i++) {
    for (const dir of tile.cities[i].edges) {
      if (absDir(dir, rot) === absEdge) return i;
    }
  }
  return -1;
}


export function collectRoadComponent(board, startX, startY, startRoadIndex) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY, index: startRoadIndex }];
  const parts = [];
  let open = false;

  while (queue.length) {
    const cur = queue.shift();
    const id = cur.x + "," + cur.y + "," + cur.index;
    if (visited.has(id)) continue;
    visited.add(id);
    parts.push(cur);

    const tile = board.get(keyOf(cur.x, cur.y));
    if (!tile || !tile.roads || !tile.roads[cur.index]) {
      open = true;
      continue;
    }
    const rot = tile.rot || 0;
    for (const catalogDir of tile.roads[cur.index]) {
      const dir = absDir(catalogDir, rot);
      const step = NEI[DIR_INDEX[dir]];
      const nx = cur.x + step.dx;
      const ny = cur.y + step.dy;
      const neighbor = board.get(keyOf(nx, ny));
      if (!neighbor) {
        open = true;
        continue;
      }
      const nextIndex = findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]);
      if (nextIndex < 0) {
        open = true;
        continue;
      }
      queue.push({ x: nx, y: ny, index: nextIndex });
    }
  }

  return { complete: !open, parts: parts };
}


export function collectCityComponent(board, startX, startY, startCityIndex) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY, index: startCityIndex }];
  const parts = [];
  let open = false;

  while (queue.length) {
    const cur = queue.shift();
    const id = cur.x + "," + cur.y + "," + cur.index;
    if (visited.has(id)) continue;
    visited.add(id);
    parts.push(cur);

    const tile = board.get(keyOf(cur.x, cur.y));
    if (!tile || !tile.cities || !tile.cities[cur.index]) {
      open = true;
      continue;
    }
    const rot = tile.rot || 0;
    for (const catalogDir of tile.cities[cur.index].edges) {
      const dir = absDir(catalogDir, rot);
      const step = NEI[DIR_INDEX[dir]];
      const nx = cur.x + step.dx;
      const ny = cur.y + step.dy;
      const neighbor = board.get(keyOf(nx, ny));
      if (!neighbor) {
        open = true;
        continue;
      }
      const nextIndex = findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]);
      if (nextIndex < 0) {
        open = true;
        continue;
      }
      queue.push({ x: nx, y: ny, index: nextIndex });
    }
  }

  return { complete: !open, parts: parts };
}


export function monasteryComplete(board, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!board.has(keyOf(x + dx, y + dy))) return false;
    }
  }
  return true;
}


export function fieldPortsFor(tile) {
  return FIELD_PORTS[tile.id] || [];
}


export function findFieldIndexByAbsPort(tile, absEdge, side) {
  const rot = tile.rot || 0;
  const fields = fieldPortsFor(tile);
  for (let i = 0; i < fields.length; i++) {
    for (const port of fields[i]) {
      if (absDir(port[0], rot) === absEdge && port[1] === side) return i;
    }
  }
  return -1;
}


export function collectFieldComponent(board, startX, startY, startFieldIndex) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY, index: startFieldIndex }];
  const parts = [];
  let open = false;

  while (queue.length) {
    const cur = queue.shift();
    const id = cur.x + "," + cur.y + "," + cur.index;
    if (visited.has(id)) continue;
    visited.add(id);
    parts.push(cur);

    const tile = board.get(keyOf(cur.x, cur.y));
    const fields = tile ? fieldPortsFor(tile) : null;
    if (!tile || !fields || !fields[cur.index]) {
      open = true;
      continue;
    }
    const rot = tile.rot || 0;
    for (const port of fields[cur.index]) {
      const dir = absDir(port[0], rot);
      const side = port[1];
      const step = NEI[DIR_INDEX[dir]];
      const nx = cur.x + step.dx;
      const ny = cur.y + step.dy;
      const neighbor = board.get(keyOf(nx, ny));
      if (!neighbor) {
        open = true;
        continue;
      }
      const nextIndex = findFieldIndexByAbsPort(neighbor, OPP_DIR[dir], 1 - side);
      if (nextIndex < 0) {
        open = true;
        continue;
      }
      queue.push({ x: nx, y: ny, index: nextIndex });
    }
  }

  return { complete: !open, parts: parts };
}


export function featureHasMeeple(board, kind, parts) {
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile || !tile.meeple) continue;
    if (tile.meeple.kind !== kind) continue;
    if (kind === "monastery") return true;
    if (tile.meeple.index === part.index) return true;
  }
  return false;
}


export function isMeepleSlotOpen(board, x, y, slot) {
  if (!slot) return false;
  if (slot.kind === "monastery") {
    const tile = board.get(keyOf(x, y));
    return !(tile && tile.meeple && tile.meeple.kind === "monastery");
  }
  if (slot.kind === "road") {
    const result = collectRoadComponent(board, x, y, slot.index);
    return !featureHasMeeple(board, "road", result.parts);
  }
  if (slot.kind === "city") {
    const result = collectCityComponent(board, x, y, slot.index);
    return !featureHasMeeple(board, "city", result.parts);
  }
  if (slot.kind === "field") {
    const result = collectFieldComponent(board, x, y, slot.index);
    return !featureHasMeeple(board, "field", result.parts);
  }
  return false;
}
