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


export const MARKUP = {
  A: '<i class="road to-s"></i><span class="monastery"><i class="wing left"></i><i class="wing right"></i><i class="cross"></i><i class="roof"></i><i class="body"></i></span>',
  B: '<span class="monastery"><i class="wing left"></i><i class="wing right"></i><i class="cross"></i><i class="roof"></i><i class="body"></i></span>',
  C: '<i class="city fill"></i><i class="pennant p-c" title="旗"></i>',
  D: '<i class="city cap n shallow"></i><i class="road h"></i>',
  E: '<i class="city cap n"></i>',
  F: '<i class="city bar h"></i><i class="pennant p-bar" title="旗"></i>',
  G: '<i class="city bar h"></i>',
  H: '<i class="city cap n"></i><i class="city cap s"></i>',
  I: '<i class="city cap n gap-w"></i><i class="city cap w gap-n"></i>',
  J: '<i class="city cap n"></i><i class="bend se edge"></i><i class="bend se line"></i>',
  K: '<i class="city cap n"></i><i class="bend sw edge"></i><i class="bend sw line"></i>',
  L: '<i class="city cap n shallow"></i><i class="road h-e"></i><i class="road h-w"></i><i class="road v-s"></i><i class="village"></i>',
  M: '<i class="city elbow ne"></i><i class="pennant p-ne" title="旗"></i>',
  N: '<i class="city elbow ne"></i>',
  O: '<i class="city elbow nw"></i><i class="bend se edge"></i><i class="bend se line"></i><i class="pennant p-nw" title="旗"></i>',
  P: '<i class="city elbow nw"></i><i class="bend se edge"></i><i class="bend se line"></i>',
  Q: '<i class="city mouth s"></i><i class="pennant p-u" title="旗"></i>',
  R: '<i class="city mouth s"></i>',
  S: '<i class="city mouth s"></i><i class="road gate"></i><i class="pennant p-u" title="旗"></i>',
  T: '<i class="city mouth s"></i><i class="road gate"></i>',
  U: '<i class="road v"></i>',
  V: '<i class="bend sw edge"></i><i class="bend sw line"></i>',
  W: '<i class="road h-e"></i><i class="road h-w"></i><i class="road v-s"></i><i class="village"></i>',
  X: '<i class="road v-n"></i><i class="road h-e"></i><i class="road v-s"></i><i class="road h-w"></i><i class="village"></i>',
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
