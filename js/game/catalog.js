export const TYPES = [
  { id: "A", name: "修道院と道", count: 2, edges: ["F", "F", "R", "F"], cities: [], roads: [["S"]], monastery: true },
  { id: "B", name: "修道院", count: 4, edges: ["F", "F", "F", "F"], cities: [], roads: [], monastery: true },
  { id: "C", name: "四辺が都市", count: 1, edges: ["C", "C", "C", "C"], cities: [{ edges: ["N", "E", "S", "W"], pennant: true }], roads: [], monastery: false },
  { id: "D", name: "都市と直線の道", count: 4, edges: ["C", "R", "F", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["E", "W"]], monastery: false },
  { id: "E", name: "一方だけの都市", count: 5, edges: ["C", "F", "F", "F"], cities: [{ edges: ["N"], pennant: false }], roads: [], monastery: false },
  { id: "F", name: "向かいの都市がつながる", count: 2, edges: ["F", "C", "F", "C"], cities: [{ edges: ["E", "W"], pennant: true }], roads: [], monastery: false },
  { id: "G", name: "向かいの都市がつながる", count: 1, edges: ["F", "C", "F", "C"], cities: [{ edges: ["E", "W"], pennant: false }], roads: [], monastery: false },
  { id: "H", name: "向かいの都市が分かれる", count: 3, edges: ["C", "F", "C", "F"], cities: [{ edges: ["N"], pennant: false }, { edges: ["S"], pennant: false }], roads: [], monastery: false },
  { id: "I", name: "隣の都市が分かれる", count: 2, edges: ["C", "F", "F", "C"], cities: [{ edges: ["N"], pennant: false }, { edges: ["W"], pennant: false }], roads: [], monastery: false },
  { id: "J", name: "都市と右のカーブ", count: 3, edges: ["C", "R", "R", "F"], cities: [{ edges: ["N"], pennant: false }], roads: [["E", "S"]], monastery: false },
  { id: "K", name: "都市と左のカーブ", count: 3, edges: ["C", "F", "R", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["S", "W"]], monastery: false },
  { id: "L", name: "都市と三叉路", count: 3, edges: ["C", "R", "R", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["E"], ["S"], ["W"]], monastery: false },
  { id: "M", name: "角の都市", count: 2, edges: ["C", "C", "F", "F"], cities: [{ edges: ["N", "E"], pennant: true }], roads: [], monastery: false },
  { id: "N", name: "角の都市", count: 3, edges: ["C", "C", "F", "F"], cities: [{ edges: ["N", "E"], pennant: false }], roads: [], monastery: false },
  { id: "O", name: "角の都市と道", count: 2, edges: ["C", "R", "R", "C"], cities: [{ edges: ["N", "W"], pennant: true }], roads: [["E", "S"]], monastery: false },
  { id: "P", name: "角の都市と道", count: 3, edges: ["C", "R", "R", "C"], cities: [{ edges: ["N", "W"], pennant: false }], roads: [["E", "S"]], monastery: false },
  { id: "Q", name: "三方が都市", count: 1, edges: ["C", "C", "F", "C"], cities: [{ edges: ["N", "E", "W"], pennant: true }], roads: [], monastery: false },
  { id: "R", name: "三方が都市", count: 3, edges: ["C", "C", "F", "C"], cities: [{ edges: ["N", "E", "W"], pennant: false }], roads: [], monastery: false },
  { id: "S", name: "三方の都市と入口の道", count: 2, edges: ["C", "C", "R", "C"], cities: [{ edges: ["N", "E", "W"], pennant: true }], roads: [["S"]], monastery: false },
  { id: "T", name: "三方の都市と入口の道", count: 1, edges: ["C", "C", "R", "C"], cities: [{ edges: ["N", "E", "W"], pennant: false }], roads: [["S"]], monastery: false },
  { id: "U", name: "直線の道", count: 8, edges: ["R", "F", "R", "F"], cities: [], roads: [["N", "S"]], monastery: false },
  { id: "V", name: "カーブ", count: 9, edges: ["F", "F", "R", "R"], cities: [], roads: [["S", "W"]], monastery: false },
  { id: "W", name: "三叉路", count: 4, edges: ["F", "R", "R", "R"], cities: [], roads: [["E"], ["S"], ["W"]], monastery: false },
  { id: "X", name: "十字路", count: 1, edges: ["R", "R", "R", "R"], cities: [], roads: [["N"], ["E"], ["S"], ["W"]], monastery: false },
];


function pillars(...corners) {
  return corners.map((c) => `<i class="city-pillar ${c}"></i>`).join("");
}

function city(cls, inner = "", feat = "city-0") {
  return `<i class="city ${cls}" data-feat="${feat}">${inner}</i>`;
}

/** Gate-flank pillar (same design as seam gate ends). */
function gatePillarHTML(side) {
  return (
    '<span class="gate-pillar ' + side + '">' +
      '<span class="roof"></span>' +
      '<span class="win"></span>' +
    "</span>"
  );
}

/** Keep for C / Q–T: 柱 | 塔 | 柱 (spans avoid nested <i> parsing). */
function cityTowerHTML() {
  return (
    '<span class="city-keep" title="塔">' +
      gatePillarHTML("left") +
      '<span class="city-tower">' +
        '<span class="roof"></span>' +
        '<span class="win"></span>' +
        '<span class="door"></span>' +
      "</span>" +
      gatePillarHTML("right") +
    "</span>"
  );
}

function road(cls, feat) {
  return `<i class="road ${cls}" data-feat="${feat}"></i>`;
}

function bend(cls, feat) {
  return `<i class="bend ${cls}" data-feat="${feat}"></i>`;
}

/** Shared monastery markup (play / rules / home). Spans avoid nested <i> parsing. */
export function monasteryHTML(withFeat = true) {
  const feat = withFeat ? ' data-feat="monastery"' : "";
  return (
    '<span class="monastery"' + feat + ">" +
      '<span class="wing left"><span class="win"></span></span>' +
      '<span class="wing right"><span class="win"></span></span>' +
      '<span class="cross"></span>' +
      '<span class="roof"></span>' +
      '<span class="body"><span class="win"></span><span class="win"></span></span>' +
    "</span>"
  );
}

export const MARKUP = {
  A: road("to-s", "road-0") + monasteryHTML(true),
  B: monasteryHTML(true),
  /* Fill has no field wall — pillars only (all edges connect); keep in the center. */
  C: city("fill", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) +
    '<i class="pennant p-c" title="旗"></i>',
  D: city("cap n shallow", pillars("nw", "ne")) + road("h", "road-0"),
  E: city("cap n", pillars("nw", "ne")),
  F: city("bar h", pillars("nw", "ne", "sw", "se")) + '<i class="pennant p-bar" title="旗"></i>',
  G: city("bar h", pillars("nw", "ne", "sw", "se")),
  H: city("cap n", pillars("nw", "ne"), "city-0") + city("cap s", pillars("sw", "se"), "city-1"),
  I: city("cap n gap-w", pillars("nw", "ne"), "city-0") + city("cap w gap-n", pillars("nw", "sw"), "city-1"),
  J: city("cap n", pillars("nw", "ne")) + bend("se edge", "road-0") + bend("se line", "road-0"),
  K: city("cap n", pillars("nw", "ne")) + bend("sw edge", "road-0") + bend("sw line", "road-0"),
  L: city("cap n shallow", pillars("nw", "ne")) + road("h-e", "road-0") + road("h-w", "road-2") + road("v-s", "road-1") + '<i class="village"></i>',
  M: city("elbow ne", pillars("nw", "ne", "se")) + '<i class="pennant p-ne" title="旗"></i>',
  N: city("elbow ne", pillars("nw", "ne", "se")),
  O: city("elbow nw", pillars("nw", "ne", "sw")) + bend("se edge", "road-0") + bend("se line", "road-0") + '<i class="pennant p-nw" title="旗"></i>',
  P: city("elbow nw", pillars("nw", "ne", "sw")) + bend("se edge", "road-0") + bend("se line", "road-0"),
  /* Mouth city — keep sits in the city mass (above the south notch / gate). */
  Q: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) +
    '<i class="pennant p-u" title="旗"></i>',
  R: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()),
  S: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) +
    road("gate", "road-0") + '<i class="pennant p-u" title="旗"></i>',
  T: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) +
    road("gate", "road-0"),
  U: road("v", "road-0"),
  V: bend("sw edge", "road-0") + bend("sw line", "road-0"),
  W: road("h-e", "road-0") + road("h-w", "road-2") + road("v-s", "road-1") + '<i class="village"></i>',
  X: road("v-n", "road-0") + road("h-e", "road-1") + road("v-s", "road-2") + road("h-w", "road-3") + '<i class="village"></i>',
};


export const BY_ID = Object.fromEntries(TYPES.map((type) => [type.id, type]));


// Meeple anchors in catalog orientation (rot 0). Screen y grows downward.
// Fields are true regions (not one-per-edge), matching base-game tile art.
export const MEEPLE_LAYOUTS = {
  A: [
    { id: "monastery", kind: "monastery", x: 0.5, y: 0.4 },
    { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78 },
    { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.28 },
  ],
  B: [
    { id: "monastery", kind: "monastery", x: 0.5, y: 0.4 },
    { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.72 },
  ],
  C: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5 },
  ],
  D: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.14 },
    { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5 },
    // Gap under the city tip joins left/right above the road into one field.
    { id: "field-0", kind: "field", index: 0, x: 0.2, y: 0.36 },
    { id: "field-1", kind: "field", index: 1, x: 0.5, y: 0.8 },
  ],
  E: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.18 },
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.68 },
  ],
  F: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.16 },
    { id: "field-1", kind: "field", index: 1, x: 0.5, y: 0.84 },
  ],
  G: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.16 },
    { id: "field-1", kind: "field", index: 1, x: 0.5, y: 0.84 },
  ],
  H: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
    { id: "city-1", kind: "city", index: 1, x: 0.5, y: 0.84 },
    // East/west grass joins through the middle gap between the two cities.
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.5 },
  ],
  I: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
    { id: "city-1", kind: "city", index: 1, x: 0.16, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.72, y: 0.72 },
  ],
  J: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
    // SE bend: road on the arc, inner field in the SE pocket, large field west.
    { id: "road-0", kind: "road", index: 0, x: 0.62, y: 0.62 },
    { id: "field-0", kind: "field", index: 0, x: 0.24, y: 0.42 },
    { id: "field-1", kind: "field", index: 1, x: 0.84, y: 0.84 },
  ],
  K: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
    { id: "road-0", kind: "road", index: 0, x: 0.38, y: 0.62 },
    { id: "field-0", kind: "field", index: 0, x: 0.76, y: 0.42 },
    { id: "field-1", kind: "field", index: 1, x: 0.16, y: 0.84 },
  ],
  L: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.14 },
    { id: "road-0", kind: "road", index: 0, x: 0.78, y: 0.5 },
    { id: "road-1", kind: "road", index: 1, x: 0.5, y: 0.78 },
    { id: "road-2", kind: "road", index: 2, x: 0.22, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.86, y: 0.86 },
    { id: "field-1", kind: "field", index: 1, x: 0.14, y: 0.86 },
    // Northern strip field: outer NE pocket (top corners are city).
    { id: "field-2", kind: "field", index: 2, x: 0.86, y: 0.14 },
  ],
  M: [
    { id: "city-0", kind: "city", index: 0, x: 0.68, y: 0.24 },
    { id: "field-0", kind: "field", index: 0, x: 0.28, y: 0.72 },
  ],
  N: [
    { id: "city-0", kind: "city", index: 0, x: 0.68, y: 0.24 },
    { id: "field-0", kind: "field", index: 0, x: 0.28, y: 0.72 },
  ],
  O: [
    { id: "city-0", kind: "city", index: 0, x: 0.28, y: 0.22 },
    { id: "road-0", kind: "road", index: 0, x: 0.62, y: 0.62 },
    { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.28 },
    { id: "field-1", kind: "field", index: 1, x: 0.84, y: 0.84 },
  ],
  P: [
    { id: "city-0", kind: "city", index: 0, x: 0.28, y: 0.22 },
    { id: "road-0", kind: "road", index: 0, x: 0.62, y: 0.62 },
    { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.28 },
    { id: "field-1", kind: "field", index: 1, x: 0.84, y: 0.84 },
  ],
  Q: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.32 },
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.82 },
  ],
  R: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.32 },
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.82 },
  ],
  S: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.28 },
    { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78 },
    { id: "field-0", kind: "field", index: 0, x: 0.14, y: 0.86 },
    { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.86 },
  ],
  T: [
    { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.28 },
    { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78 },
    { id: "field-0", kind: "field", index: 0, x: 0.14, y: 0.86 },
    { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.86 },
  ],
  U: [
    { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.22, y: 0.5 },
    { id: "field-1", kind: "field", index: 1, x: 0.78, y: 0.5 },
  ],
  // Large outer field (N/E) and small field inside the SW curve.
  V: [
    { id: "road-0", kind: "road", index: 0, x: 0.38, y: 0.62 },
    { id: "field-0", kind: "field", index: 0, x: 0.7, y: 0.3 },
    { id: "field-1", kind: "field", index: 1, x: 0.16, y: 0.84 },
  ],
  W: [
    { id: "road-0", kind: "road", index: 0, x: 0.78, y: 0.5 },
    { id: "road-1", kind: "road", index: 1, x: 0.5, y: 0.78 },
    { id: "road-2", kind: "road", index: 2, x: 0.22, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.14 },
    { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.86 },
    { id: "field-2", kind: "field", index: 2, x: 0.14, y: 0.86 },
  ],
  X: [
    { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.22 },
    { id: "road-1", kind: "road", index: 1, x: 0.78, y: 0.5 },
    { id: "road-2", kind: "road", index: 2, x: 0.5, y: 0.78 },
    { id: "road-3", kind: "road", index: 3, x: 0.22, y: 0.5 },
    { id: "field-0", kind: "field", index: 0, x: 0.14, y: 0.14 },
    { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.14 },
    { id: "field-2", kind: "field", index: 2, x: 0.86, y: 0.86 },
    { id: "field-3", kind: "field", index: 3, x: 0.14, y: 0.86 },
  ],
};


// Field edge ports in catalog orientation.
// Side 0/1 follow the clockwise rim: N:W→E, E:N→S, S:E→W, W:S→N.
// Across a shared edge, side s connects to the neighbor's opposite edge at 1-s.
export const FIELD_PORTS = {
  A: [[["N", 0], ["N", 1], ["E", 0], ["E", 1], ["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
  B: [[["N", 0], ["N", 1], ["E", 0], ["E", 1], ["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
  C: [],
  D: [
    [["E", 0], ["W", 1]],
    [["E", 1], ["W", 0], ["S", 0], ["S", 1]],
  ],
  E: [[["E", 0], ["E", 1], ["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
  F: [[["N", 0], ["N", 1]], [["S", 0], ["S", 1]]],
  G: [[["N", 0], ["N", 1]], [["S", 0], ["S", 1]]],
  H: [[["E", 0], ["E", 1], ["W", 0], ["W", 1]]],
  I: [[["E", 0], ["E", 1], ["S", 0], ["S", 1]]],
  J: [
    [["W", 0], ["W", 1], ["E", 0], ["S", 1]],
    [["E", 1], ["S", 0]],
  ],
  K: [
    [["E", 0], ["E", 1], ["S", 0], ["W", 1]],
    [["S", 1], ["W", 0]],
  ],
  L: [
    [["E", 1], ["S", 0]],
    [["S", 1], ["W", 0]],
    [["E", 0], ["W", 1]],
  ],
  M: [[["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
  N: [[["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
  O: [
    [["E", 0], ["S", 1]],
    [["E", 1], ["S", 0]],
  ],
  P: [
    [["E", 0], ["S", 1]],
    [["E", 1], ["S", 0]],
  ],
  Q: [[["S", 0], ["S", 1]]],
  R: [[["S", 0], ["S", 1]]],
  S: [[["S", 1]], [["S", 0]]],
  T: [[["S", 1]], [["S", 0]]],
  U: [
    [["W", 0], ["W", 1], ["N", 0], ["S", 1]],
    [["E", 0], ["E", 1], ["N", 1], ["S", 0]],
  ],
  V: [
    [["N", 0], ["N", 1], ["E", 0], ["E", 1], ["S", 0], ["W", 1]],
    [["S", 1], ["W", 0]],
  ],
  W: [
    [["N", 0], ["N", 1], ["E", 0], ["W", 1]],
    [["E", 1], ["S", 0]],
    [["S", 1], ["W", 0]],
  ],
  X: [
    [["N", 0], ["W", 1]],
    [["N", 1], ["E", 0]],
    [["E", 1], ["S", 0]],
    [["S", 1], ["W", 0]],
  ],
};


// On each tile, which field index borders which city index (for farmer scoring).
export const FIELD_CITY_TOUCH = {
  D: [[0, 0]],
  E: [[0, 0]],
  F: [[0, 0], [1, 0]],
  G: [[0, 0], [1, 0]],
  H: [[0, 0], [0, 1]],
  I: [[0, 0], [0, 1]],
  J: [[0, 0]],
  K: [[0, 0]],
  L: [[2, 0]],
  M: [[0, 0]],
  N: [[0, 0]],
  O: [[0, 0]],
  P: [[0, 0]],
  Q: [[0, 0]],
  R: [[0, 0]],
  S: [[0, 0], [1, 0]],
  T: [[0, 0], [1, 0]],
};
