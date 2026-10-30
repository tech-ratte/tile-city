/**
 * Compatibility entry for the game API.
 * Prefer: import Carcassonne from "./game/index.js"
 */
export { default } from "./game/index.js";
export * from "./game/index.js";

import Carcassonne from "./game/index.js";
if (typeof globalThis !== "undefined") globalThis.Carcassonne = Carcassonne;
