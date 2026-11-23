function initializePaganSunStartingCity(position) {
  const civilization = game.civilizations.find((item) => item.id === "pagan-sun");
  if (!civilization || game.cities.some((city) =>
    (city.originalOwnerId ?? city.ownerId) === civilization.id
  )) return;
  const city = {
    name: civilization.cities[0] ?? "Sol Pagano",
    ownerId: civilization.id,
    originalOwnerId: civilization.id,
    isCapital: true,
    x: position.x,
    y: position.y,
    population: 1,
    growth: 0,
    influenceTurns: 0,
    health: 30,
    maxHealth: 30,
    buildings: [],
    project: null,
    projectQueue: []
  };
  game.cities.push(city);
  initializeCityTerritory(city);
}

function startNewGame(civilization, mapSelection = "continent", options = {}) {
  const playerCount = options.playerCount ?? game.playerCount;
  const barbariansEnabled = options.barbariansEnabled ?? game.barbariansEnabled;
  const difficulty = options.difficulty ?? game.difficulty;
  const opponentIds = options.opponentIds;
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
    showMessage("El número de jugadores debe estar entre 2 y 4.");
    return;
  }
  if (typeof barbariansEnabled !== "boolean") {
    showMessage("La opción de campamentos bárbaros no es válida.");
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(AI_DIFFICULTIES, difficulty)) {
    showMessage("La dificultad seleccionada no es válida.");
    return;
  }
  if (opponentIds !== undefined) {
    const availableIds = new Set(getOpponentCivilizations(civilization.id).map((item) => item.id));
    if (!Array.isArray(opponentIds) || opponentIds.length !== playerCount - 1 ||
        new Set(opponentIds).size !== opponentIds.length ||
        opponentIds.some((id) => !availableIds.has(id))) {
      showMessage("Selecciona exactamente el número indicado de civilizaciones rivales.");
      return;
    }
  }
  if (Array.isArray(mapSelection) && !isValidMap(mapSelection)) {
    showMessage("El mapa editado no tiene un formato válido.");
    return;
  }
  const mapId = Array.isArray(mapSelection) ? "custom" : mapSelection === "continent" ? "pandora" : mapSelection;
  if (!Array.isArray(mapSelection) && !MAP_OPTIONS.some((option) => option.id === mapId)) {
    showMessage("No se encontró el mapa seleccionado.");
    return;
  }
  game.civilization = civilization;
  game.activeTurnFactionId = civilization.id;
  game.turnProcessing = false;
  game.mapId = mapId;
  game.playerCount = playerCount;
  game.barbariansEnabled = barbariansEnabled;
  game.difficulty = difficulty;
  game.tutorialDismissed = false;
  game.tutorialProductionAssigned = false;
  game.saveId = `${civilization.id}-${Date.now()}`;
  game.units = [];
  game.cities = [];
  game.barbarianCamps = [];
  game.opponents = [];
  game.turn = 1;
  game.food = 0;
  game.foodDeficitTurns = 0;
  game.production = 0;
  game.gold = 0;
  game.scienceReserve = 0;
  game.victory = null;
  game.milestones = [];
  game.materials = { grain: 0, stone: 0 };
  game.researched = [];
  game.adoptedCivics = [];
  game.blockedCivics = [];
  game.currentTechnology = null;
  game.currentCivic = null;
  game.technologyProgress = {};
  game.civicProgress = {};
  game.nextUnitId = 1;
  game.cityNameIndex = 0;
  game.selectedUnitId = null;
  game.selectedTile = null;
  game.explored = createExplorationMap();
  const start = getStartPosition(civilization);
  if (Array.isArray(mapSelection)) {
    game.tiles = resizeMapToWorld(mapSelection);
    applySharedMapFeatures(mapId, game.tiles);
    game.mapName = "Mi mapa editado";
  } else {
    createWorld(false, mapId);
    game.mapName = MAP_OPTIONS.find((option) => option.id === mapId)?.name ?? "Pandora";
  }
  const startingPositions = spawnStartingUnits(civilization, start);
  if (civilization.id === "pagan-sun") {
    initializePaganSunStartingCity(startingPositions[0]);
    recordMilestone(`Capital inicial: ${game.cities[0].name}.`);
    game.cityNameIndex = 1;
  }
  initializeOpponents(civilization, playerCount, opponentIds);
  initializeBarbarianCamps();
  updateVisibility();
  document.querySelector("#event-log").replaceChildren();
  document.querySelector("#turn-number").textContent = "1";
  document.querySelector("#civilization-name").textContent = civilization.name;
  document.querySelector("#footer-civilization").textContent = civilization.name;
  document.querySelector("#world-map-name").textContent = game.mapName;
  addEvent(`${civilization.name} inicia su expansión.`);
  document.querySelector("#main-menu").hidden = true;
  document.querySelector("#game-screen").hidden = false;
  render();
  centerMapOnPositions(startingPositions);
  saveGame();
}

function restoreGame(save) {
  if (!Array.isArray(save.tiles) || !save.tiles.length || !save.civilization ||
      save.tiles.some((row) => !Array.isArray(row) || row.length !== save.tiles[0].length ||
        row.some((tile) => !tile || !TERRAIN[tile.type]))) {
    showMessage("La partida guardada está incompleta o dañada.");
    return;
  }
  const catalogCivilization = game.civilizations.find((item) => item.id === save.civilization.id);
  game.civilization = {
    ...catalogCivilization,
    ...save.civilization,
    abilities: catalogCivilization?.abilities ?? save.civilization.abilities ?? {
      unitProductionMultiplier: 1,
      unitPurchaseMultiplier: 1,
      unitStrengthMultiplier: 1,
      progressionCostMultiplier: 1,
      descriptions: []
    }
  };
  game.activeTurnFactionId = game.civilization.id;
  game.turnProcessing = false;
  game.saveId = save.saveId ?? `${save.civilization.id}-restored`;
  game.playerCount = Number.isInteger(save.playerCount) && save.playerCount >= 2 && save.playerCount <= 4
    ? save.playerCount
    : Math.min(4, Math.max(2, (Array.isArray(save.opponents) ? save.opponents.length : 3) + 1));
  game.barbariansEnabled = save.barbariansEnabled !== false;
  game.difficulty = Object.prototype.hasOwnProperty.call(AI_DIFFICULTIES, save.difficulty)
    ? save.difficulty
    : "normal";
  game.mapName = save.mapName ?? "Crónica guardada";
  game.mapId = save.mapId === "custom" || MAP_OPTIONS.some((option) => option.id === save.mapId)
    ? save.mapId
    : "pandora";
  const sourceHeight = save.tiles.length;
  const sourceWidth = save.tiles[0].length;
  const sourceMaxX = Math.max(1, sourceWidth - 1);
  const sourceMaxY = Math.max(1, sourceHeight - 1);
  game.tiles = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const sourceY = Math.round((y / (HEIGHT - 1)) * sourceMaxY);
      const sourceX = Math.round((x / (WIDTH - 1)) * sourceMaxX);
      return { ...save.tiles[sourceY][sourceX], x, y };
    })
  );
  game.explored = createExplorationMap();

  const remapPositions = (items) => (items ?? []).map((item) => ({
    ...item,
    x: Math.round((item.x / sourceMaxX) * (WIDTH - 1)),
    y: Math.round((item.y / sourceMaxY) * (HEIGHT - 1))
  }));
  game.units = remapPositions(save.units);
  game.units = game.units.map((unit) => {
    const type = game.unitTypes.get(unit.typeId);
    const upgrades = {
      attack: Math.max(0, Math.floor(Number(unit.upgrades?.attack) || 0)),
      vitality: Math.max(0, Math.floor(Number(unit.upgrades?.vitality) || 0)),
      defense: Math.max(0, Math.floor(Number(unit.upgrades?.defense) || 0))
    };
    const maxHealth = (type?.maxHealth || Math.max(15, 20 + getUnitStrength(type, getUnitFaction(unit)) * 2)) +
      upgrades.vitality * 8;
    return {
      ...unit,
      movesLeft: Math.max(0, Math.min(type?.movement ?? 0, Math.floor(Number(unit.movesLeft) || 0))),
      stance: ["active", "resting", "fortified"].includes(unit.stance) ? unit.stance : "active",
      combatCount: Math.max(0, Math.floor(Number(unit.combatCount) || 0)),
      level: Math.max(1, Math.floor(Number(unit.level) || 1)),
      pendingUpgrades: Math.max(0, Math.floor(Number(unit.pendingUpgrades) || 0)),
      upgrades,
      ...(type?.canBuild ? {
        buildCharges: Number.isInteger(Number(unit.buildCharges))
          ? Math.max(0, Math.min(3, Number(unit.buildCharges)))
          : 3
      } : {}),
      maxHealth: Number(unit.maxHealth) > 0 ? Math.min(Number(unit.maxHealth), maxHealth) : maxHealth,
      health: Number(unit.health) > 0 ? Math.min(Number(unit.health), maxHealth) : maxHealth
    };
  }).filter((unit) => !game.unitTypes.get(unit.typeId)?.canBuild || unit.buildCharges > 0);
  game.barbarianCamps = remapPositions(save.barbarianCamps);
  game.nextUnitId = Math.max(0, ...game.units.map((unit) => unit.id)) + 1;
  const capitalOwners = new Set();
  game.cities = remapPositions(save.cities).map((city) => {
    const ownerId = city.ownerId ?? save.civilization.id;
    const originalOwnerId = city.originalOwnerId ?? ownerId;
    const isCapital = city.isCapital === true || !capitalOwners.has(originalOwnerId);
    const buildings = Array.isArray(city.buildings) ? city.buildings : [];
    const minimumMaxHealth = 30 + buildings.reduce((total, id) =>
      total + (game.buildings.find((building) => building.id === id)?.cityHealth ?? 0), 0);
    const maxHealth = Math.max(minimumMaxHealth, Number(city.maxHealth) || 0);
    capitalOwners.add(originalOwnerId);
    return {
      ...city,
      ownerId,
      originalOwnerId,
      isCapital,
      maxHealth,
      health: Number(city.health) > 0 ? Math.min(Number(city.health), maxHealth) : maxHealth,
      influenceTurns: Math.max(0, Number(city.influenceTurns) || 0) % 5,
      buildings,
      project: city.project ?? null,
      projectQueue: Array.isArray(city.projectQueue)
        ? city.projectQueue
          .filter((project) => project && ["unit", "building"].includes(project.type) &&
            typeof project.id === "string")
          .map((project) => ({
            type: project.type,
            id: project.id,
            progress: Math.max(0, Number(project.progress) || 0),
            ...(project.reservedMaterials ? {
              reservedMaterials: {
                grain: Math.max(0, Number(project.reservedMaterials.grain) || 0),
                stone: Math.max(0, Number(project.reservedMaterials.stone) || 0)
              }
            } : {})
          }))
        : []
    };
  });
  for (const city of game.cities) {
    initializeCityTerritory(city, city.influenceRadius ?? 1);
    delete city.influenceRadius;
  }
  game.tutorialDismissed = save.tutorialDismissed === true;
  game.tutorialProductionAssigned = save.tutorialProductionAssigned === true ||
    game.cities.some((city) => city.ownerId === game.civilization.id &&
      (city.project || city.buildings.length > 0));
  game.opponents = restoreOpponents(save.opponents, save.civilization);
  if (!Array.isArray(save.barbarianCamps)) initializeBarbarianCamps();
  game.researched = Array.isArray(save.researched) ? save.researched : [];
  game.adoptedCivics = Array.isArray(save.adoptedCivics) ? save.adoptedCivics : [];
  game.blockedCivics = Array.isArray(save.blockedCivics) ? save.blockedCivics : [];
  game.currentTechnology = save.currentTechnology ?? null;
  game.currentCivic = save.currentCivic ?? null;
  game.technologyProgress = save.technologyProgress ?? {};
  game.civicProgress = save.civicProgress ?? {};
  game.explored = Array.isArray(save.explored) && save.explored.length === sourceHeight &&
    save.explored.every((row) => Array.isArray(row) && row.length === sourceWidth)
    ? Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => {
      const sourceY = Math.round((y / (HEIGHT - 1)) * sourceMaxY);
      const sourceX = Math.round((x / (WIDTH - 1)) * sourceMaxX);
      return save.explored[sourceY][sourceX] === true;
    }))
    : createExplorationMap();
  game.turn = Number(save.turn) || 1;
  game.food = Math.max(0, Number(save.food) || 0);
  game.foodDeficitTurns = Math.max(0, Math.floor(Number(save.foodDeficitTurns) || 0));
  game.production = Number(save.production) || 0;
  game.gold = Math.max(0, Number(save.gold) || 0);
  game.scienceReserve = Math.max(0, Number(save.scienceReserve) || 0);
  game.victory = save.victory && typeof save.victory === "object" &&
    save.victory.type !== "territory" ? save.victory : null;
  game.milestones = Array.isArray(save.milestones)
    ? save.milestones.filter((item) => item && Number.isInteger(item.turn) &&
      typeof item.title === "string").slice(-40)
    : [];
  game.materials = {
    grain: Math.max(0, Number(save.materials?.grain) || 0),
    stone: Math.max(0, Number(save.materials?.stone) || 0)
  };
  game.nextUnitId = Math.max(0, ...game.units.map((unit) => unit.id)) + 1;
  game.cityNameIndex = getPlayerCities().length;
  game.selectedUnitId = null;
  game.selectedTile = null;
  document.querySelector("#event-log").replaceChildren();
  document.querySelector("#turn-number").textContent = String(game.turn);
  document.querySelector("#civilization-name").textContent = game.civilization.name;
  document.querySelector("#footer-civilization").textContent = game.civilization.name;
  document.querySelector("#world-map-name").textContent = game.mapName;
  addEvent("La crónica guardada continúa.");
  document.querySelector("#main-menu").hidden = true;
  document.querySelector("#game-screen").hidden = false;
  render();
  centerMapOnPositions([
    ...game.units.filter((unit) => getUnitFaction(unit) === game.civilization.id),
    ...getPlayerCities()
  ]);
}

function saveGame() {
  if (!game.civilization || !game.tiles.length) return false;
  const saves = readStorage(STORAGE_KEYS.games, []);
  const save = {
    saveId: game.saveId,
    civilization: game.civilization,
    mapName: game.mapName,
    mapId: game.mapId,
    tiles: game.tiles,
    explored: game.explored,
    units: game.units,
    cities: game.cities,
    barbarianCamps: game.barbarianCamps,
    playerCount: game.playerCount,
    barbariansEnabled: game.barbariansEnabled,
    difficulty: game.difficulty,
    tutorialDismissed: game.tutorialDismissed,
    tutorialProductionAssigned: game.tutorialProductionAssigned,
    opponents: game.opponents.map(({ civilization, ...opponent }) => ({
      ...opponent,
      civilizationId: civilization.id
    })),
    turn: game.turn,
    food: game.food,
    foodDeficitTurns: game.foodDeficitTurns,
    production: game.production,
    gold: game.gold,
    scienceReserve: game.scienceReserve,
    victory: game.victory,
    milestones: game.milestones,
    materials: game.materials,
    researched: game.researched,
    adoptedCivics: game.adoptedCivics,
    blockedCivics: game.blockedCivics,
    currentTechnology: game.currentTechnology,
    currentCivic: game.currentCivic,
    technologyProgress: game.technologyProgress,
    civicProgress: game.civicProgress,
    savedAt: new Date().toISOString()
  };
  const existingIndex = saves.findIndex((entry) => entry.saveId === save.saveId);
  if (existingIndex >= 0) saves.splice(existingIndex, 1);
  saves.unshift(save);
  const saved = saves.slice(0, 10);
  if (!writeStorage(STORAGE_KEYS.games, saved)) return false;
  for (const expiredSave of saves.slice(10)) deleteSaveFile(expiredSave.saveId);
  persistSaveFile(save);
  return true;
}
