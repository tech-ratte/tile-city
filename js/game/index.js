/**
 * Game domain API.
 *
 * constants — players / palette / directions
 * catalog   — tile types, markup, meeple & field layouts
 * tiles     — tile instances, rotation, HTML
 * board     — placement legality, open cells
 * features  — road / city / field / monastery connectivity
 * scoring   — mid-game & final scoring
 * engine    — Game class, createGame, simulate
 * persist   — serialize / restore
 */
import {
  PLAYERS,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  MEEPLES_EACH,
  EDGE_NAME,
  DIR_NAME,
  normalizePlayers,
} from "./constants.js";
import {
  TYPES,
  MARKUP,
  MEEPLE_LAYOUTS,
  FIELD_PORTS,
  FIELD_CITY_TOUCH,
} from "./catalog.js";
import {
  buildTiles,
  makeTile,
  rotateEdges,
  tileHTML,
  listMeepleSlots,
} from "./tiles.js";
import {
  canPlace,
  openCells,
  boardErrors,
  edgeText,
} from "./board.js";
import {
  collectRoadComponent,
  collectCityComponent,
  collectFieldComponent,
  monasteryComplete,
  isMeepleSlotOpen,
} from "./features.js";
import {
  resolveCompletions,
  finalizeScores,
  rankPlayers,
  cityPoints,
  roadPoints,
  completedCitiesTouchingField,
} from "./scoring.js";
import {
  createGame,
  simulateToLastTile,
} from "./engine.js";
import {
  serializeGame,
  restoreGame,
  SAVE_VERSION,
} from "./persist.js";

const Carcassonne = {
  PLAYERS,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  MEEPLES_EACH,
  TYPES,
  MARKUP,
  EDGE_NAME,
  DIR_NAME,
  buildTiles,
  makeTile,
  rotateEdges,
  canPlace,
  openCells,
  boardErrors,
  edgeText,
  tileHTML,
  listMeepleSlots,
  MEEPLE_LAYOUTS,
  FIELD_PORTS,
  collectRoadComponent,
  collectCityComponent,
  collectFieldComponent,
  monasteryComplete,
  isMeepleSlotOpen,
  resolveCompletions,
  finalizeScores,
  rankPlayers,
  normalizePlayers,
  cityPoints,
  roadPoints,
  completedCitiesTouchingField,
  FIELD_CITY_TOUCH,
  createGame,
  serializeGame,
  restoreGame,
  SAVE_VERSION,
  simulateToLastTile,
};

export default Carcassonne;
export {
  PLAYERS,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  MEEPLES_EACH,
  TYPES,
  MARKUP,
  EDGE_NAME,
  DIR_NAME,
  buildTiles,
  makeTile,
  rotateEdges,
  canPlace,
  openCells,
  boardErrors,
  edgeText,
  tileHTML,
  listMeepleSlots,
  MEEPLE_LAYOUTS,
  FIELD_PORTS,
  collectRoadComponent,
  collectCityComponent,
  collectFieldComponent,
  monasteryComplete,
  isMeepleSlotOpen,
  resolveCompletions,
  finalizeScores,
  rankPlayers,
  normalizePlayers,
  cityPoints,
  roadPoints,
  completedCitiesTouchingField,
  FIELD_CITY_TOUCH,
  createGame,
  serializeGame,
  restoreGame,
  SAVE_VERSION,
  simulateToLastTile,
};
