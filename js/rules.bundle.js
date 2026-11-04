(() => {
  // js/audio.js
  var VOLUME_KEY = "tile-city-volume";
  var SOUNDS = {
    tile: "assets/sound/tile.mp3",
    point: "assets/sound/point.mp3",
    clear: "assets/sound/clear.mp3"
  };
  var MEEPLE_COLORS = [
    "red",
    "blue",
    "green",
    "yellow",
    "orange",
    "purple",
    "white",
    "brown"
  ];
  function loadVolume() {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw == null || raw === "") return 0.7;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 0.7;
      return Math.min(1, Math.max(0, n / 100));
    } catch (err) {
      return 0.7;
    }
  }
  var volume = loadVolume();
  var audioCtx = null;
  var buffers = /* @__PURE__ */ new Map();
  var loading = /* @__PURE__ */ new Map();
  var unlockArmed = false;
  var unlocked = false;
  function getVolume() {
    return volume;
  }
  function setVolume(next) {
    volume = Math.min(1, Math.max(0, Number(next) || 0));
    try {
      localStorage.setItem(VOLUME_KEY, String(Math.round(volume * 100)));
    } catch (err) {
    }
    syncVolumeInputs();
  }
  function AudioContextCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }
  function getCtx() {
    const Ctor = AudioContextCtor();
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  }
  async function resumeCtx() {
    const ctx = getCtx();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (err) {
      }
    }
    return ctx;
  }
  function loadBuffer(src) {
    if (buffers.has(src)) return Promise.resolve(buffers.get(src));
    if (loading.has(src)) return loading.get(src);
    const task = (async () => {
      const ctx = await resumeCtx();
      if (!ctx) return null;
      const res = await fetch(src);
      if (!res.ok) throw new Error("audio fetch failed");
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw.slice(0));
      buffers.set(src, buf);
      return buf;
    })().catch(() => {
      loading.delete(src);
      return null;
    });
    loading.set(src, task);
    return task;
  }
  function playBuffer(buf, ctx) {
    return new Promise((resolve) => {
      try {
        if (ctx.state !== "running") {
          resolve({ ok: false, mode: "web-audio", reason: "ctx-" + ctx.state });
          return;
        }
        const gain = ctx.createGain();
        gain.gain.value = volume;
        gain.connect(ctx.destination);
        const node = ctx.createBufferSource();
        node.buffer = buf;
        node.connect(gain);
        node.onended = () => resolve({ ok: true, mode: "web-audio", ctxState: ctx.state });
        node.start(0);
      } catch (err) {
        resolve({ ok: false, mode: "web-audio", reason: String(err) });
      }
    });
  }
  function playHtmlFallback(src) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        const audio = new Audio(src);
        audio.volume = volume;
        audio.addEventListener("error", () => finish({ ok: false, mode: "html-fallback", reason: "element-error" }), { once: true });
        void audio.play().then(
          () => finish({ ok: true, mode: "html-fallback", started: true }),
          (err) => finish({
            ok: false,
            mode: "html-fallback",
            reason: err && err.name ? err.name : String(err)
          })
        );
      } catch (err) {
        finish({ ok: false, mode: "html-fallback", reason: String(err) });
      }
    });
  }
  function playSrcAsync(src) {
    return (async () => {
      if (!(volume > 0) || !src) return { ok: false, reason: "muted-or-empty" };
      const ctx = await resumeCtx();
      if (ctx) {
        const buf = await loadBuffer(src);
        if (buf) {
          const web = await playBuffer(buf, ctx);
          if (web.ok) return web;
        }
      }
      return playHtmlFallback(src);
    })();
  }
  function playSrc(src) {
    if (!(volume > 0) || !src) return;
    void playSrcAsync(src);
  }
  function warmCommon() {
    void loadBuffer(SOUNDS.tile);
    void loadBuffer(SOUNDS.point);
    void loadBuffer(SOUNDS.clear);
  }
  function unlockAudio() {
    if (unlocked) {
      void resumeCtx();
      return;
    }
    unlocked = true;
    void resumeCtx().then(() => warmCommon());
  }
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    const kick = () => unlockAudio();
    for (const evt of ["pointerdown", "touchstart", "keydown", "click"]) {
      document.addEventListener(evt, kick, { capture: true, passive: true });
    }
  }
  function playSound(name) {
    unlockAudio();
    playSrc(SOUNDS[name]);
  }
  function playSoundAsync(name) {
    unlockAudio();
    const src = SOUNDS[name];
    if (!src) return Promise.resolve({ ok: false, reason: "unknown-sound" });
    if (!(volume > 0)) return Promise.resolve({ ok: false, reason: "muted" });
    return playSrcAsync(src).then((result) => Object.assign({
      buffered: buffers.has(src),
      ctxState: getCtx() ? getCtx().state : null
    }, result || { ok: false, reason: "no-result" }));
  }
  function getAudioDebugState() {
    const ctx = getCtx();
    return {
      unlocked,
      volume,
      ctxState: ctx ? ctx.state : null,
      bufferCount: buffers.size,
      buffered: [...buffers.keys()]
    };
  }
  function playMeepleSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    unlockAudio();
    const n = 1 + Math.floor(Math.random() * 3);
    playSrc("assets/sound/meeple/" + color + "/" + color + n + ".mp3");
  }
  function playWinSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    unlockAudio();
    playSrc("assets/sound/win/" + color + ".mp3");
  }
  async function playEndFanfare(colors) {
    unlockAudio();
    const clearDone = playSrcAsync(SOUNDS.clear);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (const color of colors || []) {
      if (!MEEPLE_COLORS.includes(color)) continue;
      await playSrcAsync("assets/sound/win/" + color + ".mp3");
    }
    await clearDone;
  }
  function syncVolumeInputs() {
    const value = String(Math.round(volume * 100));
    document.querySelectorAll(".volume-range").forEach((input) => {
      input.value = value;
    });
  }
  function bindVolumeBar() {
    armUnlock();
    syncVolumeInputs();
    document.querySelectorAll(".volume-range").forEach((input) => {
      input.addEventListener("input", () => {
        setVolume(Number(input.value) / 100);
        unlockAudio();
      });
    });
  }
  armUnlock();
  var TileCityAudio = {
    getVolume,
    setVolume,
    playSound,
    playSoundAsync,
    playMeepleSound,
    playWinSound,
    playEndFanfare,
    bindVolumeBar,
    unlockAudio,
    getAudioDebugState
  };
  if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;
  var audio_default = TileCityAudio;

  // js/game/catalog.js
  var TYPES = [
    { id: "A", name: "\u4FEE\u9053\u9662\u3068\u9053", count: 2, edges: ["F", "F", "R", "F"], cities: [], roads: [["S"]], monastery: true },
    { id: "B", name: "\u4FEE\u9053\u9662", count: 4, edges: ["F", "F", "F", "F"], cities: [], roads: [], monastery: true },
    { id: "C", name: "\u56DB\u8FBA\u304C\u90FD\u5E02", count: 1, edges: ["C", "C", "C", "C"], cities: [{ edges: ["N", "E", "S", "W"], pennant: true }], roads: [], monastery: false },
    { id: "D", name: "\u90FD\u5E02\u3068\u76F4\u7DDA\u306E\u9053", count: 4, edges: ["C", "R", "F", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["E", "W"]], monastery: false },
    { id: "E", name: "\u4E00\u65B9\u3060\u3051\u306E\u90FD\u5E02", count: 5, edges: ["C", "F", "F", "F"], cities: [{ edges: ["N"], pennant: false }], roads: [], monastery: false },
    { id: "F", name: "\u5411\u304B\u3044\u306E\u90FD\u5E02\u304C\u3064\u306A\u304C\u308B", count: 2, edges: ["F", "C", "F", "C"], cities: [{ edges: ["E", "W"], pennant: true }], roads: [], monastery: false },
    { id: "G", name: "\u5411\u304B\u3044\u306E\u90FD\u5E02\u304C\u3064\u306A\u304C\u308B", count: 1, edges: ["F", "C", "F", "C"], cities: [{ edges: ["E", "W"], pennant: false }], roads: [], monastery: false },
    { id: "H", name: "\u5411\u304B\u3044\u306E\u90FD\u5E02\u304C\u5206\u304B\u308C\u308B", count: 3, edges: ["C", "F", "C", "F"], cities: [{ edges: ["N"], pennant: false }, { edges: ["S"], pennant: false }], roads: [], monastery: false },
    { id: "I", name: "\u96A3\u306E\u90FD\u5E02\u304C\u5206\u304B\u308C\u308B", count: 2, edges: ["C", "F", "F", "C"], cities: [{ edges: ["N"], pennant: false }, { edges: ["W"], pennant: false }], roads: [], monastery: false },
    { id: "J", name: "\u90FD\u5E02\u3068\u53F3\u306E\u30AB\u30FC\u30D6", count: 3, edges: ["C", "R", "R", "F"], cities: [{ edges: ["N"], pennant: false }], roads: [["E", "S"]], monastery: false },
    { id: "K", name: "\u90FD\u5E02\u3068\u5DE6\u306E\u30AB\u30FC\u30D6", count: 3, edges: ["C", "F", "R", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["S", "W"]], monastery: false },
    { id: "L", name: "\u90FD\u5E02\u3068\u4E09\u53C9\u8DEF", count: 3, edges: ["C", "R", "R", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["E"], ["S"], ["W"]], monastery: false },
    { id: "M", name: "\u89D2\u306E\u90FD\u5E02", count: 2, edges: ["C", "C", "F", "F"], cities: [{ edges: ["N", "E"], pennant: true }], roads: [], monastery: false },
    { id: "N", name: "\u89D2\u306E\u90FD\u5E02", count: 3, edges: ["C", "C", "F", "F"], cities: [{ edges: ["N", "E"], pennant: false }], roads: [], monastery: false },
    { id: "O", name: "\u89D2\u306E\u90FD\u5E02\u3068\u9053", count: 2, edges: ["C", "R", "R", "C"], cities: [{ edges: ["N", "W"], pennant: true }], roads: [["E", "S"]], monastery: false },
    { id: "P", name: "\u89D2\u306E\u90FD\u5E02\u3068\u9053", count: 3, edges: ["C", "R", "R", "C"], cities: [{ edges: ["N", "W"], pennant: false }], roads: [["E", "S"]], monastery: false },
    { id: "Q", name: "\u4E09\u65B9\u304C\u90FD\u5E02", count: 1, edges: ["C", "C", "F", "C"], cities: [{ edges: ["N", "E", "W"], pennant: true }], roads: [], monastery: false },
    { id: "R", name: "\u4E09\u65B9\u304C\u90FD\u5E02", count: 3, edges: ["C", "C", "F", "C"], cities: [{ edges: ["N", "E", "W"], pennant: false }], roads: [], monastery: false },
    { id: "S", name: "\u4E09\u65B9\u306E\u90FD\u5E02\u3068\u5165\u53E3\u306E\u9053", count: 2, edges: ["C", "C", "R", "C"], cities: [{ edges: ["N", "E", "W"], pennant: true }], roads: [["S"]], monastery: false },
    { id: "T", name: "\u4E09\u65B9\u306E\u90FD\u5E02\u3068\u5165\u53E3\u306E\u9053", count: 1, edges: ["C", "C", "R", "C"], cities: [{ edges: ["N", "E", "W"], pennant: false }], roads: [["S"]], monastery: false },
    { id: "U", name: "\u76F4\u7DDA\u306E\u9053", count: 8, edges: ["R", "F", "R", "F"], cities: [], roads: [["N", "S"]], monastery: false },
    { id: "V", name: "\u30AB\u30FC\u30D6", count: 9, edges: ["F", "F", "R", "R"], cities: [], roads: [["S", "W"]], monastery: false },
    { id: "W", name: "\u4E09\u53C9\u8DEF", count: 4, edges: ["F", "R", "R", "R"], cities: [], roads: [["E"], ["S"], ["W"]], monastery: false },
    { id: "X", name: "\u5341\u5B57\u8DEF", count: 1, edges: ["R", "R", "R", "R"], cities: [], roads: [["N"], ["E"], ["S"], ["W"]], monastery: false }
  ];
  function pillars(...corners) {
    return corners.map((c) => `<i class="city-pillar ${c}"></i>`).join("");
  }
  function city(cls, inner = "", feat = "city-0") {
    return `<i class="city ${cls}" data-feat="${feat}">${inner}</i>`;
  }
  function gatePillarHTML(side) {
    return '<span class="gate-pillar ' + side + '"><span class="roof"></span><span class="win"></span></span>';
  }
  function cityTowerHTML() {
    return '<span class="city-keep" title="\u5854">' + gatePillarHTML("left") + '<span class="city-tower"><span class="roof"></span><span class="win"></span><span class="door"></span></span>' + gatePillarHTML("right") + "</span>";
  }
  function road(cls, feat) {
    return `<i class="road ${cls}" data-feat="${feat}"></i>`;
  }
  function bend(cls, feat) {
    return `<i class="bend ${cls}" data-feat="${feat}"></i>`;
  }
  function monasteryHTML(withFeat = true) {
    const feat = withFeat ? ' data-feat="monastery"' : "";
    return '<span class="monastery"' + feat + '><span class="wing left"><span class="win"></span></span><span class="wing right"><span class="win"></span></span><span class="cross"></span><span class="roof"></span><span class="body"><span class="win"></span><span class="win"></span></span></span>';
  }
  var MARKUP = {
    A: road("to-s", "road-0") + monasteryHTML(true),
    B: monasteryHTML(true),
    /* Fill has no field wall — pillars only (all edges connect); keep in the center. */
    C: city("fill", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + '<i class="pennant p-c" title="\u65D7"></i>',
    D: city("cap n shallow", pillars("nw", "ne")) + road("h", "road-0"),
    E: city("cap n", pillars("nw", "ne")),
    F: city("bar h", pillars("nw", "ne", "sw", "se")) + '<i class="pennant p-bar" title="\u65D7"></i>',
    G: city("bar h", pillars("nw", "ne", "sw", "se")),
    H: city("cap n", pillars("nw", "ne"), "city-0") + city("cap s", pillars("sw", "se"), "city-1"),
    I: city("cap n gap-w", pillars("nw", "ne"), "city-0") + city("cap w gap-n", pillars("nw", "sw"), "city-1"),
    J: city("cap n", pillars("nw", "ne")) + bend("se edge", "road-0") + bend("se line", "road-0"),
    K: city("cap n", pillars("nw", "ne")) + bend("sw edge", "road-0") + bend("sw line", "road-0"),
    L: city("cap n shallow", pillars("nw", "ne")) + road("h-e", "road-0") + road("h-w", "road-2") + road("v-s", "road-1") + '<i class="village"></i>',
    M: city("elbow ne", pillars("nw", "ne", "se")) + '<i class="pennant p-ne" title="\u65D7"></i>',
    N: city("elbow ne", pillars("nw", "ne", "se")),
    O: city("elbow nw", pillars("nw", "ne", "sw")) + bend("se edge", "road-0") + bend("se line", "road-0") + '<i class="pennant p-nw" title="\u65D7"></i>',
    P: city("elbow nw", pillars("nw", "ne", "sw")) + bend("se edge", "road-0") + bend("se line", "road-0"),
    /* Mouth city — keep sits in the city mass (above the south notch / gate). */
    Q: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + '<i class="pennant p-u" title="\u65D7"></i>',
    R: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()),
    S: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + road("gate", "road-0") + '<i class="pennant p-u" title="\u65D7"></i>',
    T: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + road("gate", "road-0"),
    U: road("v", "road-0"),
    V: bend("sw edge", "road-0") + bend("sw line", "road-0"),
    W: road("h-e", "road-0") + road("h-w", "road-2") + road("v-s", "road-1") + '<i class="village"></i>',
    X: road("v-n", "road-0") + road("h-e", "road-1") + road("v-s", "road-2") + road("h-w", "road-3") + '<i class="village"></i>'
  };
  var BY_ID = Object.fromEntries(TYPES.map((type) => [type.id, type]));

  // js/i18n.js
  var KEY = "tile-city-lang";
  var dict = {
    en: {
      homeTitle: "TileCity",
      homeLead: "A tile-laying game of expanding roads and cities to score points.",
      play: "Play",
      rules: "Rules",
      home: "Home",
      langEn: "EN",
      langJa: "JA",
      langLabel: "Language",
      volumeLabel: "Volume",
      setupTitle: "Prepare to play",
      gameSettingsTitle: "Game settings",
      gameSettingsLead: "Choose which claimed features use player colors.",
      optColorRoads: "Color roads",
      optColorCities: "Color cities",
      optColorMonasteries: "Color monasteries",
      playersTitle: "Player settings",
      setupLead: "2\u20138 players. Name max 10 letters. Each color once.",
      setupLeadBot: "Bots play automatically.",
      addPlayer: "Add player",
      start: "Start",
      back: "Back",
      playerName: "Player name",
      removePlayer: "Remove",
      playersCount: "{n} / {max} players",
      errNeedPlayers: "Need {min}\u2013{max} players.",
      errUniqueColor: "Each color can only be used once.",
      playerKind: "Type",
      playerKindHuman: "Human",
      playerKindBot: "Bot",
      botStrength: "Strength",
      botStrengthStandard: "Standard",
      botBadge: "BOT",
      botThinking: "Bot is playing\u2026",
      colorRed: "Red",
      colorBlue: "Blue",
      colorGreen: "Green",
      colorYellow: "Yellow",
      colorOrange: "Orange",
      colorPurple: "Purple",
      colorWhite: "White",
      colorBrown: "Brown",
      rulesTitle: "TileCity Rules",
      rulesLead: "Follow the board step by step, then skim the notes below if you need them. Original art \u2014 not the publisher\u2019s illustrations.",
      tocTutorial: "Tutorial",
      tocDetails: "Notes",
      tocTiles: "Tiles A\u2013X",
      tutTitle: "How to play",
      tutLead: "One board, building as you go. Switch the explanation \u2014 the map keeps every tile you placed.",
      tutStep: "{n} / {total}",
      tutPrev: "Previous",
      tutNext: "Next",
      tut1Title: "Complete a city",
      tut1Body: "Place a tile so a city is fully walled in. The meeple on that city scores right away.",
      tut1Score: "City: 2 points per tile \u2192 here +4",
      tut2Title: "Complete a road",
      tut2Body: "A crossroads closes the end of a road. When both ends are closed, the road scores.",
      tut2Score: "Road: 1 point per tile \u2192 here +4",
      tut3Title: "Place a monastery",
      tut3Body: "Put a monastery tile down and you may seat a meeple on it. It scores later, when every neighboring space is filled.",
      tut3Score: "No points yet \u2014 the monk waits",
      tut4Title: "Cities merge \u2014 shared score",
      tut4Body: "Connecting two cities joins their meeples. If you and an opponent are tied for most, you both get the full points.",
      tut4Score: "Tied majority \u2192 both score +12",
      tut5Title: "Finish a monastery",
      tut5Body: "Fill the last empty space around a monastery. The monk scores and returns to your hand.",
      tut5Score: "Monastery: 9 points when the 3\xD73 is full",
      tut6Title: "Cities merge \u2014 you alone",
      tut6Body: "If you bring more meeples into the merged city than anyone else, only you score.",
      tut6Score: "2 vs 1 \u2192 only you score +12",
      tut7Title: "Fields at game end",
      tut7Body: "Farmers stay out until the end. Each completed city your field touches is worth 3 points.",
      tut7Score: "Two completed cities \u2192 +6 for the farmer",
      detailsTitle: "Notes",
      notesLead: "Extras the tutorial doesn\u2019t cover \u2014 placement limits, controls, and a scoring cheat sheet.",
      tocPlace: "How to place",
      tocMeeple: "Meeples",
      tocScore: "Scoring",
      tocControls: "Controls",
      tocGoal: "Goal",
      tocSetup: "Setup",
      tocTurn: "Turn",
      tocEnd: "Game end",
      goalTitle: "Goal",
      goalBody: "Take turns placing tiles and meeples. Complete roads, cities, and monasteries during the game to score points. When the last tile is placed, score leftover roads, cities, monasteries, and fields. Highest score wins.",
      setupSecTitle: "Setup",
      setupPlayers: "Players",
      setupPlayersBody: "2\u20138 players. Each color has 7 meeples. On the prepare screen, choose names (max 10 letters) and unique colors.",
      setupStartTile: "Start tile",
      setupStartTileBody: "Place the marked D tile face-up in the center. Shuffle the other 71 tiles into the deck.",
      setupFirst: "First player",
      setupFirstBody: "The starting player is chosen at random. Turns then follow the player list order.",
      turnTitle: "On your turn",
      turnDraw: "1. Draw a tile",
      turnDrawBody: "Take the top tile from the deck so everyone can see it.",
      turnPlace: "2. Place the tile",
      turnPlaceBody: "Rotate in 90\xB0 steps and place it so the edges match neighboring tiles (see Placement). If it cannot be placed in any orientation, discard it and draw again \u2014 your turn is not spent.",
      turnMeeple: "3. Place a meeple (optional)",
      turnMeepleBody: "You may put one of your meeples on a free road, city, monastery, or field on the tile you just placed.",
      turnScore: "4. Score completed areas",
      turnScoreBody: "If that placement completes a road, city, or monastery, score it now. Meeples on those completed areas return to their owners.",
      placeTitle: "How to place tiles",
      placeTouch: "Share a full side",
      placeTouchBody: "The new tile must touch an existing tile along at least one full side. Touching only at a corner does not count.",
      placeEdges: "Matching edges",
      placeEdgesBody: "Where tiles touch, the terrain must continue: city to city, road to road, field to field.",
      placeNoFlip: "Rotate only",
      placeNoFlipBody: "You may rotate the tile, but you cannot flip or mirror it.",
      placeOpen: "Grow in any direction",
      placeOpenBody: "The map can expand freely in every direction.",
      legalTitle: "OK example",
      legalBody: "Center is start tile D. North city matches E rotated 180\xB0. East road matches U rotated 90\xB0. South field matches V\u2019s north field.",
      illegalEdgesTitle: "Not allowed \u2014 edges clash",
      illegalEdgesBody: "D\u2019s east edge is a road, but unrotated E\u2019s west edge is a field. Even one mismatched side means you cannot place it there.",
      illegalCornerTitle: "Not allowed \u2014 corner only",
      illegalCornerBody: "Tiles that only meet at a corner do not share a side, so you cannot place them that way.",
      meepleTitle: "Meeples",
      meepleWhere: "Where you can place",
      meepleWhereBody: "Only on the tile you just placed \u2014 on a free road, city, monastery, or field mark.",
      meepleOne: "No joining occupied areas",
      meepleOneBody: "You cannot place a meeple on a road, city, or field that already has any meeple somewhere in its connected area.",
      meepleStock: "Running out",
      meepleStockBody: "If you have no meeples left, place the tile only. Completing a road, city, or monastery returns those meeples (except during final scoring).",
      meepleSkip: "Skipping",
      meepleSkipBody: "You may place the tile and choose not to place a meeple.",
      scoreTitle: "Scoring during the game",
      scoreIntro: "When a road, city, or monastery is completed, the player with the most meeples on it scores. If tied for most, each tied player scores the full points. Those meeples then return to their owners.",
      scoreFeature: "Area",
      scoreComplete: "When completed",
      scoreRoad: "Road",
      scoreRoadBody: "1 point per tile in the road",
      scoreCity: "City",
      scoreCityBody: "2 points per tile + 2 per pennant (banner)",
      scoreMonastery: "Monastery",
      scoreMonasteryBody: "9 points when all 8 surrounding spaces are filled",
      scoreField: "Field",
      scoreFieldBody: "Not scored during the game",
      endTitle: "Game end",
      endWhen: "When it ends",
      endWhenBody: "After the last tile is placed (or you Exit early), final scoring runs.",
      endRoads: "Incomplete roads",
      endRoadsBody: "1 point per tile.",
      endCities: "Incomplete cities",
      endCitiesBody: "1 point per tile + 1 per pennant.",
      endMonasteries: "Incomplete monasteries",
      endMonasteriesBody: "1 point per filled space in the 3\xD73 area (including the monastery tile).",
      endFields: "Fields",
      endFieldsBody: "Farmers stay on the board. Each field scores 3 points for every completed city it touches. Majority works the same as above.",
      endMeeples: "Meeples",
      endMeeplesBody: "Final scoring does not return meeples. +N labels show what each one scored.",
      endTies: "Ties",
      endTiesBody: "Equal score \u2192 the player with more meeples still in hand ranks higher.",
      controlsTitle: "Controls",
      controlsRotate: "Rotate",
      controlsRotateBody: "Right-click the board, press R while the pointer is over the board, or tap the hand preview / angle thumbs.",
      controlsZoom: "Zoom",
      controlsZoomBody: "Mouse wheel or pinch. Buttons on desktop legend.",
      controlsPan: "Pan",
      controlsPanBody: "Drag the board.",
      controlsHints: "Hints",
      controlsHintsBody: "Green = can place now. Gray = needs a different rotation.",
      tileITitle: "Separate cities on tile I",
      tileIIntro: "Tile I has two cities that only meet at a corner. They stay separate unless each connects to other tiles along a full city edge.",
      tileINorth: "Joining the north city",
      tileINorthBody: "E rotated 180\xB0 matches I\u2019s north city edge. I\u2019s west city stays separate.",
      tileIWest: "Joining the west city",
      tileIWestBody: "E rotated 90\xB0 matches I\u2019s west city edge. I\u2019s north city stays separate.",
      tileIBoth: "Still two cities",
      tileIBothBody: "Even with both sides filled, I\u2019s cities stay split by the field inside the tile. Corner-only contact between the two E tiles does not merge them.",
      tilesTitle: "Tiles A\u2013X",
      tilesIntro: "Same letter codes and counts as the classic base set. North is up in the catalog. J and K are mirrors \u2014 rotation never turns one into the other. Pennants (banners) are listed separately from plain twins.",
      legendField: "Field",
      legendRoad: "Road",
      legendCity: "City",
      legendPennant: "Pennant",
      badgePennant: "Pennant",
      badgeStart: "1 is start",
      tileA: "Monastery + road",
      tileB: "Monastery",
      tileC: "City all sides",
      tileD: "City + straight road",
      tileE: "Single city side",
      tileF: "Linked opposite cities",
      tileG: "Linked opposite cities",
      tileGExtra: "Like F, no pennant.",
      tileH: "Split opposite cities",
      tileI: "Split adjacent cities",
      tileJ: "City + right curve",
      tileK: "City + left curve",
      tileL: "City + 3-way road",
      tileM: "Corner city",
      tileN: "Corner city",
      tileO: "Corner city + road",
      tileP: "Corner city + road",
      tileQ: "3-side city",
      tileR: "3-side city",
      tileS: "3-side city + gate road",
      tileT: "3-side city + gate road",
      tileU: "Straight road",
      tileV: "Curve",
      tileW: "3-way road",
      tileX: "Crossroads",
      edgesA: "N field \xB7 E field \xB7 S road \xB7 W field",
      edgesB: "All sides field",
      edgesD: "N city \xB7 E road \xB7 S field \xB7 W road",
      edgesE: "N city \xB7 else field",
      rulesFoot: "TileCity \xB7 base-set rules adapted for this browser version.",
      canPlace: "Can place",
      needsRotate: "Needs rotate",
      rotHint: "Right-click or R to rotate \xB7 Wheel to zoom",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      deck: "deck",
      board: "board",
      discards: "discards",
      exit: "Exit",
      rank: "Ranking",
      again: "Again",
      skip: "Skip",
      ok: "OK",
      endGame: "End",
      cancel: "Cancel",
      boardView: "Board",
      rotateTile: "Rotate tile",
      unplaceableTile: "Unplaceable tile",
      placeMeeple: "Place meeple",
      undoPlace: "Undo place",
      noLegalPlace: "Nowhere to place this tile",
      endThisGame: "End this game?",
      gameOver: "Ranking",
      pickMeeple: "Pick a mark to place a meeple",
      noMeeplesLeft: "No meeples left",
      noOpenSpot: "No open spot for a meeple",
      share: "Share",
      shareTitle: "Share ranking",
      shareLead: "Share the ranking text and a link to TileCity.",
      shareNative: "Share\u2026",
      shareCopy: "Copy text",
      shareCopyUrl: "Copy link",
      shareSns: "Social",
      shareTextTitle: "I played TileCity!",
      shareDone: "Shared.",
      shareCopied: "Ranking text copied.",
      shareLinkCopied: "Link copied.",
      shareCopyFail: "Copy failed.",
      shareNativeUnavailable: "System share is unavailable here. Copy the text instead."
    },
    ja: {
      homeTitle: "TileCity",
      homeLead: "\u9053\u3068\u90FD\u5E02\u3092\u5E83\u3052\u3066\u5F97\u70B9\u3092\u7AF6\u3046\u30BF\u30A4\u30EB\u914D\u7F6E\u30B2\u30FC\u30E0\u3002",
      play: "\u904A\u3076",
      rules: "\u30EB\u30FC\u30EB",
      home: "\u30DB\u30FC\u30E0",
      langEn: "EN",
      langJa: "JA",
      langLabel: "\u8A00\u8A9E",
      volumeLabel: "\u97F3\u91CF",
      setupTitle: "\u30B2\u30FC\u30E0\u306E\u6E96\u5099",
      gameSettingsTitle: "\u30B2\u30FC\u30E0\u8A2D\u5B9A",
      gameSettingsLead: "\u5360\u9818\u3057\u305F\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u3067\u5857\u308B\u304B\u3092\u9078\u3073\u307E\u3059\u3002",
      optColorRoads: "\u9053\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u306B\u3059\u308B",
      optColorCities: "\u90FD\u5E02\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u306B\u3059\u308B",
      optColorMonasteries: "\u4FEE\u9053\u9662\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u306B\u3059\u308B",
      playersTitle: "\u30D7\u30EC\u30A4\u30E4\u30FC\u8A2D\u5B9A",
      setupLead: "2\u301C8\u4EBA\u3002\u540D\u524D\u306F\u6700\u592710\u6587\u5B57\u3002\u8272\u306F\u91CD\u8907\u4E0D\u53EF\u3002",
      setupLeadBot: "Bot\u306F\u81EA\u52D5\u3067\u624B\u756A\u3092\u9032\u3081\u307E\u3059\u3002",
      addPlayer: "\u30D7\u30EC\u30A4\u30E4\u30FC\u8FFD\u52A0",
      start: "\u958B\u59CB",
      back: "\u623B\u308B",
      playerName: "\u30D7\u30EC\u30A4\u30E4\u30FC\u540D",
      removePlayer: "\u524A\u9664",
      playersCount: "{n} / {max} \u4EBA",
      errNeedPlayers: "{min}\u301C{max} \u4EBA\u5FC5\u8981\u3067\u3059\u3002",
      errUniqueColor: "\u540C\u3058\u8272\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002",
      playerKind: "\u7A2E\u5225",
      playerKindHuman: "\u4EBA\u9593",
      playerKindBot: "bot",
      botStrength: "\u5F37\u3055",
      botStrengthStandard: "\u6A19\u6E96",
      botBadge: "BOT",
      botThinking: "Bot\u306E\u624B\u756A\u2026",
      colorRed: "\u8D64",
      colorBlue: "\u9752",
      colorGreen: "\u7DD1",
      colorYellow: "\u9EC4",
      colorOrange: "\u6A59",
      colorPurple: "\u7D2B",
      colorWhite: "\u767D",
      colorBrown: "\u8336",
      rulesTitle: "TileCity \u30EB\u30FC\u30EB",
      rulesLead: "\u76E4\u9762\u3092\u898B\u306A\u304C\u3089\u624B\u3092\u9032\u3081\u3066\u3001\u5FC5\u8981\u306A\u3089\u4E0B\u306E\u88DC\u8DB3\u3092\u8AAD\u3093\u3067\u304F\u3060\u3055\u3044\u3002\u30AA\u30EA\u30B8\u30CA\u30EB\u7D75\u67C4\u3067\u3059\uFF08\u88FD\u54C1\u306E\u30A4\u30E9\u30B9\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
      tocTutorial: "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB",
      tocDetails: "\u88DC\u8DB3",
      tocTiles: "\u30BF\u30A4\u30EB A\u2013X",
      tutTitle: "\u904A\u3073\u65B9",
      tutLead: "\u76E4\u9762\u306F\u3072\u3068\u3064\u3002\u30BF\u30A4\u30EB\u306F\u5F15\u304D\u7D99\u304C\u308C\u307E\u3059\u3002\u77E2\u5370\u3067\u89E3\u8AAC\u3060\u3051\u5207\u308A\u66FF\u3048\u307E\u3059\u3002",
      tutStep: "{n} / {total}",
      tutPrev: "\u524D\u3078",
      tutNext: "\u6B21\u3078",
      tut1Title: "\u90FD\u5E02\u3092\u5B8C\u6210\u3055\u305B\u3066\u5F97\u70B9",
      tut1Body: "\u57CE\u58C1\u3067\u56F2\u307E\u308C\u308B\u3088\u3046\u306B\u30BF\u30A4\u30EB\u3092\u7F6E\u304F\u3068\u3001\u90FD\u5E02\u304C\u5B8C\u6210\u3057\u307E\u3059\u3002\u305D\u306E\u90FD\u5E02\u306B\u3044\u308B\u30DF\u30FC\u30D7\u30EB\u304C\u3059\u3050\u306B\u5F97\u70B9\u3057\u307E\u3059\u3002",
      tut1Score: "\u90FD\u5E02\uFF1A\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 \u2192 \u3053\u3053\u3067\u306F +4",
      tut2Title: "\u4EA4\u5DEE\u70B9\u3067\u9053\u3092\u5B8C\u6210",
      tut2Body: "\u4EA4\u5DEE\u70B9\u3092\u7F6E\u304F\u3068\u9053\u306E\u7AEF\u304C\u9589\u3058\u3066\u5B8C\u6210\u3057\u307E\u3059\u3002\u4E21\u7AEF\u304C\u9589\u3058\u305F\u9053\u304C\u5F97\u70B9\u306B\u306A\u308A\u307E\u3059\u3002",
      tut2Score: "\u9053\uFF1A\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 \u2192 \u3053\u3053\u3067\u306F +4",
      tut3Title: "\u4FEE\u9053\u9662\u3092\u7F6E\u304F",
      tut3Body: "\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u3092\u7F6E\u304D\u3001\u30DF\u30FC\u30D7\u30EB\u3092\u4E57\u305B\u308B\u3053\u3068\u304C\u3067\u304D\u307E\u3059\u3002\u5F97\u70B9\u306F\u3001\u5468\u56F2\u304C\u3059\u3079\u3066\u57CB\u307E\u3063\u305F\u3068\u304D\u306B\u5165\u308A\u307E\u3059\u3002",
      tut3Score: "\u307E\u3060\u5F97\u70B9\u306A\u3057 \u2014 \u4FEE\u9053\u58EB\u306F\u5F85\u3061\u307E\u3059",
      tut4Title: "\u90FD\u5E02\u304C\u5408\u6D41 \u2014 \u540C\u6642\u306B\u5F97\u70B9",
      tut4Body: "\u5225\u3005\u306E\u90FD\u5E02\u3092\u3064\u306A\u3050\u3068\u30DF\u30FC\u30D7\u30EB\u3082\u5408\u6D41\u3057\u307E\u3059\u3002\u6700\u591A\u304C\u540C\u6570\u306A\u3089\u3001\u305D\u306E\u5168\u54E1\u304C\u540C\u3058\u70B9\u6570\u3092\u5F97\u307E\u3059\u3002",
      tut4Score: "\u540C\u6570 \u2192 \u3069\u3061\u3089\u3082 +12",
      tut5Title: "\u4FEE\u9053\u9662\u306E\u5468\u308A\u3092\u57CB\u3081\u3066\u5F97\u70B9",
      tut5Body: "\u4FEE\u9053\u9662\u306E\u5468\u56F2\u3067\u6700\u5F8C\u306E1\u30DE\u30B9\u3092\u57CB\u3081\u308B\u3068\u5B8C\u6210\u3002\u4FEE\u9053\u58EB\u304C\u5F97\u70B9\u3057\u3066\u624B\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
      tut5Score: "\u4FEE\u9053\u9662\uFF1A3\xD73\u304C\u57CB\u307E\u308B\u3068 9\u70B9",
      tut6Title: "\u90FD\u5E02\u304C\u5408\u6D41 \u2014 \u81EA\u5206\u3060\u3051\u5F97\u70B9",
      tut6Body: "\u5408\u6D41\u3057\u305F\u90FD\u5E02\u3067\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u76F8\u624B\u3088\u308A\u591A\u3044\u3068\u304D\u3001\u5F97\u70B9\u3067\u304D\u308B\u306E\u306F\u81EA\u5206\u3060\u3051\u3067\u3059\u3002",
      tut6Score: "2\u5BFE1 \u2192 \u81EA\u5206\u3060\u3051 +12",
      tut7Title: "\u30B2\u30FC\u30E0\u7D42\u4E86\u3068\u7551\u306E\u5F97\u70B9",
      tut7Body: "\u8FB2\u6C11\uFF08\u7551\u306E\u30DF\u30FC\u30D7\u30EB\uFF09\u306F\u6700\u5F8C\u307E\u3067\u76E4\u9762\u306B\u6B8B\u308A\u307E\u3059\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3067\u3059\u3002",
      tut7Score: "\u5B8C\u6210\u90FD\u5E02\u304C2\u3064 \u2192 \u8FB2\u6C11\u306F +6",
      detailsTitle: "\u88DC\u8DB3",
      notesLead: "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB\u3067\u89E6\u308C\u3066\u3044\u306A\u3044\u7F6E\u304D\u65B9\u306E\u5236\u9650\u3001\u64CD\u4F5C\u3001\u5F97\u70B9\u65E9\u898B\u8868\u3067\u3059\u3002",
      tocPlace: "\u7F6E\u304D\u65B9",
      tocMeeple: "\u30DF\u30FC\u30D7\u30EB",
      tocScore: "\u5F97\u70B9",
      tocControls: "\u64CD\u4F5C",
      tocGoal: "\u76EE\u7684",
      tocSetup: "\u6E96\u5099",
      tocTurn: "\u624B\u756A",
      tocEnd: "\u7D42\u4E86",
      goalTitle: "\u76EE\u7684",
      goalBody: "\u9806\u756A\u306B\u30BF\u30A4\u30EB\u3068\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u3044\u3066\u3044\u304D\u307E\u3059\u3002\u30B2\u30FC\u30E0\u4E2D\u306B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5B8C\u6210\u3055\u305B\u308B\u3068\u5F97\u70B9\u3002\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u3089\u3001\u6B8B\u3063\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3068\u7551\u3082\u5F97\u70B9\u3057\u3001\u4E00\u756A\u70B9\u304C\u9AD8\u3044\u4EBA\u304C\u52DD\u3061\u3067\u3059\u3002",
      setupSecTitle: "\u6E96\u5099",
      setupPlayers: "\u30D7\u30EC\u30A4\u30E4\u30FC",
      setupPlayersBody: "2\u301C8\u4EBA\u3002\u5404\u82727\u4F53\u306E\u30DF\u30FC\u30D7\u30EB\u3092\u4F7F\u3044\u307E\u3059\u3002\u6E96\u5099\u753B\u9762\u3067\u540D\u524D\uFF08\u6700\u592710\u6587\u5B57\uFF09\u3068\u8272\u3092\u9078\u3073\u307E\u3059\uFF08\u8272\u306E\u91CD\u8907\u306F\u4E0D\u53EF\uFF09\u3002",
      setupStartTile: "\u30B9\u30BF\u30FC\u30C8\u30BF\u30A4\u30EB",
      setupStartTileBody: "\u5370\u4ED8\u304D\u306E D \u30BF\u30A4\u30EB1\u679A\u3092\u4E2D\u592E\u306B\u8868\u5411\u304D\u3067\u7F6E\u304D\u307E\u3059\u3002\u6B8B\u308A71\u679A\u3092\u3088\u304F\u6DF7\u305C\u3066\u5C71\u672D\u306B\u3057\u307E\u3059\u3002",
      setupFirst: "\u5148\u624B",
      setupFirstBody: "\u5148\u624B\u306F\u30E9\u30F3\u30C0\u30E0\u306B\u6C7A\u307E\u308A\u307E\u3059\u3002\u4EE5\u964D\u306F\u30D7\u30EC\u30A4\u30E4\u30FC\u306E\u4E26\u3073\u9806\u306B\u624B\u756A\u304C\u56DE\u308A\u307E\u3059\u3002",
      turnTitle: "\u624B\u756A\u306E\u6D41\u308C",
      turnDraw: "1. \u30BF\u30A4\u30EB\u3092\u5F15\u304F",
      turnDrawBody: "\u5C71\u672D\u306E\u4E00\u756A\u4E0A\u30921\u679A\u5F15\u304D\u3001\u5168\u54E1\u306B\u898B\u3048\u308B\u3088\u3046\u306B\u3057\u307E\u3059\u3002",
      turnPlace: "2. \u30BF\u30A4\u30EB\u3092\u7F6E\u304F",
      turnPlaceBody: "90\xB0\u5358\u4F4D\u3067\u56DE\u8EE2\u3057\u3001\u96A3\u306E\u30BF\u30A4\u30EB\u3068\u7D75\u67C4\u304C\u3064\u306A\u304C\u308B\u3088\u3046\u306B\u7F6E\u304D\u307E\u3059\uFF08\u7F6E\u304D\u65B9\u53C2\u7167\uFF09\u3002\u3069\u306E\u5411\u304D\u3067\u3082\u7F6E\u3051\u306A\u3044\u5834\u5408\u306F\u6368\u3066\u3066\u5F15\u304D\u76F4\u3057\u307E\u3059\u3002\u3053\u306E\u3068\u304D\u624B\u756A\u306F\u6D88\u8CBB\u3057\u307E\u305B\u3093\u3002",
      turnMeeple: "3. \u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F\uFF08\u4EFB\u610F\uFF09",
      turnMeepleBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u3001\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u7551\u306B\u3001\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u30921\u4F53\u7F6E\u3051\u307E\u3059\u3002\u7F6E\u304B\u306A\u304F\u3066\u3082\u69CB\u3044\u307E\u305B\u3093\u3002",
      turnScore: "4. \u5B8C\u6210\u3057\u305F\u5834\u6240\u306E\u5F97\u70B9",
      turnScoreBody: "\u305D\u306E\u914D\u7F6E\u3067\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3057\u305F\u3089\u3001\u3059\u3050\u306B\u5F97\u70B9\u3057\u307E\u3059\u3002\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u6301\u3061\u4E3B\u306E\u624B\u5143\u3078\u623B\u308A\u307E\u3059\u3002",
      placeTitle: "\u30BF\u30A4\u30EB\u306E\u7F6E\u304D\u65B9",
      placeTouch: "\u8FBA\u3067\u63A5\u3059\u308B",
      placeTouchBody: "\u65B0\u3057\u3044\u30BF\u30A4\u30EB\u306F\u3001\u3059\u3067\u306B\u7F6E\u3044\u3066\u3042\u308B\u30BF\u30A4\u30EB\u3068\u5C11\u306A\u304F\u3068\u30821\u8FBA\u5168\u4F53\u3067\u63A5\u3059\u308B\u3088\u3046\u306B\u7F6E\u304D\u307E\u3059\u3002\u89D2\u3060\u3051\u304C\u89E6\u308C\u3066\u3044\u308B\u72B6\u614B\u3067\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      placeEdges: "\u7D75\u67C4\u3092\u3064\u306A\u3052\u308B",
      placeEdgesBody: "\u63A5\u3059\u308B\u8FBA\u306F\u7AEF\u304B\u3089\u7AEF\u307E\u3067\u540C\u3058\u5730\u5F62\u3067\u3042\u308B\u3053\u3068\u3002\u90FD\u5E02\u306F\u90FD\u5E02\u3001\u9053\u306F\u9053\u3001\u7551\u306F\u7551\u306B\u3064\u306A\u304C\u308A\u307E\u3059\u3002",
      placeNoFlip: "\u56DE\u8EE2\u306E\u307F",
      placeNoFlipBody: "\u30BF\u30A4\u30EB\u306F\u56DE\u8EE2\u3067\u304D\u307E\u3059\u304C\u3001\u88CF\u8FD4\u3057\u305F\u308A\u93E1\u6620\u3057\u305F\u308A\u306F\u3067\u304D\u307E\u305B\u3093\u3002",
      placeOpen: "\u3069\u306E\u65B9\u5411\u306B\u3082\u4F38\u3070\u305B\u308B",
      placeOpenBody: "\u30DE\u30C3\u30D7\u306F\u4E0A\u4E0B\u5DE6\u53F3\u3001\u3069\u306E\u65B9\u5411\u306B\u3082\u5E83\u3052\u3089\u308C\u307E\u3059\u3002",
      legalTitle: "\u7F6E\u3051\u308B\u4F8B",
      legalBody: "\u4E2D\u592E\u306F\u30B9\u30BF\u30FC\u30C8\u30BF\u30A4\u30EB D\u3002\u5317\u306E\u90FD\u5E02\u306F 180\xB0 \u56DE\u8EE2\u306E E\u3001\u6771\u306E\u9053\u306F 90\xB0 \u56DE\u8EE2\u306E U\u3001\u5357\u306E\u7551\u306F V \u306E\u5317\u7551\u3068\u3064\u306A\u304C\u3063\u3066\u3044\u307E\u3059\u3002",
      illegalEdgesTitle: "\u7F6E\u3051\u306A\u3044\u4F8B \u2014 \u8FBA\u304C\u5408\u308F\u306A\u3044",
      illegalEdgesBody: "D \u306E\u6771\u8FBA\u306F\u9053\u306A\u306E\u306B\u3001\u7121\u56DE\u8EE2\u306E E \u306E\u897F\u8FBA\u306F\u7551\u3067\u3059\u30021\u8FBA\u3067\u3082\u5408\u308F\u306A\u3051\u308C\u3070\u3001\u305D\u3053\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      illegalCornerTitle: "\u7F6E\u3051\u306A\u3044\u4F8B \u2014 \u89D2\u3060\u3051",
      illegalCornerBody: "\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u308B\u30BF\u30A4\u30EB\u306F\u8FBA\u3092\u5171\u6709\u3057\u3066\u3044\u306A\u3044\u306E\u3067\u3001\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleTitle: "\u30DF\u30FC\u30D7\u30EB",
      meepleWhere: "\u7F6E\u304D\u5834\u6240",
      meepleWhereBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u4E0A\u3060\u3051\u3002\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u7551\u306E\u30DE\u30FC\u30AF\u306B\u7F6E\u3051\u307E\u3059\u3002",
      meepleOne: "\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u3042\u308B\u5834\u6240\u3078\u306F\u7F6E\u3051\u306A\u3044",
      meepleOneBody: "\u3064\u306A\u304C\u3063\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u7551\u306E\u3069\u3053\u304B\u306B\u3001\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\uFF08\u81EA\u5206\u306E\u3082\u76F8\u624B\u306E\u3082\uFF09\u304C\u3042\u308B\u5834\u5408\u3001\u305D\u3053\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleStock: "\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u304F\u306A\u3063\u305F\u3089",
      meepleStockBody: "\u624B\u5143\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u3051\u308C\u3070\u3001\u30BF\u30A4\u30EB\u3092\u7F6E\u304F\u3060\u3051\u306B\u306A\u308A\u307E\u3059\u3002\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u3059\uFF08\u6700\u7D42\u5F97\u70B9\u6642\u3092\u9664\u304F\uFF09\u3002",
      meepleSkip: "\u7F6E\u304B\u306A\u3044\u9078\u629E",
      meepleSkipBody: "\u30BF\u30A4\u30EB\u3060\u3051\u7F6E\u3044\u3066\u3001\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304B\u306A\u3044\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002",
      scoreTitle: "\u30B2\u30FC\u30E0\u4E2D\u306E\u5F97\u70B9",
      scoreIntro: "\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u306E\u4E0A\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u4E00\u756A\u591A\u3044\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u5F97\u70B9\u3057\u307E\u3059\u3002\u540C\u6570\u306A\u3089\u3001\u305D\u306E\u5168\u54E1\u304C\u540C\u3058\u70B9\u6570\u3092\u3082\u3089\u3048\u307E\u3059\u3002\u5F97\u70B9\u3057\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
      scoreFeature: "\u5834\u6240",
      scoreComplete: "\u5B8C\u6210\u3057\u305F\u3068\u304D",
      scoreRoad: "\u9053",
      scoreRoadBody: "\u9053\u306E\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreCity: "\u90FD\u5E02",
      scoreCityBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 + \u30DA\u30CA\u30F3\u30C8\uFF08\u65D7\uFF091\u3064\u306B\u3064\u304D2\u70B9",
      scoreMonastery: "\u4FEE\u9053\u9662",
      scoreMonasteryBody: "\u5468\u56F28\u30DE\u30B9\u304C\u3059\u3079\u3066\u57CB\u307E\u308B\u30689\u70B9",
      scoreField: "\u7551",
      scoreFieldBody: "\u30B2\u30FC\u30E0\u4E2D\u306F\u5F97\u70B9\u3057\u306A\u3044",
      endTitle: "\u30B2\u30FC\u30E0\u7D42\u4E86",
      endWhen: "\u3044\u3064\u7D42\u308F\u308B\u304B",
      endWhenBody: "\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u5F8C\uFF08\u307E\u305F\u306F\u300C\u9000\u51FA\u300D\u3067\u9014\u4E2D\u7D42\u4E86\u3057\u305F\u3068\u304D\uFF09\u306B\u3001\u6700\u7D42\u5F97\u70B9\u3092\u884C\u3044\u307E\u3059\u3002",
      endRoads: "\u672A\u5B8C\u6210\u306E\u9053",
      endRoadsBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9\u3002",
      endCities: "\u672A\u5B8C\u6210\u306E\u90FD\u5E02",
      endCitiesBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 + \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endMonasteries: "\u672A\u5B8C\u6210\u306E\u4FEE\u9053\u9662",
      endMonasteriesBody: "3\xD73\uFF08\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u3092\u542B\u3080\uFF09\u306E\u57CB\u307E\u3063\u3066\u3044\u308B\u30DE\u30B91\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endFields: "\u7551",
      endFieldsBody: "\u7551\u306B\u7F6E\u3044\u305F\u30DF\u30FC\u30D7\u30EB\uFF08\u8FB2\u6C11\uFF09\u306F\u305D\u306E\u307E\u307E\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3002\u540C\u6570\u306E\u3068\u304D\u306F\u4E0A\u8A18\u3068\u540C\u3058\u3067\u3059\u3002",
      endMeeples: "\u30DF\u30FC\u30D7\u30EB",
      endMeeplesBody: "\u6700\u7D42\u5F97\u70B9\u3067\u306F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u305B\u3093\u3002+N \u8868\u793A\u3067\u5F97\u70B9\u3092\u793A\u3057\u307E\u3059\u3002",
      endTies: "\u540C\u70B9",
      endTiesBody: "\u540C\u70B9\u306A\u3089\u3001\u624B\u5143\u306B\u6B8B\u3063\u3066\u3044\u308B\u30DF\u30FC\u30D7\u30EB\u304C\u591A\u3044\u65B9\u304C\u4E0A\u4F4D\u3067\u3059\u3002",
      controlsTitle: "\u64CD\u4F5C",
      controlsRotate: "\u56DE\u8EE2",
      controlsRotateBody: "\u76E4\u9762\u3092\u53F3\u30AF\u30EA\u30C3\u30AF\u3001\u30DD\u30A4\u30F3\u30BF\u304C\u76E4\u4E0A\u306E\u3068\u304D R\u3001\u307E\u305F\u306F\u624B\u5143\u30D7\u30EC\u30D3\u30E5\u30FC\uFF0F\u89D2\u5EA6\u30B5\u30E0\u3092\u30BF\u30C3\u30D7\u3002",
      controlsZoom: "\u30BA\u30FC\u30E0",
      controlsZoomBody: "\u30DB\u30A4\u30FC\u30EB\u307E\u305F\u306F\u30D4\u30F3\u30C1\u3002\u30C7\u30B9\u30AF\u30C8\u30C3\u30D7\u3067\u306F\u51E1\u4F8B\u306E\u30DC\u30BF\u30F3\u3082\u53EF\u3002",
      controlsPan: "\u30D1\u30F3",
      controlsPanBody: "\u76E4\u9762\u3092\u30C9\u30E9\u30C3\u30B0\u3002",
      controlsHints: "\u30D2\u30F3\u30C8",
      controlsHintsBody: "\u7DD1\uFF1D\u4ECA\u7F6E\u3051\u308B\u3002\u7070\uFF1D\u5225\u306E\u56DE\u8EE2\u304C\u5FC5\u8981\u3002",
      tileITitle: "\u30BF\u30A4\u30EB I \u306E\u5206\u96E2\u90FD\u5E02",
      tileIIntro: "\u30BF\u30A4\u30EB I \u306B\u306F\u3001\u89D2\u3060\u3051\u3067\u63A5\u3059\u308B2\u3064\u306E\u90FD\u5E02\u304C\u3042\u308A\u307E\u3059\u3002\u305D\u308C\u305E\u308C\u304C\u8FBA\u5168\u4F53\u3067\u4ED6\u306E\u30BF\u30A4\u30EB\u3068\u3064\u306A\u304C\u3089\u306A\u3044\u9650\u308A\u3001\u5225\u3005\u306E\u90FD\u5E02\u306E\u307E\u307E\u3067\u3059\u3002",
      tileINorth: "\u5317\u306E\u90FD\u5E02\u3068\u3064\u306A\u3050",
      tileINorthBody: "180\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u5317\u306E\u90FD\u5E02\u8FBA\u3068\u5408\u3044\u307E\u3059\u3002\u897F\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3067\u3059\u3002",
      tileIWest: "\u897F\u306E\u90FD\u5E02\u3068\u3064\u306A\u3050",
      tileIWestBody: "90\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u897F\u306E\u90FD\u5E02\u8FBA\u3068\u5408\u3044\u307E\u3059\u3002\u5317\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3067\u3059\u3002",
      tileIBoth: "\u305D\u308C\u3067\u30822\u3064\u306E\u90FD\u5E02",
      tileIBothBody: "\u4E21\u5074\u304C\u57CB\u307E\u3063\u3066\u3082\u3001\u30BF\u30A4\u30EB\u5185\u306E\u7551\u3067\u90FD\u5E02\u306F\u5206\u304B\u308C\u307E\u3059\u30022\u679A\u306E E \u304C\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u3066\u3082\u3001\u5408\u4F75\u3057\u307E\u305B\u3093\u3002",
      tilesTitle: "\u30BF\u30A4\u30EB A\u2013X",
      tilesIntro: "\u30AF\u30E9\u30B7\u30C3\u30AF\u57FA\u672C\u30BB\u30C3\u30C8\u3068\u540C\u3058\u6587\u5B57\u30B3\u30FC\u30C9\u3068\u679A\u6570\u3067\u3059\u3002\u30AB\u30BF\u30ED\u30B0\u3067\u306F\u4E0A\u304C\u5317\u3002J \u3068 K \u306F\u93E1\u6620\u3067\u3001\u56DE\u8EE2\u3067\u306F\u4E92\u3044\u306B\u306A\u308A\u307E\u305B\u3093\u3002\u30DA\u30CA\u30F3\u30C8\u4ED8\u304D\u306F\u7121\u5370\u3068\u5206\u3051\u3066\u8A18\u8F09\u3057\u3066\u3044\u307E\u3059\u3002",
      legendField: "\u7551",
      legendRoad: "\u9053",
      legendCity: "\u90FD\u5E02",
      legendPennant: "\u30DA\u30CA\u30F3\u30C8",
      badgePennant: "\u30DA\u30CA\u30F3\u30C8",
      badgeStart: "1\u679A\u306F\u958B\u59CB",
      tileA: "\u4FEE\u9053\u9662 + \u9053",
      tileB: "\u4FEE\u9053\u9662",
      tileC: "\u56DB\u65B9\u90FD\u5E02",
      tileD: "\u90FD\u5E02 + \u76F4\u7DDA\u306E\u9053",
      tileE: "\u90FD\u5E021\u8FBA",
      tileF: "\u5BFE\u8FBA\u9023\u7D50\u90FD\u5E02",
      tileG: "\u5BFE\u8FBA\u9023\u7D50\u90FD\u5E02",
      tileGExtra: "F \u3068\u540C\u3058\u5F62\u3067\u30DA\u30CA\u30F3\u30C8\u306A\u3057\u3002",
      tileH: "\u5BFE\u8FBA\u5206\u96E2\u90FD\u5E02",
      tileI: "\u96A3\u8FBA\u5206\u96E2\u90FD\u5E02",
      tileJ: "\u90FD\u5E02 + \u53F3\u30AB\u30FC\u30D6",
      tileK: "\u90FD\u5E02 + \u5DE6\u30AB\u30FC\u30D6",
      tileL: "\u90FD\u5E02 + \u4E09\u53C9\u8DEF",
      tileM: "\u89D2\u90FD\u5E02",
      tileN: "\u89D2\u90FD\u5E02",
      tileO: "\u89D2\u90FD\u5E02 + \u9053",
      tileP: "\u89D2\u90FD\u5E02 + \u9053",
      tileQ: "\u4E09\u8FBA\u90FD\u5E02",
      tileR: "\u4E09\u8FBA\u90FD\u5E02",
      tileS: "\u4E09\u8FBA\u90FD\u5E02 + \u9580\u306E\u9053",
      tileT: "\u4E09\u8FBA\u90FD\u5E02 + \u9580\u306E\u9053",
      tileU: "\u76F4\u7DDA\u306E\u9053",
      tileV: "\u30AB\u30FC\u30D6",
      tileW: "\u4E09\u53C9\u8DEF",
      tileX: "\u5341\u5B57\u8DEF",
      edgesA: "\u5317\u7551 \xB7 \u6771\u7551 \xB7 \u5357\u9053 \xB7 \u897F\u7551",
      edgesB: "\u5168\u8FBA\u7551",
      edgesD: "\u5317\u90FD\u5E02 \xB7 \u6771\u9053 \xB7 \u5357\u7551 \xB7 \u897F\u9053",
      edgesE: "\u5317\u90FD\u5E02 \xB7 \u307B\u304B\u7551",
      rulesFoot: "TileCity \xB7 \u30D6\u30E9\u30A6\u30B6\u7248\u5411\u3051\u306B\u57FA\u672C\u30BB\u30C3\u30C8\u30EB\u30FC\u30EB\u3092\u518D\u69CB\u6210\u3002",
      canPlace: "\u7F6E\u3051\u308B",
      needsRotate: "\u8981\u56DE\u8EE2",
      rotHint: "\u53F3\u30AF\u30EA\u30C3\u30AF / R \u3067\u56DE\u8EE2 \xB7 \u30DB\u30A4\u30FC\u30EB\u3067\u30BA\u30FC\u30E0",
      zoomOut: "\u7E2E\u5C0F",
      zoomIn: "\u62E1\u5927",
      deck: "\u5C71\u672D",
      board: "\u76E4\u9762",
      discards: "\u6368\u3066\u672D",
      exit: "\u9000\u51FA",
      rank: "\u30E9\u30F3\u30AD\u30F3\u30B0",
      again: "\u3082\u3046\u4E00\u5EA6",
      skip: "\u30B9\u30AD\u30C3\u30D7",
      ok: "OK",
      endGame: "\u7D42\u4E86",
      cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
      boardView: "\u76E4\u9762",
      rotateTile: "\u30BF\u30A4\u30EB\u3092\u56DE\u8EE2",
      unplaceableTile: "\u7F6E\u3051\u306A\u3044\u30BF\u30A4\u30EB",
      placeMeeple: "\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F",
      undoPlace: "\u914D\u7F6E\u3092\u623B\u3059",
      noLegalPlace: "\u3053\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3051\u308B\u5834\u6240\u304C\u3042\u308A\u307E\u305B\u3093",
      endThisGame: "\u3053\u306E\u30B2\u30FC\u30E0\u3092\u7D42\u4E86\u3057\u307E\u3059\u304B\uFF1F",
      gameOver: "\u30E9\u30F3\u30AD\u30F3\u30B0",
      pickMeeple: "\u30DE\u30FC\u30AF\u3092\u9078\u3093\u3067\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F",
      noMeeplesLeft: "\u30DF\u30FC\u30D7\u30EB\u304C\u3042\u308A\u307E\u305B\u3093",
      noOpenSpot: "\u7F6E\u3051\u308B\u5834\u6240\u304C\u3042\u308A\u307E\u305B\u3093",
      share: "\u5171\u6709",
      shareTitle: "\u30E9\u30F3\u30AD\u30F3\u30B0\u3092\u5171\u6709",
      shareLead: "\u30E9\u30F3\u30AD\u30F3\u30B0\u6587\u3068 TileCity \u3078\u306E\u30EA\u30F3\u30AF\u3092\u5171\u6709\u3067\u304D\u307E\u3059\u3002",
      shareNative: "\u5171\u6709\u2026",
      shareCopy: "\u30C6\u30AD\u30B9\u30C8\u3092\u30B3\u30D4\u30FC",
      shareCopyUrl: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC",
      shareSns: "SNS",
      shareTextTitle: "TileCity \u3092\u30D7\u30EC\u30A4\u3057\u307E\u3057\u305F\uFF01",
      shareDone: "\u5171\u6709\u3057\u307E\u3057\u305F\u3002",
      shareCopied: "\u30E9\u30F3\u30AD\u30F3\u30B0\u6587\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002",
      shareLinkCopied: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002",
      shareCopyFail: "\u30B3\u30D4\u30FC\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002",
      shareNativeUnavailable: "\u3053\u306E\u74B0\u5883\u3067\u306F\u30B7\u30B9\u30C6\u30E0\u5171\u6709\u3092\u4F7F\u3048\u307E\u305B\u3093\u3002\u30C6\u30AD\u30B9\u30C8\u3092\u30B3\u30D4\u30FC\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    }
  };
  function getLang() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "ja" || stored === "en") return stored;
    } catch (err) {
    }
    const nav = typeof navigator !== "undefined" && navigator.language || "en";
    return String(nav).toLowerCase().startsWith("ja") ? "ja" : "en";
  }
  function setLang(lang) {
    const next = lang === "ja" ? "ja" : "en";
    try {
      localStorage.setItem(KEY, next);
    } catch (err) {
    }
    return next;
  }
  function t(key, lang, vars) {
    const pack = dict[lang || getLang()] || dict.en;
    let text = pack[key] != null ? pack[key] : dict.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach((name) => {
        text = text.split("{" + name + "}").join(String(vars[name]));
      });
    }
    return text;
  }
  function colorLabel(id, lang) {
    const key = "color" + id.charAt(0).toUpperCase() + id.slice(1);
    return t(key, lang);
  }
  function apply(root) {
    const lang = getLang();
    const scope = root || document;
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = lang;
    }
    scope.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (!key) return;
      const attr = node.getAttribute("data-i18n-attr");
      const text = t(key, lang);
      if (attr) node.setAttribute(attr, text);
      else node.textContent = text;
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria"), lang));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.getAttribute("data-i18n-title"), lang));
    });
    scope.querySelectorAll(".lang-bar [data-lang]").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-lang") === lang);
    });
    const bar = (root || document).querySelector(".lang-bar");
    if (bar) bar.setAttribute("aria-label", t("langLabel", lang));
    document.querySelectorAll(".volume-bar").forEach((node) => {
      node.setAttribute("aria-label", t("volumeLabel", lang));
    });
    return lang;
  }
  function bindLangBar(onChange) {
    document.querySelectorAll(".lang-bar [data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLang(btn.getAttribute("data-lang"));
        apply();
        if (typeof onChange === "function") onChange(getLang());
      });
    });
    apply();
  }
  var TileCityI18n = {
    KEY,
    dict,
    getLang,
    setLang,
    t,
    colorLabel,
    apply,
    bindLangBar
  };
  if (typeof globalThis !== "undefined") globalThis.TileCityI18n = TileCityI18n;
  var i18n_default = TileCityI18n;

  // js/rules.js
  i18n_default.bindLangBar();
  audio_default.bindVolumeBar();
  document.querySelectorAll(".tile[data-id]").forEach((tile) => {
    const id = tile.getAttribute("data-id");
    if (id && MARKUP[id]) tile.innerHTML = MARKUP[id];
  });
})();
