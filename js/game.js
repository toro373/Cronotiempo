const TERRAIN = {
  grass: { name: "Pradera", short: "PRA", cost: 1, food: 2, production: 1, passable: true },
  plains: { name: "Llanura", short: "LLA", cost: 1, food: 1, production: 2, passable: true },
  forest: { name: "Bosque", short: "BOS", cost: 2, food: 1, production: 2, passable: true },
  hills: { name: "Colinas", short: "COL", cost: 2, food: 1, production: 2, passable: true },
  abyss: { name: "Abismo", short: "ABS", cost: 2, food: 4, production: 3, passable: true },
  water: { name: "Agua", short: "AGU", cost: Infinity, food: 1, production: 0, passable: false },
  mountain: { name: "Montaña", short: "MON", cost: Infinity, food: 0, production: 1, passable: false },
  desert: { name: "Desierto", short: "DES", cost: 1, food: 0, production: 1, passable: true }
};
const TILE_IMPROVEMENTS = {
  field: { name: "Campo", icon: "🌾", terrains: ["grass", "plains", "abyss"], resource: "grain", amount: 1 },
  quarry: { name: "Cantera", icon: "⛏", terrains: ["hills"], resource: "stone", amount: 1 }
};
const UNIT_COMBATS_PER_LEVEL = 3;
const UNIT_LEVEL_UPGRADES = [
  { id: "attack", name: "Ataque experto", description: "+2 de daño en combate." },
  { id: "vitality", name: "Vitalidad", description: "+8 de salud máxima y recupera 8 de salud." },
  { id: "defense", name: "Defensa tenaz", description: "Recibe un 10 % menos de daño." }
];

const WIDTH = 60;
const HEIGHT = 40;
const BASE_WIDTH = 40;
const BASE_HEIGHT = 28;
const MAP_OPTIONS = [
  { id: "pandora", name: "Pandora", subtitle: "Continentes y tierras del Abismo", description: "El mundo original, con grandes continentes, islas septentrionales, el Abismo central y una guarida de dragón en la isla al suroeste, bajo la región demoníaca." },
  { id: "europe", name: "Europa y África", subtitle: "Europa, Mediterráneo y África", description: "Europa al norte y África al sur, con el Abismo en el extremo inferior africano y la guarida del Dragón en el norte." },
  { id: "archipelago", name: "Mar de las Mil Islas", subtitle: "Un mundo para explorar por mar", description: "Cadenas de islas dispersas, con el Abismo y una guarida de dragón en el norte." },
  { id: "ash-ring", name: "Anillo de Ceniza", subtitle: "Tierras alrededor de un mar interior", description: "Cuatro grandes regiones rodean un mar interior oscuro; el Abismo ocupa su corazón y los dragones guardan el norte." },
  { id: "tierra-un-tercio", name: "La Tierra Un Tercio", subtitle: "Un vasto continente de cordilleras y lagos", description: "Explora un continente original, atravesado por grandes hileras de montañas y salpicado de lagos. El Abismo ocupa el sudeste y una guarida de dragón aguarda en el norte." },
  { id: "random", name: "Mundo aleatorio", subtitle: "Un mundo distinto en cada partida", description: "Una distribución imprevisible de masas de tierra y mares, con el Abismo y una guarida de dragón en el norte." }
];
const AI_DIFFICULTIES = {
  easy: {
    name: "Fácil",
    description: "La IA se expande más despacio y tarda más en declarar guerras.",
    productionMultiplier: 0.7,
    relationStep: 0.5,
    warThreshold: -65
  },
  normal: {
    name: "Normal",
    description: "Ritmo equilibrado de expansión y diplomacia.",
    productionMultiplier: 1,
    relationStep: 1,
    warThreshold: -50
  },
  hard: {
    name: "Difícil",
    description: "La IA se expande más deprisa y los rivales agresivos pueden declarar la guerra antes.",
    productionMultiplier: 1.5,
    relationStep: 1.5,
    warThreshold: -40
  }
};
const STARTS = {
  humanity: { x: 20, y: 16 },
  "demonic-unified-front": { x: 6, y: 12 },
  "angelical-councils": { x: 33, y: 11 },
  "pagan-sun": { x: 20, y: 2 }
};
const LANDMASS = [
  [3, 9], [6, 7], [12, 6], [17, 7], [20, 8], [23, 7], [28, 6], [34, 7], [37, 10],
  [38, 14], [36, 18], [37, 21], [34, 23], [30, 22], [25, 23], [20, 24], [16, 23],
  [13, 23], [10, 22], [7, 21], [5, 18], [3, 15], [2, 12], [2, 10]
];

const combatVisualEffects = new Map();

const game = {
  civilization: null,
  civilizations: [],
  unitTypes: new Map(),
  technologies: [],
  buildings: [],
  civics: [],
  tiles: [],
  mapName: "",
  mapId: "pandora",
  explored: [],
  visibleTiles: new Set(),
  units: [],
  cities: [],
  barbarianCamps: [],
  opponents: [],
  playerCount: 4,
  barbariansEnabled: true,
  difficulty: "normal",
  tutorialDismissed: false,
  tutorialProductionAssigned: false,
  selectedUnitId: null,
  selectedTile: null,
  turn: 1,
  activeTurnFactionId: null,
  turnProcessing: false,
  food: 0,
  foodDeficitTurns: 0,
  production: 0,
  gold: 0,
  scienceReserve: 0,
  victory: null,
  milestones: [],
  materials: { grain: 0, stone: 0 },
  researched: [],
  adoptedCivics: [],
  blockedCivics: [],
  currentTechnology: null,
  currentCivic: null,
  technologyProgress: {},
  civicProgress: {},
  nextUnitId: 1,
  cityNameIndex: 0,
  saveId: null,
  messageTimer: null
};

const STORAGE_KEYS = {
  games: "chronicles.savedGames",
  civilizations: "chronicles.customCivilizations",
  map: "chronicles.customMap"
};
let editorTiles = [];
let editorTerrain = "grass";
let mapZoom = 1;

const mapElement = document.querySelector("#game-map");
const mapViewport = document.querySelector("#map-viewport");
const selectionElement = document.querySelector("#selection-details");
const actionsElement = document.querySelector("#unit-actions");

async function loadGameData() {
  const [civilizationsXml, unitsXml, progressionXml] = await Promise.all([
    fetchXml("data/civilizations.xml"),
    fetchXml("data/units.xml"),
    fetchXml("data/progression.xml")
  ]);
  const xml = civilizationsXml;

  const civilizationNodes = [...xml.querySelectorAll("civilizations civilization")];
  if (!civilizationNodes.length) {
    throw new Error("El XML no contiene ninguna civilización.");
  }

  game.civilizations = civilizationNodes.map((node) => {
    const capital = node.getAttribute("capital")?.trim() ?? "";
    const cities = [...node.querySelectorAll("cities city")].map((city) => city.textContent.trim()).filter(Boolean);
    if (capital && !cities.includes(capital)) cities.unshift(capital);
    const civilization = {
      id: node.getAttribute("id"),
      name: node.getAttribute("name"),
      adjective: node.getAttribute("adjective"),
      color: node.getAttribute("color"),
      aggression: Math.max(0, Math.min(100, Number(node.getAttribute("aggression")) || 0)),
      playable: node.getAttribute("playable") !== "false",
      independent: node.getAttribute("independent") === "true",
      unitFaction: node.getAttribute("unitFaction") ?? "",
      canFoundSettlers: node.getAttribute("canFoundSettlers") !== "false",
      description: node.querySelector("description")?.textContent.trim() ?? "",
      abilities: {
        unitProductionMultiplier: Number(node.querySelector("abilities")?.getAttribute("unitProductionMultiplier")) || 1,
        unitPurchaseMultiplier: Number(node.querySelector("abilities")?.getAttribute("unitPurchaseMultiplier")) || 1,
        unitStrengthMultiplier: Number(node.querySelector("abilities")?.getAttribute("unitStrengthMultiplier")) || 1,
        progressionCostMultiplier: Number(node.querySelector("abilities")?.getAttribute("progressionCostMultiplier")) || 1,
        descriptions: [...node.querySelectorAll("abilities ability")].map((ability) => ability.textContent.trim()).filter(Boolean)
      },
      cities,
      startingUnits: [...node.querySelectorAll("startingUnits unit")].map((unit) => unit.getAttribute("type")).filter(Boolean),
      availableUnits: [...node.querySelectorAll("availableUnits unit")].map((unit) => unit.getAttribute("type")).filter(Boolean)
    };
    if (!civilization.id || !civilization.name || !civilization.cities.length) {
      throw new Error("Hay una civilización sin identificador, nombre o capital en el XML.");
    }
    return civilization;
  });
  game.civilization = game.civilizations[0];

  for (const node of unitsXml.querySelectorAll("unit")) {
    const unit = {
      id: node.getAttribute("id"),
      name: node.getAttribute("name"),
      icon: node.getAttribute("icon"),
      role: node.getAttribute("role"),
      faction: node.getAttribute("faction"),
      movement: Number(node.getAttribute("movement")),
      strength: Number(node.getAttribute("strength")),
      maxHealth: Math.max(0, Number(node.getAttribute("maxHealth")) || 0),
      range: Math.max(1, Number(node.getAttribute("range")) || 1),
      canSail: node.getAttribute("canSail") === "true",
      cost: Number(node.getAttribute("cost")) || 10,
      purchaseCost: Number(node.getAttribute("purchaseCost")) || (Number(node.getAttribute("cost")) || 10) * 3,
      grain: Number(node.getAttribute("grain")) || 0,
      stone: Number(node.getAttribute("stone")) || 0,
      canFound: node.getAttribute("canFound") === "true",
      canBuild: node.getAttribute("canBuild") === "true",
      canTrade: node.getAttribute("canTrade") === "true",
      description: node.querySelector("description")?.textContent.trim() ?? ""
    };
    if (!unit.id || !unit.name || !Number.isFinite(unit.movement) || unit.movement < 1 ||
        !Number.isFinite(unit.strength) || unit.strength < 0 ||
        !["generic", "barbarians", "elves", "dwarves", "dragons", "beasts",
          ...game.civilizations.map((item) => item.id)].includes(unit.faction)) {
      throw new Error("Hay una unidad con datos incompletos o inválidos en el XML.");
    }
    game.unitTypes.set(unit.id, unit);
  }

  game.technologies = [...progressionXml.querySelectorAll("technologies > technology")].map((node) => ({
    id: node.getAttribute("id"),
    name: node.getAttribute("name"),
    cost: Number(node.getAttribute("cost")),
    description: node.querySelector("description")?.textContent.trim() ?? "",
    civilization: node.getAttribute("civilization") ?? "",
    prerequisites: [...node.querySelectorAll("requires technology")].map((item) => item.getAttribute("id")),
    unlocks: [...node.querySelectorAll("unlocks > *")].map((item) => ({
      type: item.tagName,
      id: item.getAttribute("id")
    }))
  }));
  game.buildings = [...progressionXml.querySelectorAll("buildings > building")].map((node) => ({
    id: node.getAttribute("id"),
    name: node.getAttribute("name"),
    cost: Number(node.getAttribute("cost")),
    food: Number(node.getAttribute("food")) || 0,
    science: Number(node.getAttribute("science")) || 0,
    culture: Number(node.getAttribute("culture")) || 0,
    production: Number(node.getAttribute("production")) || 0,
    grain: Number(node.getAttribute("grain")) || 0,
    stone: Number(node.getAttribute("stone")) || 0,
    placement: node.getAttribute("placement") ?? "",
    unitId: node.getAttribute("unitId") ?? "",
    unitInterval: Math.max(0, Number(node.getAttribute("unitInterval")) || 0),
    cityHealth: Math.max(0, Number(node.getAttribute("cityHealth")) || 0),
    cityDefense: Math.max(0, Number(node.getAttribute("cityDefense")) || 0),
    damageReduction: Math.max(0, Math.min(1, Number(node.getAttribute("damageReduction")) || 0)),
    description: node.querySelector("description")?.textContent.trim() ?? "",
    technology: node.querySelector("requiresTechnology")?.getAttribute("id") ?? ""
  }));
  game.civics = [...progressionXml.querySelectorAll("civics > civic")].map((node) => ({
    id: node.getAttribute("id"),
    name: node.getAttribute("name"),
    cost: Number(node.getAttribute("cost")),
    science: Number(node.getAttribute("science")) || 0,
    culture: Number(node.getAttribute("culture")) || 0,
    production: Number(node.getAttribute("production")) || 0,
    gold: Number(node.getAttribute("gold")) || 0,
    exclusiveGroup: node.getAttribute("exclusiveGroup") ?? "",
    description: node.querySelector("description")?.textContent.trim() ?? "",
    prerequisites: [...node.querySelectorAll("requires civic")].map((item) => item.getAttribute("id"))
  }));

  validateProgressionData();
  for (const civilization of game.civilizations) {
    if (!civilization.startingUnits.length) {
      throw new Error(`La civilización "${civilization.name}" no define unidades iniciales en el XML.`);
    }
    for (const unitId of [...civilization.startingUnits, ...civilization.availableUnits]) {
      if (!game.unitTypes.has(unitId)) {
        throw new Error(`La unidad "${unitId}" de "${civilization.name}" no existe en el XML.`);
      }
    }
  }

  document.querySelector("#civilization-name").textContent = game.civilization.name;
  document.querySelector("#footer-civilization").textContent = game.civilization.name;
  document.querySelector("#world-map-name").textContent = game.mapName;
  document.querySelector("#end-turn").disabled = false;
  renderMenuHome();
}

async function fetchXml(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar ${path} (${response.status}).`);
  const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error(`El archivo ${path} tiene un formato XML no válido.`);
  return xml;
}

function getUnitFaction(unit) {
  return unit?.ownerId ?? game.unitTypes.get(unit?.typeId)?.faction ?? null;
}

function isIndependentFaction(factionId) {
  return factionId === "elves" || factionId === "dwarves" ||
    factionId === "barbarians" || factionId === "dragons" || factionId === "beasts";
}

function getCivilizationById(civilizationId) {
  if (game.civilization?.id === civilizationId) return game.civilization;
  return game.civilizations.find((civilization) => civilization.id === civilizationId) ??
    game.opponents.find((opponent) => opponent.civilization.id === civilizationId)?.civilization ?? null;
}

function getUnitStrength(type, factionId) {
  if (!type) return 0;
  const multiplier = getCivilizationById(factionId)?.abilities?.unitStrengthMultiplier ?? 1;
  return Math.max(0, Math.round(type.strength * multiplier));
}

function getProgressionCost(item) {
  const multiplier = game.civilization?.abilities?.progressionCostMultiplier ?? 1;
  return Math.max(1, Math.ceil(item.cost * multiplier));
}

function validateProgressionData() {
  for (const technology of game.technologies) {
    if (!technology.id || !technology.name || technology.cost < 1 ||
        technology.prerequisites.some((id) => !game.technologies.some((item) => item.id === id))) {
      throw new Error(`La tecnología "${technology.name}" tiene datos o requisitos no válidos.`);
    }
    for (const unlock of technology.unlocks) {
      if (unlock.type === "unit" && !game.unitTypes.has(unlock.id)) {
        throw new Error(`La tecnología "${technology.name}" desbloquea una unidad inexistente: ${unlock.id}.`);
      }
      if (unlock.type === "building" && !game.buildings.some((building) => building.id === unlock.id)) {
        throw new Error(`La tecnología "${technology.name}" desbloquea una mejora inexistente: ${unlock.id}.`);
      }
    }
    for (const building of game.buildings) {
      if (building.unitId && !game.unitTypes.has(building.unitId)) {
        throw new Error(`La construcción "${building.name}" produce una unidad inexistente: ${building.unitId}.`);
      }
    }
  }
  for (const civic of game.civics) {
    if (!civic.id || !civic.name || civic.cost < 1 ||
        civic.prerequisites.some((id) => !game.civics.some((item) => item.id === id))) {
      throw new Error(`La política "${civic.name}" tiene datos o requisitos no válidos.`);
    }
  }
}
