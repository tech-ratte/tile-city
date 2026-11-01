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
  function playSrc(src) {
    if (!(volume > 0) || !src) return;
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      void audio.play().catch(() => {
      });
    } catch (err) {
    }
  }
  function playSrcAsync(src) {
    return new Promise((resolve) => {
      if (!(volume > 0) || !src) {
        resolve();
        return;
      }
      try {
        const audio = new Audio(src);
        audio.volume = volume;
        const done = () => resolve();
        audio.addEventListener("ended", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        void audio.play().catch(() => resolve());
      } catch (err) {
        resolve();
      }
    });
  }
  function playSound(name) {
    playSrc(SOUNDS[name]);
  }
  function playMeepleSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    const n = 1 + Math.floor(Math.random() * 3);
    playSrc("assets/sound/meeple/" + color + "/" + color + n + ".mp3");
  }
  function playWinSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    playSrc("assets/sound/win/" + color + ".mp3");
  }
  async function playEndFanfare(colors) {
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
    syncVolumeInputs();
    document.querySelectorAll(".volume-range").forEach((input) => {
      input.addEventListener("input", () => {
        setVolume(Number(input.value) / 100);
      });
    });
  }
  var TileCityAudio = {
    getVolume,
    setVolume,
    playSound,
    playMeepleSound,
    playWinSound,
    playEndFanfare,
    bindVolumeBar
  };
  if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;
  var audio_default = TileCityAudio;

  // js/i18n.js
  var KEY = "tile-city-lang";
  var dict = {
    en: {
      homeTitle: "Tile City",
      homeLead: "A tile-laying game of expanding roads and cities to score points.",
      play: "Play",
      rules: "Rules",
      home: "Home",
      langEn: "EN",
      langJa: "JA",
      langLabel: "Language",
      volumeLabel: "Volume",
      setupTitle: "Players",
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
      rulesTitle: "Tile City Rules",
      rulesLead: "Base-set style tile placement for 2\u20138 players. Original art \u2014 not the publisher\u2019s illustrations.",
      tocGoal: "Goal",
      tocSetup: "Setup",
      tocTurn: "Turn",
      tocPlace: "Placement",
      tocMeeple: "Meeples",
      tocScore: "Scoring",
      tocEnd: "Game end",
      tocTiles: "Tiles A\u2013X",
      goalTitle: "Goal",
      goalBody: "Score the most points by completing roads, cities, and monasteries during the game, then score leftover features and fields at the end.",
      setupSecTitle: "Setup",
      setupPlayers: "Players",
      setupPlayersBody: "2\u20138. Each color has 7 meeples. Pick names (max 10 letters) and unique colors on the setup screen.",
      setupStartTile: "Start tile",
      setupStartTileBody: "One marked D tile starts face-up in the center. Shuffle the other 71 tiles into the deck.",
      setupFirst: "First player",
      setupFirstBody: "The starting player is chosen at random. Turns then follow the player list order.",
      turnTitle: "On your turn",
      turnDraw: "1. Draw",
      turnDrawBody: "Take the top tile so everyone can see it.",
      turnPlace: "2. Place",
      turnPlaceBody: "Rotate in 90\xB0 steps and place it legally (see Placement). If no orientation fits anywhere, discard it and draw again \u2014 your turn is not spent.",
      turnMeeple: "3. Meeple (optional)",
      turnMeepleBody: "You may put one of your meeples on an open feature of the tile you just placed.",
      turnScore: "4. Score",
      turnScoreBody: "Any roads, cities, or monasteries completed by that placement score now and return those meeples.",
      placeTitle: "Placement",
      placeTouch: "Touch a side",
      placeTouchBody: "The new tile must share at least one full side with an existing tile. Corner-only contact is illegal.",
      placeEdges: "Edges match",
      placeEdgesBody: "Every touching side must match end-to-end: city\u2013city, road\u2013road, field\u2013field.",
      placeNoFlip: "No flip",
      placeNoFlipBody: "Rotate only; never mirror the tile.",
      placeOpen: "Open board",
      placeOpenBody: "The map can grow in any direction.",
      legalTitle: "Legal",
      legalBody: "Center is start tile D. North city matches E rotated 180\xB0. East road matches U rotated 90\xB0. South field matches V\u2019s north field.",
      illegalEdgesTitle: "Illegal \u2014 edges clash",
      illegalEdgesBody: "D\u2019s east edge is a road; unrotated E\u2019s west edge is a field. One mismatch blocks the place.",
      illegalCornerTitle: "Illegal \u2014 corner only",
      illegalCornerBody: "Tiles that only touch at a corner do not share a side, so the place is illegal.",
      meepleTitle: "Meeples",
      meepleWhere: "Where",
      meepleWhereBody: "Only on the tile you just placed: road, city, monastery, or field mark that is still free.",
      meepleOne: "One feature",
      meepleOneBody: "You cannot join a road, city, or field that already has any meeple on its connected area.",
      meepleStock: "Stock",
      meepleStockBody: "If you have no meeples left, skip placement. Completing a feature returns your meeples there (except at final scoring).",
      meepleSkip: "Skip",
      meepleSkipBody: "You may place the tile and skip the meeple.",
      scoreTitle: "Scoring during the game",
      scoreIntro: "When a feature finishes, the player(s) with the most meeples on it score. Ties: every tied player gets the full points. Those meeples return to stock.",
      scoreFeature: "Feature",
      scoreComplete: "Complete",
      scoreRoad: "Road",
      scoreRoadBody: "1 point per tile in the road",
      scoreCity: "City",
      scoreCityBody: "2 points per tile + 2 per pennant (banner)",
      scoreMonastery: "Monastery",
      scoreMonasteryBody: "9 points when all 8 neighbors are filled",
      scoreField: "Field",
      scoreFieldBody: "Not scored mid-game",
      endTitle: "Game end",
      endWhen: "When",
      endWhenBody: "After the last tile is placed (or Exit ends the game early), final scoring runs.",
      endRoads: "Incomplete roads",
      endRoadsBody: "1 point per tile.",
      endCities: "Incomplete cities",
      endCitiesBody: "1 point per tile + 1 per pennant.",
      endMonasteries: "Incomplete monasteries",
      endMonasteriesBody: "1 point per filled cell in the 3\xD73 (including the monastery tile).",
      endFields: "Fields",
      endFieldsBody: "Farmers stay on the board. Each field scores 3 points per completed city it touches. Majority rules as above.",
      endMeeples: "Meeples",
      endMeeplesBody: "Final scoring does not return meeples; +N labels show what each scored.",
      endTies: "Ties",
      endTiesBody: "Equal score \u2192 more meeples still in stock ranks higher.",
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
      tileIIntro: "Tile I has two cities that only meet at a corner point. They stay separate unless each joins other tiles along a full city edge.",
      tileINorth: "Joins the north city",
      tileINorthBody: "E rotated 180\xB0 matches I\u2019s north city edge. I\u2019s west city stays separate.",
      tileIWest: "Joins the west city",
      tileIWestBody: "E rotated 90\xB0 matches I\u2019s west city edge. I\u2019s north city stays separate.",
      tileIBoth: "Still two cities",
      tileIBothBody: "Even with both sides filled, I\u2019s cities remain split by field inside the tile. Corner-only contact between the two E tiles does not merge them.",
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
      rulesFoot: "Tile City \xB7 base-set rules adapted for this browser version.",
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
      noLegalPlace: "No legal place for this tile",
      endThisGame: "End this game?",
      gameOver: "Ranking",
      pickMeeple: "Pick a mark to place a meeple",
      noMeeplesLeft: "No meeples left",
      noOpenSpot: "No open spot for a meeple"
    },
    ja: {
      homeTitle: "Tile City",
      homeLead: "\u9053\u3068\u90FD\u5E02\u3092\u5E83\u3052\u3066\u5F97\u70B9\u3092\u7AF6\u3046\u30BF\u30A4\u30EB\u914D\u7F6E\u30B2\u30FC\u30E0\u3002",
      play: "\u904A\u3076",
      rules: "\u30EB\u30FC\u30EB",
      home: "\u30DB\u30FC\u30E0",
      langEn: "EN",
      langJa: "JA",
      langLabel: "\u8A00\u8A9E",
      volumeLabel: "\u97F3\u91CF",
      setupTitle: "\u30D7\u30EC\u30A4\u30E4\u30FC",
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
      rulesTitle: "Tile City \u30EB\u30FC\u30EB",
      rulesLead: "2\u301C8\u4EBA\u5411\u3051\u306E\u57FA\u672C\u30BB\u30C3\u30C8\u98A8\u30BF\u30A4\u30EB\u914D\u7F6E\u3002\u30AA\u30EA\u30B8\u30CA\u30EB\u7D75\u67C4\u3067\u3059\uFF08\u88FD\u54C1\u306E\u30A4\u30E9\u30B9\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
      tocGoal: "\u76EE\u7684",
      tocSetup: "\u6E96\u5099",
      tocTurn: "\u624B\u756A",
      tocPlace: "\u914D\u7F6E",
      tocMeeple: "\u30DF\u30FC\u30D7\u30EB",
      tocScore: "\u5F97\u70B9",
      tocEnd: "\u7D42\u4E86",
      tocTiles: "\u30BF\u30A4\u30EB A\u2013X",
      goalTitle: "\u76EE\u7684",
      goalBody: "\u30B2\u30FC\u30E0\u4E2D\u306B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5B8C\u6210\u3055\u305B\u3066\u5F97\u70B9\u3057\u3001\u7D42\u4E86\u6642\u306B\u6B8B\u308A\u306E\u8981\u7D20\u3068\u7551\u3092\u5F97\u70B9\u3057\u3066\u3001\u6700\u3082\u9AD8\u3044\u70B9\u3092\u76EE\u6307\u3057\u307E\u3059\u3002",
      setupSecTitle: "\u6E96\u5099",
      setupPlayers: "\u30D7\u30EC\u30A4\u30E4\u30FC",
      setupPlayersBody: "2\u301C8\u4EBA\u3002\u5404\u82727\u4F53\u306E\u30DF\u30FC\u30D7\u30EB\u3002\u8A2D\u5B9A\u753B\u9762\u3067\u540D\u524D\uFF08\u6700\u592710\u6587\u5B57\uFF09\u3068\u8272\u3092\u9078\u3073\u307E\u3059\u3002",
      setupStartTile: "\u958B\u59CB\u30BF\u30A4\u30EB",
      setupStartTileBody: "\u5370\u4ED8\u304D\u306E D \u30BF\u30A4\u30EB1\u679A\u3092\u4E2D\u592E\u306B\u8868\u5411\u304D\u3067\u7F6E\u304D\u307E\u3059\u3002\u6B8B\u308A71\u679A\u3092\u5C71\u672D\u306B\u3057\u307E\u3059\u3002",
      setupFirst: "\u5148\u624B",
      setupFirstBody: "\u5148\u624B\u306F\u30E9\u30F3\u30C0\u30E0\u306B\u6C7A\u307E\u308A\u307E\u3059\u3002\u4EE5\u964D\u306F\u30D7\u30EC\u30A4\u30E4\u30FC\u9806\u306B\u624B\u756A\u304C\u56DE\u308A\u307E\u3059\u3002",
      turnTitle: "\u624B\u756A",
      turnDraw: "1. \u30C9\u30ED\u30FC",
      turnDrawBody: "\u5C71\u672D\u306E\u4E00\u756A\u4E0A\u3092\u5F15\u304D\u3001\u5168\u54E1\u306B\u898B\u3048\u308B\u3088\u3046\u306B\u3057\u307E\u3059\u3002",
      turnPlace: "2. \u914D\u7F6E",
      turnPlaceBody: "90\xB0\u5358\u4F4D\u3067\u56DE\u8EE2\u3057\u3001\u5408\u6CD5\u306A\u5834\u6240\u306B\u7F6E\u304D\u307E\u3059\uFF08\u914D\u7F6E\u53C2\u7167\uFF09\u3002\u3069\u306E\u5411\u304D\u3067\u3082\u7F6E\u3051\u306A\u3044\u5834\u5408\u306F\u6368\u3066\u3066\u5F15\u304D\u76F4\u3057 \u2014 \u624B\u756A\u306F\u6D88\u8CBB\u3057\u307E\u305B\u3093\u3002",
      turnMeeple: "3. \u30DF\u30FC\u30D7\u30EB\uFF08\u4EFB\u610F\uFF09",
      turnMeepleBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u7A7A\u304D\u8981\u7D20\u306B\u3001\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u30921\u4F53\u7F6E\u3051\u307E\u3059\u3002",
      turnScore: "4. \u5F97\u70B9",
      turnScoreBody: "\u305D\u306E\u914D\u7F6E\u3067\u5B8C\u6210\u3057\u305F\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5F97\u70B9\u3057\u3001\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u3092\u623B\u3057\u307E\u3059\u3002",
      placeTitle: "\u914D\u7F6E",
      placeTouch: "\u8FBA\u3067\u63A5\u3059\u308B",
      placeTouchBody: "\u65B0\u3057\u3044\u30BF\u30A4\u30EB\u306F\u65E2\u5B58\u30BF\u30A4\u30EB\u3068\u5C11\u306A\u304F\u3068\u30821\u8FBA\u5168\u4F53\u3067\u63A5\u3059\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059\u3002\u89D2\u3060\u3051\u306F\u4E0D\u53EF\u3067\u3059\u3002",
      placeEdges: "\u8FBA\u306E\u4E00\u81F4",
      placeEdgesBody: "\u63A5\u3059\u308B\u8FBA\u306F\u7AEF\u304B\u3089\u7AEF\u307E\u3067\u4E00\u81F4\uFF1A\u90FD\u5E02\u2013\u90FD\u5E02\u3001\u9053\u2013\u9053\u3001\u7551\u2013\u7551\u3002",
      placeNoFlip: "\u88CF\u8FD4\u3057\u4E0D\u53EF",
      placeNoFlipBody: "\u56DE\u8EE2\u306E\u307F\u3002\u30BF\u30A4\u30EB\u306E\u93E1\u6620\u306F\u3057\u307E\u305B\u3093\u3002",
      placeOpen: "\u76E4\u9762\u306F\u81EA\u7531",
      placeOpenBody: "\u30DE\u30C3\u30D7\u306F\u3069\u306E\u65B9\u5411\u306B\u3082\u4F38\u3070\u305B\u307E\u3059\u3002",
      legalTitle: "\u5408\u6CD5",
      legalBody: "\u4E2D\u592E\u306F\u958B\u59CB\u30BF\u30A4\u30EB D\u3002\u5317\u306E\u90FD\u5E02\u306F 180\xB0 \u56DE\u8EE2\u306E E\u3001\u6771\u306E\u9053\u306F 90\xB0 \u56DE\u8EE2\u306E U\u3001\u5357\u306E\u7551\u306F V \u306E\u5317\u7551\u3068\u4E00\u81F4\u3002",
      illegalEdgesTitle: "\u9055\u6CD5 \u2014 \u8FBA\u304C\u4E0D\u4E00\u81F4",
      illegalEdgesBody: "D \u306E\u6771\u8FBA\u306F\u9053\u3001\u7121\u56DE\u8EE2\u306E E \u306E\u897F\u8FBA\u306F\u7551\u30021\u8FBA\u3067\u3082\u4E0D\u4E00\u81F4\u306A\u3089\u7F6E\u3051\u307E\u305B\u3093\u3002",
      illegalCornerTitle: "\u9055\u6CD5 \u2014 \u89D2\u3060\u3051",
      illegalCornerBody: "\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u308B\u30BF\u30A4\u30EB\u306F\u8FBA\u3092\u5171\u6709\u3057\u306A\u3044\u306E\u3067\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleTitle: "\u30DF\u30FC\u30D7\u30EB",
      meepleWhere: "\u7F6E\u304D\u5834\u6240",
      meepleWhereBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u4E0A\u306E\u307F\u3002\u307E\u3060\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u7551\u306E\u30DE\u30FC\u30AF\u3078\u3002",
      meepleOne: "\u4E00\u3064\u306E\u8981\u7D20",
      meepleOneBody: "\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u7551\u306E\u63A5\u7D9A\u9818\u57DF\u306B\u306F\u53C2\u52A0\u3067\u304D\u307E\u305B\u3093\u3002",
      meepleStock: "\u30B9\u30C8\u30C3\u30AF",
      meepleStockBody: "\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u3051\u308C\u3070\u914D\u7F6E\u3092\u30B9\u30AD\u30C3\u30D7\u3002\u8981\u7D20\u5B8C\u6210\u3067\u623B\u308B\uFF08\u6700\u7D42\u5F97\u70B9\u6642\u3092\u9664\u304F\uFF09\u3002",
      meepleSkip: "\u30B9\u30AD\u30C3\u30D7",
      meepleSkipBody: "\u30BF\u30A4\u30EB\u3060\u3051\u7F6E\u3044\u3066\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304B\u306A\u3044\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002",
      scoreTitle: "\u30B2\u30FC\u30E0\u4E2D\u306E\u5F97\u70B9",
      scoreIntro: "\u8981\u7D20\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u306E\u4E0A\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u6700\u591A\u306E\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u5F97\u70B9\u3002\u540C\u6570\u306A\u3089\u5168\u54E1\u304C\u6E80\u70B9\u3092\u5F97\u3066\u3001\u30DF\u30FC\u30D7\u30EB\u306F\u30B9\u30C8\u30C3\u30AF\u3078\u623B\u308A\u307E\u3059\u3002",
      scoreFeature: "\u8981\u7D20",
      scoreComplete: "\u5B8C\u6210\u6642",
      scoreRoad: "\u9053",
      scoreRoadBody: "\u9053\u306E\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreCity: "\u90FD\u5E02",
      scoreCityBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 + \u30DA\u30CA\u30F3\u30C8\uFF08\u65D7\uFF091\u3064\u306B\u3064\u304D2\u70B9",
      scoreMonastery: "\u4FEE\u9053\u9662",
      scoreMonasteryBody: "\u5468\u56F28\u30DE\u30B9\u304C\u57CB\u307E\u308B\u30689\u70B9",
      scoreField: "\u7551",
      scoreFieldBody: "\u30B2\u30FC\u30E0\u4E2D\u306F\u5F97\u70B9\u3057\u306A\u3044",
      endTitle: "\u30B2\u30FC\u30E0\u7D42\u4E86",
      endWhen: "\u3044\u3064",
      endWhenBody: "\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u5F8C\uFF08\u307E\u305F\u306F Exit \u3067\u9014\u4E2D\u7D42\u4E86\uFF09\u306B\u6700\u7D42\u5F97\u70B9\u3092\u884C\u3044\u307E\u3059\u3002",
      endRoads: "\u672A\u5B8C\u6210\u306E\u9053",
      endRoadsBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9\u3002",
      endCities: "\u672A\u5B8C\u6210\u306E\u90FD\u5E02",
      endCitiesBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 + \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endMonasteries: "\u672A\u5B8C\u6210\u306E\u4FEE\u9053\u9662",
      endMonasteriesBody: "3\xD73\uFF08\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u542B\u3080\uFF09\u306E\u57CB\u307E\u3063\u3066\u3044\u308B\u30DE\u30B91\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endFields: "\u7551",
      endFieldsBody: "\u8FB2\u6C11\u306F\u305D\u306E\u307E\u307E\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3002\u591A\u6570\u6C7A\u306F\u4E0A\u8A18\u3068\u540C\u3058\u3002",
      endMeeples: "\u30DF\u30FC\u30D7\u30EB",
      endMeeplesBody: "\u6700\u7D42\u5F97\u70B9\u3067\u306F\u30DF\u30FC\u30D7\u30EB\u306F\u623B\u308A\u307E\u305B\u3093\u3002+N \u8868\u793A\u3067\u5F97\u70B9\u3092\u793A\u3057\u307E\u3059\u3002",
      endTies: "\u540C\u70B9",
      endTiesBody: "\u540C\u70B9\u306A\u3089\u30B9\u30C8\u30C3\u30AF\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u591A\u3044\u65B9\u304C\u4E0A\u4F4D\u3002",
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
      tileIIntro: "\u30BF\u30A4\u30EB I \u306F\u89D2\u70B9\u3060\u3051\u3067\u63A5\u3059\u308B2\u3064\u306E\u90FD\u5E02\u304C\u3042\u308A\u307E\u3059\u3002\u305D\u308C\u305E\u308C\u304C\u8FBA\u5168\u4F53\u3067\u4ED6\u30BF\u30A4\u30EB\u3068\u7E4B\u304C\u3089\u306A\u3044\u9650\u308A\u5225\u7269\u306E\u307E\u307E\u3067\u3059\u3002",
      tileINorth: "\u5317\u306E\u90FD\u5E02\u3068\u63A5\u7D9A",
      tileINorthBody: "180\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u5317\u90FD\u5E02\u8FBA\u3068\u4E00\u81F4\u3002\u897F\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3002",
      tileIWest: "\u897F\u306E\u90FD\u5E02\u3068\u63A5\u7D9A",
      tileIWestBody: "90\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u897F\u90FD\u5E02\u8FBA\u3068\u4E00\u81F4\u3002\u5317\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3002",
      tileIBoth: "\u305D\u308C\u3067\u30822\u90FD\u5E02",
      tileIBothBody: "\u4E21\u5074\u304C\u57CB\u307E\u3063\u3066\u3082\u3001\u30BF\u30A4\u30EB\u5185\u306E\u7551\u3067\u90FD\u5E02\u306F\u5206\u304B\u308C\u307E\u3059\u30022\u679A\u306E E \u306E\u89D2\u63A5\u89E6\u3060\u3051\u3067\u306F\u5408\u4F75\u3057\u307E\u305B\u3093\u3002",
      tilesTitle: "\u30BF\u30A4\u30EB A\u2013X",
      tilesIntro: "\u30AF\u30E9\u30B7\u30C3\u30AF\u57FA\u672C\u30BB\u30C3\u30C8\u3068\u540C\u3058\u6587\u5B57\u30B3\u30FC\u30C9\u3068\u679A\u6570\u3002\u30AB\u30BF\u30ED\u30B0\u3067\u306F\u4E0A\u304C\u5317\u3002J \u3068 K \u306F\u93E1\u6620\u3067\u3001\u56DE\u8EE2\u3067\u306F\u4E92\u3044\u306B\u306A\u308A\u307E\u305B\u3093\u3002\u30DA\u30CA\u30F3\u30C8\u4ED8\u304D\u306F\u7121\u5370\u3068\u5206\u3051\u3066\u8A18\u8F09\u3002",
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
      rulesFoot: "Tile City \xB7 \u30D6\u30E9\u30A6\u30B6\u7248\u5411\u3051\u306B\u57FA\u672C\u30BB\u30C3\u30C8\u30EB\u30FC\u30EB\u3092\u518D\u69CB\u6210\u3002",
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
      noOpenSpot: "\u7F6E\u3051\u308B\u5834\u6240\u304C\u3042\u308A\u307E\u305B\u3093"
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
})();
