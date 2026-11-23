function createWorld(createUnits = true, mapId = "pandora") {
  game.mapId = mapId;
  game.tiles = generateMapTiles(mapId);
  if (mapId === "pandora" || mapId === "random") createNorthernIslands(game.tiles, mapId);
  applySharedMapFeatures(mapId, game.tiles);
  if (createUnits) {
    const start = getStartPosition(game.civilization);
    spawnStartingUnits(game.civilization, start);
  }
}

function generateMapTiles(mapId = "pandora", seed = Math.floor(Math.random() * 2147483646) + 1) {
  if (mapId === "random") return generateRandomWorld(seed);
  if (mapId === "europe") return generateEuropeMap();
  if (mapId === "archipelago") return generateArchipelagoMap(seed);
  if (mapId === "ash-ring") return generateAshRingMap();
  if (mapId === "tierra-un-tercio") return generateTierraUnTercioMap();
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => ({ x, y, type: getWorldTerrain(x, y) }))
  );
}

function generateRandomWorld(seed) {
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const landmasses = Array.from({ length: 7 }, () => ({
    x: 0.05 + random() * 0.9,
    y: 0.18 + random() * 0.64,
    radiusX: 0.07 + random() * 0.09,
    radiusY: 0.07 + random() * 0.1
  }));
  let land = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => landmasses.some((mass) => {
      const nx = x / (WIDTH - 1);
      const ny = y / (HEIGHT - 1);
      const distance = ((nx - mass.x) / mass.radiusX) ** 2 + ((ny - mass.y) / mass.radiusY) ** 2;
      return distance < 0.86 + random() * 0.3;
    }))
  );

  for (const civilization of game.civilizations) {
    if (civilization.independent) continue;
    const start = getMapStartPosition(civilization, "random");
    for (let y = Math.max(0, start.y - 2); y <= Math.min(HEIGHT - 1, start.y + 2); y += 1) {
      for (let x = Math.max(0, start.x - 2); x <= Math.min(WIDTH - 1, start.x + 2); x += 1) {
        if (Math.abs(x - start.x) + Math.abs(y - start.y) <= 3) land[y][x] = true;
      }
    }
  }

  const landTerrains = ["grass", "grass", "plains", "forest", "hills", "desert", "mountain"];
  return land.map((row, y) => row.map((isLand, x) => {
    if (!isLand) return { x, y, type: "water" };
    const type = landTerrains[Math.floor(random() * landTerrains.length)];
    return { x, y, type };
  }));
}

function generateEuropeMap() {
  // Natural Earth 1:110m land sampled at 60 × 40 over 25°W–45°E, 15°N–75°N.
  const coastline = [
    "####........................................................",
    "##..........................................................",
    "###.........................................................",
    "#.....................................##########............",
    "...................................####################....#",
    ".................................#################.######...",
    "..########.....................#########...########.....####",
    "....##.......................##########..###################",
    "..........................###########...####################",
    "..........................###########...####################",
    "..........................####.######.....##################",
    "................##.............#####......##################",
    ".................##.........###.###....#####################",
    "..............##..##.........#......#.######################",
    ".............###.#####....##################################",
    ".............#...#####...###################################",
    ".......................#####################################",
    "..................#.########################################",
    "...................#########################################",
    "....................###########################...#...######",
    "....................############..############.........#####",
    "..............##########.....#.##....########............###",
    "..............#########..........###..########..#####...####",
    "..............#######........#.....#...##...################",
    "..............#######...................##..################",
    "................####....#######.........#....###############",
    "................###.###########...........##........########",
    "...............################.....................########",
    ".............######################....##..........#########",
    ".............########################.######################",
    ".............###############################################",
    "..........#########################################.########",
    ".........##########################################..#######",
    ".........##########################################..#######",
    "........############################################...#####",
    ".......##############################################..#####",
    ".......##############################################...####",
    "........##############################################...###",
    ".......################################################...##",
    ".......################################################...##"
  ];
  return Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => {
    const sourceX = Math.min(59, Math.floor((x + .5) / WIDTH * 60));
    const sourceY = Math.min(39, Math.floor((y + .5) / HEIGHT * 40));
    if (coastline[sourceY][sourceX] !== "#") return { x, y, type: "water" };
    const nx = (x + .5) / WIDTH;
    const ny = (y + .5) / HEIGHT;
    const variation = terrainVariation(x, y);
    const alps = nx > .42 && nx < .58 && ny > .44 && ny < .55;
    const north = ny < .25;
    const sahara = ny > .73;
    const type = alps ? (variation < 6 ? "mountain" : "hills")
      : sahara ? (variation < 2 ? "hills" : variation < 9 ? "desert" : "plains")
        : north ? (variation < 4 ? "mountain" : variation < 7 ? "forest" : "grass")
          : variation < 3 ? "forest" : variation < 5 ? "hills" : variation < 8 ? "plains" : "grass";
    return { x, y, type };
  }));
}

function generateArchipelagoMap(seed) {
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const islands = Array.from({ length: 25 }, () => ({
    x: .07 + random() * .86,
    y: .07 + random() * .86,
    radiusX: .025 + random() * .055,
    radiusY: .035 + random() * .08
  }));
  for (const civilization of game.civilizations) {
    if (civilization.independent) continue;
    const start = getMapStartPosition(civilization, "archipelago");
    islands.push({ x: start.x / (WIDTH - 1), y: start.y / (HEIGHT - 1), radiusX: .075, radiusY: .1 });
  }
  return Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => {
    const nx = x / (WIDTH - 1);
    const ny = y / (HEIGHT - 1);
    const island = islands.find((mass) =>
      ((nx - mass.x) / mass.radiusX) ** 2 + ((ny - mass.y) / mass.radiusY) ** 2 < .88
    );
    if (!island) return { x, y, type: "water" };
    const variation = terrainVariation(x, y);
    const type = variation < 2 ? "hills" : variation < 5 ? "forest" : variation < 7 ? "plains" : "grass";
    return { x, y, type };
  }));
}

function generateAshRingMap() {
  return Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => {
    const nx = (x / (WIDTH - 1) - .5) * 1.12;
    const ny = (y / (HEIGHT - 1) - .5) * 1.12;
    const radius = Math.sqrt(nx * nx + ny * ny);
    if (radius < .22 || radius > .56) return { x, y, type: "water" };
    const variation = terrainVariation(x, y);
    const type = radius > .48 ? (variation < 5 ? "hills" : "mountain")
      : variation < 3 ? "forest" : variation < 6 ? "plains" : variation < 8 ? "desert" : "grass";
    return { x, y, type };
  }));
}

function generateTierraUnTercioMap() {
  const starts = {
    humanity: [.25, .24],
    "demonic-unified-front": [.22, .75],
    "angelical-councils": [.5, .5],
    "pagan-sun": [.77, .23]
  };
  const lakes = [
    { x: .36, y: .25, radiusX: .045, radiusY: .07 },
    { x: .59, y: .2, radiusX: .05, radiusY: .065 },
    { x: .36, y: .68, radiusX: .04, radiusY: .055 },
    { x: .56, y: .73, radiusX: .055, radiusY: .045 }
  ];
  return Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => {
    const nx = x / (WIDTH - 1);
    const ny = y / (HEIGHT - 1);
    const coast = 1 + .08 * Math.sin(nx * 31 + ny * 17) +
      .05 * Math.cos(nx * 43 - ny * 19) + .035 * Math.sin(ny * 57 + nx * 11);
    const continentalDistance = ((nx - .5) / .46) ** 2 + ((ny - .52) / .43) ** 2;
    const isStartClearing = Object.values(starts).some(([startX, startY]) =>
      Math.abs(x - Math.round(startX * (WIDTH - 1))) +
        Math.abs(y - Math.round(startY * (HEIGHT - 1))) <= 3
    );
    if (!isStartClearing && continentalDistance > coast) return { x, y, type: "water" };
    const lake = !isStartClearing && lakes.some((body) =>
      ((nx - body.x) / body.radiusX) ** 2 + ((ny - body.y) / body.radiusY) ** 2 < 1
    );
    if (lake) return { x, y, type: "water" };

    const variation = terrainVariation(x, y);
    const enclaveX = (nx - .69) / .135;
    const enclaveY = (ny - .47) / .22;
    const enclaveRadius = Math.sqrt(enclaveX * enclaveX + enclaveY * enclaveY);
    const enclaveAngle = Math.atan2(enclaveY, enclaveX);
    const distanceToAngle = (angle) =>
      Math.abs(Math.atan2(Math.sin(enclaveAngle - angle), Math.cos(enclaveAngle - angle)));
    const mountainPass = distanceToAngle(-1.15) < .12 || distanceToAngle(2.35) < .12;
    if (enclaveRadius >= .78 && enclaveRadius <= 1.16 && !mountainPass) {
      return { x, y, type: "mountain" };
    }
    if (enclaveRadius < .78) {
      const type = variation < 4 ? "mountain" : variation < 8 ? "hills" : variation < 9 ? "forest" : "plains";
      return { x, y, type };
    }

    const northSouthDistance = Math.abs(nx - (.4 + .25 * ny + .035 * Math.sin(ny * 15)));
    const eastWestDistance = Math.abs(ny - (.34 + .28 * nx + .03 * Math.sin(nx * 18)));
    const northSouthRidge = northSouthDistance < .026 && (ny < .43 || ny > .57);
    const eastWestRidge = eastWestDistance < .032 && (nx < .43 || nx > .57);
    const foothills = northSouthDistance < .052 || eastWestDistance < .058;
    if (northSouthRidge || eastWestRidge) {
      return { x, y, type: variation < 8 ? "mountain" : "hills" };
    }
    if (foothills) return { x, y, type: variation < 4 ? "hills" : "forest" };
    if (ny < .3) return { x, y, type: variation < 3 ? "hills" : variation < 7 ? "forest" : "grass" };
    if (ny > .68) return { x, y, type: variation < 3 ? "hills" : variation < 6 ? "plains" : "grass" };
    return { x, y, type: variation < 3 ? "forest" : variation < 5 ? "hills" : variation < 8 ? "plains" : "grass" };
  }));
}

function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [currentX, currentY] = polygon[index];
    const [previousX, previousY] = polygon[previous];
    const crosses = (currentY > y) !== (previousY > y) &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function terrainVariation(x, y) {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 11;
}

function createNorthernIslands(tiles = game.tiles, mapId = game.mapId) {
  const scaleX = WIDTH / BASE_WIDTH;
  const scaleY = HEIGHT / BASE_HEIGHT;
  for (let y = 0; y <= Math.floor(5 * scaleY); y += 1) {
    for (let x = 0; x < WIDTH; x += 1) tiles[y][x].type = "water";
  }
  for (let y = Math.floor(22 * scaleY); y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) tiles[y][x].type = "water";
  }
  const northernIslands = [
    { x: 20, y: 2, radiusX: 6.5, radiusY: 2.7 },
    { x: 7, y: 2, radiusX: 3.5, radiusY: 1.8 },
    { x: 33, y: 2, radiusX: 3.5, radiusY: 1.8 }
  ];
  const southernIslands = mapId === "pandora"
    ? [{ x: 7, y: 25, radiusX: 3.3, radiusY: 1.7 }]
    : [
      { x: 20, y: 25, radiusX: 7, radiusY: 2.7 },
      { x: 7, y: 25, radiusX: 3.3, radiusY: 1.7 },
      { x: 33, y: 25, radiusX: 3.3, radiusY: 1.7 }
    ];
  const islands = [...northernIslands, ...southernIslands];
  for (const island of islands) {
    const centerX = island.x * scaleX;
    const centerY = island.y * scaleY;
    const radiusX = island.radiusX * scaleX;
    const radiusY = island.radiusY * scaleY;
    for (let y = Math.max(0, Math.floor(centerY - radiusY)); y <= Math.min(HEIGHT - 1, Math.ceil(centerY + radiusY)); y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const distance = ((x - centerX) / radiusX) ** 2 +
          ((y - centerY) / radiusY) ** 2;
        if (distance > 1) continue;
        const variation = (x * 7 + y * 11) % 4;
        tiles[y][x].type = variation === 0 ? "forest" : variation === 1 ? "plains" : "grass";
      }
    }
  }
}

function createAbyssZone(tiles = game.tiles, mapId = game.mapId) {
  const centerX = Math.floor(WIDTH / 2);
  const centerY = mapId === "europe" ? HEIGHT - 2
    : mapId === "tierra-un-tercio" ? Math.round(HEIGHT * .74) : Math.floor(HEIGHT / 2);
  const abyssCenterX = mapId === "tierra-un-tercio" ? Math.round(WIDTH * .72) : centerX;
  for (let y = Math.max(0, centerY - 2); y <= Math.min(HEIGHT - 1, centerY + 1); y += 1) {
    for (let x = Math.max(0, abyssCenterX - 4); x <= Math.min(WIDTH - 1, abyssCenterX + 3); x += 1) {
      tiles[y][x].type = "abyss";
    }
  }
}

function getNorthernDragonLairPosition(mapId = game.mapId) {
  if (mapId === "europe") return { x: 42, y: 3 };
  if (mapId === "pandora") {
    return { x: Math.round(7 * WIDTH / BASE_WIDTH), y: Math.round(25 * HEIGHT / BASE_HEIGHT) };
  }
  return { x: Math.round(33 * WIDTH / BASE_WIDTH), y: Math.round(2 * HEIGHT / BASE_HEIGHT) };
}

function createNorthernDragonIsland(tiles, mapId) {
  const center = getNorthernDragonLairPosition(mapId);
  for (let y = Math.max(0, center.y - 1); y <= Math.min(HEIGHT - 1, center.y + 1); y += 1) {
    for (let x = Math.max(0, center.x - 2); x <= Math.min(WIDTH - 1, center.x + 2); x += 1) {
      if (((x - center.x) / 2) ** 2 + ((y - center.y) / 1.5) ** 2 > 1) continue;
      if (tiles[y][x].type === "water") tiles[y][x].type = "grass";
    }
  }
  tiles[center.y][center.x].type = "grass";
}

function applySharedMapFeatures(mapId, tiles = game.tiles) {
  createAbyssZone(tiles, mapId);
  createNorthernDragonIsland(tiles, mapId);
}

function spawnStartingUnits(civilization, start, minimumDistance = 0) {
  const unitIds = civilization.startingUnits?.length
    ? civilization.startingUnits
    : [game.unitTypes.has("settler") ? "settler" : null, game.unitTypes.has("imperial-guard") ? "imperial-guard" : null].filter(Boolean);
  const positions = findStartingUnitPositions(start, unitIds.length, minimumDistance);

  for (let index = 0; index < unitIds.length; index += 1) {
    const unitId = unitIds[index];
    if (!game.unitTypes.has(unitId)) throw new Error(`La unidad inicial "${unitId}" no está definida.`);
    const position = positions[index];
    spawnUnit(unitId, position.x, position.y, civilization.id);
  }
  return positions;
}

function findStartingUnitPositions(start, count, minimumDistance) {
  const preferred = {
    x: Math.min(WIDTH - 1, Math.max(0, Math.round(start.x))),
    y: Math.min(HEIGHT - 1, Math.max(0, Math.round(start.y)))
  };
  const centers = game.tiles.flat()
    .filter((tile) => TERRAIN[tile.type].passable && !getUnitAt(tile.x, tile.y) && !getCityAt(tile.x, tile.y))
    .sort((first, second) =>
      Math.abs(first.x - preferred.x) + Math.abs(first.y - preferred.y) -
        (Math.abs(second.x - preferred.x) + Math.abs(second.y - preferred.y)) ||
      first.y - second.y || first.x - second.x
    );

  for (let clearance = minimumDistance; clearance >= 0; clearance -= 1) {
    for (const center of centers) {
      const positions = [];
      for (let y = Math.max(0, center.y - 3); y <= Math.min(HEIGHT - 1, center.y + 3); y += 1) {
        for (let x = Math.max(0, center.x - 3); x <= Math.min(WIDTH - 1, center.x + 3); x += 1) {
          if (Math.abs(x - center.x) + Math.abs(y - center.y) > 3 ||
              !TERRAIN[game.tiles[y][x].type].passable || getUnitAt(x, y) || getCityAt(x, y) ||
              game.units.some((unit) => Math.abs(unit.x - x) + Math.abs(unit.y - y) < clearance)) continue;
          positions.push({ x, y });
        }
      }
      positions.sort((first, second) =>
        Math.abs(first.x - center.x) + Math.abs(first.y - center.y) -
          (Math.abs(second.x - center.x) + Math.abs(second.y - center.y)) ||
        first.y - second.y || first.x - second.x
      );
      if (positions.length >= count) return positions.slice(0, count);
    }
  }
  throw new Error("No hay suficiente terreno libre para desplegar las unidades iniciales.");
}

function getStartPosition(civilization) {
  return getMapStartPosition(civilization, game.mapId);
}

function getMapStartPosition(civilization, mapId = "pandora") {
  const starts = {
    europe: {
      humanity: [.51, .41],
      "demonic-unified-front": [.30, .58],
      "angelical-councils": [.71, .55],
      "pagan-sun": [.61, .25]
    },
    archipelago: {
      humanity: [.19, .23],
      "demonic-unified-front": [.76, .23],
      "angelical-councils": [.77, .77],
      "pagan-sun": [.22, .76]
    },
    "ash-ring": {
      humanity: [.5, .12],
      "demonic-unified-front": [.86, .5],
      "angelical-councils": [.5, .87],
      "pagan-sun": [.14, .5]
    },
    "tierra-un-tercio": {
      humanity: [.25, .24],
      "demonic-unified-front": [.22, .75],
      "angelical-councils": [.5, .5],
      "pagan-sun": [.77, .23]
    }
  };
  const fraction = starts[mapId]?.[civilization?.id];
  if (fraction) return {
    x: Math.round(fraction[0] * (WIDTH - 1)),
    y: Math.round(fraction[1] * (HEIGHT - 1))
  };
  const position = STARTS[civilization?.id] ?? { x: (BASE_WIDTH - 1) / 2, y: (BASE_HEIGHT - 1) / 2 };
  return {
    x: Math.round(position.x * (WIDTH - 1) / (BASE_WIDTH - 1)),
    y: Math.round(position.y * (HEIGHT - 1) / (BASE_HEIGHT - 1))
  };
}

function getOpponentCivilizations(playerCivilizationId) {
  const hasStartingPosition = Object.prototype.hasOwnProperty.call(STARTS, playerCivilizationId);
  return game.civilizations.filter((civilization) =>
    civilization.id !== playerCivilizationId && !civilization.independent &&
    (hasStartingPosition || civilization.id !== "humanity")
  );
}

function initializeOpponents(playerCivilization, playerCount = game.playerCount, opponentIds = null) {
  let candidates = getOpponentCivilizations(playerCivilization.id);
  if (Array.isArray(opponentIds)) {
    candidates = opponentIds.map((id) => candidates.find((civilization) => civilization.id === id))
      .filter(Boolean);
  } else {
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
    }
    candidates = candidates.slice(0, playerCount - 1);
  }
  game.opponents = candidates
    .map((civilization) => {
      const opponent = {
        civilization,
        relation: 0,
        met: false,
        delegationSent: false,
        atWar: false,
        warTurns: 0,
        peaceOffered: false,
        tradeTurns: 0,
        turns: 0,
        production: 0,
        food: 0,
        foodDeficitTurns: 0,
        cityNameIndex: 0
      };
      const positions = spawnStartingUnits(civilization, getStartPosition(civilization), 4);
      if (civilization.id === "pagan-sun") {
        initializePaganSunStartingCity(positions[0]);
        opponent.cityNameIndex = 1;
      }
      return opponent;
    });
}

function initializeBarbarianCamps() {
  game.barbarianCamps = [];
  const candidates = game.tiles.flat().filter((tile) =>
    TERRAIN[tile.type].passable && !getUnitAt(tile.x, tile.y) && !getCityAt(tile.x, tile.y) &&
    game.units.every((unit) => Math.abs(unit.x - tile.x) + Math.abs(unit.y - tile.y) >= 5)
  );
  const campSpecs = [
    { faction: "dragons", preferred: getNorthernDragonLairPosition(game.mapId) },
    { faction: "barbarians", preferred: { x: Math.round(11 * WIDTH / BASE_WIDTH), y: Math.round(3 * HEIGHT / BASE_HEIGHT) } },
    { faction: "elves" },
    { faction: "dwarves" },
    { faction: "barbarians" },
    { faction: "barbarians" },
    { faction: "elves" },
    { faction: "dwarves" },
    { faction: "barbarians" }
  ].filter((spec) => game.barbariansEnabled || spec.faction !== "barbarians");
  for (let index = 0; index < campSpecs.length && candidates.length; index += 1) {
    const spec = campSpecs[index];
    const preferredTile = spec.preferred && candidates.find((tile) =>
      tile.x === spec.preferred.x && tile.y === spec.preferred.y
    );
    const available = candidates.filter((tile) =>
      game.barbarianCamps.every((camp) => Math.abs(camp.x - tile.x) + Math.abs(camp.y - tile.y) >= 6)
    );
    const pool = available.length ? available : candidates;
    const tile = preferredTile ?? pool[Math.floor(Math.random() * pool.length)];
    candidates.splice(candidates.indexOf(tile), 1);
    const faction = spec.faction;
    const camp = { id: `${game.saveId}-village-${index + 1}`, faction, x: tile.x, y: tile.y };
    game.barbarianCamps.push(camp);
    const guardType = faction === "elves" ? "elf-scout" :
      faction === "dwarves" ? "dwarf-guardian" :
        faction === "dragons" ? "dragon" : "barbarian-raider";
    const guard = spawnUnit(guardType, tile.x, tile.y);
    guard.campId = camp.id;
  }
}

function restoreOpponents(savedOpponents, playerCivilization) {
  if (!Array.isArray(savedOpponents) || savedOpponents.length === 0) {
    initializeOpponents(playerCivilization, game.playerCount);
    return game.opponents;
  }
  const opponents = savedOpponents.flatMap((saved) => {
    const civilizationId = saved.civilizationId ?? saved.civilization?.id;
    const civilization = game.civilizations.find((item) =>
      item.id === civilizationId && item.id !== playerCivilization.id && !item.independent
    );
    if (!civilization) return [];
    return [{
      ...saved,
      civilization,
      relation: Number(saved.relation) || 0,
      met: saved.met === true,
      atWar: saved.atWar === true,
      warTurns: Math.max(0, Number(saved.warTurns) || 0),
      peaceOffered: saved.peaceOffered === true,
      delegationSent: saved.delegationSent === true,
      tradeTurns: Math.max(0, Number(saved.tradeTurns) || 0),
      turns: Math.max(0, Number(saved.turns) || 0),
      production: Math.max(0, Number(saved.production) || 0),
      food: Math.max(0, Number(saved.food) || 0),
      foodDeficitTurns: Math.max(0, Math.floor(Number(saved.foodDeficitTurns) || 0)),
      cityNameIndex: Math.max(0, Number(saved.cityNameIndex) || 0)
    }];
  });
  const paganOpponent = opponents.find((opponent) => opponent.civilization.id === "pagan-sun");
  if (paganOpponent && !game.cities.some((city) =>
    (city.originalOwnerId ?? city.ownerId) === "pagan-sun"
  )) {
    const paganUnit = game.units.find((unit) => getUnitFaction(unit) === "pagan-sun");
    const position = paganUnit &&
      TERRAIN[game.tiles[paganUnit.y]?.[paganUnit.x]?.type]?.passable
      ? paganUnit
      : findStartingUnitPositions(getStartPosition(paganOpponent.civilization), 1, 4)[0];
    initializePaganSunStartingCity(position);
    paganOpponent.cityNameIndex = Math.max(1, paganOpponent.cityNameIndex);
  }
  return opponents;
}

function getWorldTerrain(x, y) {
  const baseX = x * (BASE_WIDTH - 1) / (WIDTH - 1);
  const baseY = y * (BASE_HEIGHT - 1) / (HEIGHT - 1);
  if (!isLandTile(x, y)) return "water";
  const variation = (Math.floor(baseX) * 17 + Math.floor(baseY) * 31 + Math.floor(baseX * baseY) * 7) % 11;

  if (baseX <= 10 && baseY >= 8 && baseY <= 20) {
    return variation < 8 ? "desert" : variation < 10 ? "hills" : "plains";
  }
  if (baseX >= 25 && baseY <= 16) {
    return variation < 6 ? "mountain" : variation < 9 ? "hills" : "plains";
  }
  if (baseX >= 25 && baseY >= 14) {
    return variation < 6 ? "forest" : variation < 9 ? "plains" : "grass";
  }
  if (baseY <= 9 && baseX < 25) {
    return variation < 6 ? "forest" : variation < 9 ? "hills" : "plains";
  }
  if (baseY >= 20 && baseX >= 14) {
    return variation < 5 ? "forest" : variation < 9 ? "plains" : "grass";
  }
  return variation < 4 ? "forest" : variation < 7 ? "plains" : "grass";
}

function isLandTile(x, y) {
  x = x * (BASE_WIDTH - 1) / (WIDTH - 1);
  y = y * (BASE_HEIGHT - 1) / (HEIGHT - 1);
  let inside = false;
  for (let index = 0, previous = LANDMASS.length - 1; index < LANDMASS.length; previous = index, index += 1) {
    const [currentX, currentY] = LANDMASS[index];
    const [previousX, previousY] = LANDMASS[previous];
    const crosses = (currentY > y) !== (previousY > y) &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function spawnUnit(typeId, x, y, ownerId = null) {
  const type = game.unitTypes.get(typeId);
  if (!type) throw new Error(`La unidad "${typeId}" no está definida en el XML.`);
  const faction = ownerId ?? type.faction;
  const strength = getUnitStrength(type, faction);
  const upgrades = { attack: 0, vitality: 0, defense: 0 };
  const maxHealth = (type.maxHealth || Math.max(15, 20 + strength * 2)) +
    upgrades.vitality * 8;
  const unit = {
    id: game.nextUnitId++,
    typeId,
    ...(ownerId ? { ownerId } : {}),
    x,
    y,
    stance: "active",
    ...(type.canBuild ? { buildCharges: 3 } : {}),
    combatCount: 0,
    level: 1,
    pendingUpgrades: 0,
    upgrades,
    movesLeft: type.movement,
    maxHealth,
    health: maxHealth
  };
  game.units.push(unit);
  return unit;
}

function showCombatDamageEffect(target, amount) {
  const key = `${target.x},${target.y}`;
  const effect = { amount };
  combatVisualEffects.set(key, effect);
  window.setTimeout(() => {
    if (combatVisualEffects.get(key) !== effect) return;
    combatVisualEffects.delete(key);
    render();
  }, 850);
}

function render() {
  updateVisibility();
  renderMap();
  renderSelection();
  renderStats();
  updateMapZoom();
  if (game.victory) showVictoryDialog();
}

function renderMap() {
  const reachable = getReachableTiles();
  const purchasableCityTiles = getPurchasableCityTileMap();
  mapElement.style.gridTemplateColumns = `repeat(${WIDTH}, minmax(0, 1fr))`;
  mapElement.replaceChildren();

  for (const row of game.tiles) {
    for (const tile of row) {
      const unit = getUnitAt(tile.x, tile.y);
      const city = getCityAt(tile.x, tile.y);
      const camp = game.barbarianCamps.find((item) => item.x === tile.x && item.y === tile.y);
      const territoryOwner = getTerritoryOwner(tile.x, tile.y);
      const key = `${tile.x},${tile.y}`;
      const isVisible = game.visibleTiles.has(key);
      const damageEffect = isVisible ? combatVisualEffects.get(key) : null;
      const isExplored = game.explored[tile.y][tile.x];
      const button = createTerrainTile(tile, true);
      button.dataset.x = String(tile.x);
      button.dataset.y = String(tile.y);
      if (isVisible && unit) button.classList.add("unit-tile");
      if (!isExplored) {
        button.classList.add("fog-unseen");
        button.setAttribute("aria-label", `Territorio inexplorado, columna ${tile.x + 1}, fila ${tile.y + 1}`);
        button.title = "Territorio inexplorado";
      } else {
        if (!isVisible) button.classList.add("fog-explored");
        button.setAttribute("aria-label", describeTile(tile, isVisible ? unit : null, isVisible ? city : null));
        button.title = describeTile(tile, isVisible ? unit : null, isVisible ? city : null);
      }
      if (isExplored && purchasableCityTiles.has(key)) {
        button.classList.add("purchasable-territory");
        button.title = `${button.title}. Puedes comprar esta casilla por ${CITY_TILE_PURCHASE_COST} de oro.`;
      }
      if (isSelectedTile(tile.x, tile.y)) button.classList.add("selected");
      if (isVisible && reachable.has(key)) button.classList.add("reachable");
      const selectedUnit = getSelectedUnit();
      if (isVisible && selectedUnit && selectedUnit.movesLeft > 0 &&
          getUnitStrength(game.unitTypes.get(selectedUnit.typeId), getUnitFaction(selectedUnit)) > 0 &&
          ((unit && getUnitFaction(unit) !== game.civilization.id) ||
            (city && city.ownerId !== game.civilization.id))) {
        button.classList.add("combat-target");
        button.title = `${button.title}. Pulsa con una unidad seleccionada para ordenar un ataque.`;
      }
      if (isVisible && city) {
        button.classList.add("city-tile");
        button.classList.add(city.ownerId === game.civilization.id ? "player-city" : "foreign-city");
      }
      if (isVisible && territoryOwner) {
        button.classList.add(territoryOwner === game.civilization.id ? "player-territory" : "foreign-territory");
      }

      if (isVisible && unit) {
        const unitType = game.unitTypes.get(unit.typeId);
        const isHostileBeast = getUnitFaction(unit) === "beasts";
        const unitMarker = createPixelArtElement(`unit-${unit.typeId}`, "0 0 24 30",
          `unit-sprite stance-${unit.stance ?? "active"}`);
        button.append(unitMarker);
        const typeMarker = document.createElement("span");
        typeMarker.className = `unit-type-marker${isHostileBeast ? " hostile-unit-marker" : ""}`;
        typeMarker.setAttribute("aria-hidden", "true");
        typeMarker.title = isHostileBeast ? `Enemigo hostil: ${unitType.name}` : unitType.name;
        if (unitType.id === "abyss-beast") {
          typeMarker.append(createPixelArtElement("unit-icon-abyss-beast", "0 0 16 16", "unit-type-icon-sprite"));
        } else {
          typeMarker.textContent = unitType.icon;
        }
        button.append(typeMarker);
        if (isHostileBeast) {
          button.setAttribute("aria-label", `${button.getAttribute("aria-label") ?? unitType.name} · enemigo hostil`);
        }
        const healthbar = document.createElement("span");
        const healthPercentage = Math.max(0, Math.min(100, Math.round((unit.health / unit.maxHealth) * 100)));
        const healthState = healthPercentage <= 30 ? "health-critical" : healthPercentage <= 65 ? "health-wounded" : "";
        healthbar.className = "unit-healthbar";
        healthbar.setAttribute("role", "meter");
        healthbar.setAttribute("aria-label", `Salud: ${unit.health} de ${unit.maxHealth}`);
        const healthFill = document.createElement("span");
        healthFill.className = `unit-healthbar-fill ${healthState}`;
        healthFill.style.width = `${healthPercentage}%`;
        healthbar.append(healthFill);
        button.append(healthbar);
        if (unit.stance === "fortified" || unit.stance === "resting") {
          const stanceBadge = document.createElement("span");
          stanceBadge.className = "unit-stance-badge";
          stanceBadge.setAttribute("aria-hidden", "true");
          stanceBadge.textContent = unit.stance === "fortified" ? "⛨" : "Z";
          button.append(stanceBadge);
        }
        if (unit.level > 1) {
          const levelBadge = document.createElement("span");
          levelBadge.className = "unit-level-badge";
          levelBadge.textContent = `N${unit.level}`;
          levelBadge.title = `Nivel ${unit.level}`;
          button.append(levelBadge);
        }
      }
      if (isVisible && city) {
        const cityMarker = document.createElement("span");
        cityMarker.className = "city-marker";
        cityMarker.setAttribute("aria-hidden", "true");
        cityMarker.textContent = "";
        button.append(cityMarker);
        const healthPercentage = Math.max(0, Math.min(100, Math.round((city.health / city.maxHealth) * 100)));
        const healthState = healthPercentage <= 30 ? "health-critical" : healthPercentage <= 65 ? "health-wounded" : "";
        const healthbar = document.createElement("span");
        healthbar.className = "city-healthbar";
        healthbar.setAttribute("role", "meter");
        healthbar.setAttribute("aria-label", `Salud de ${city.name}: ${city.health} de ${city.maxHealth}`);
        const healthFill = document.createElement("span");
        healthFill.className = `unit-healthbar-fill ${healthState}`;
        healthFill.style.width = `${healthPercentage}%`;
        healthbar.append(healthFill);
        button.append(healthbar);
        if (city.buildings?.includes("city-walls")) {
          const wallMarker = document.createElement("span");
          wallMarker.className = "city-walls-marker";
          wallMarker.setAttribute("aria-label", "Murallas");
          wallMarker.title = "Murallas";
          wallMarker.textContent = "⛨";
          button.append(wallMarker);
        }
        if (city.isCapital) {
          const capitalMarker = document.createElement("span");
          const owner = game.civilizations.find((civilization) =>
            civilization.id === (city.originalOwnerId ?? city.ownerId)
          );
          capitalMarker.className = "capital-marker";
          capitalMarker.setAttribute("aria-label", `Capital de ${owner?.name ?? "una nación"}`);
          capitalMarker.title = `Capital de ${owner?.name ?? "una nación"}`;
          capitalMarker.textContent = "★";
          button.append(capitalMarker);
        }
      }
      if (isVisible && tile.improvement) {
        const improvement = TILE_IMPROVEMENTS[tile.improvement.id];
        if (improvement) {
          const marker = document.createElement("span");
          marker.className = `tile-improvement improvement-${tile.improvement.id}`;
          marker.setAttribute("aria-label", improvement.name);
          marker.title = improvement.name;
          marker.textContent = improvement.icon;
          button.append(marker);
        }
      }
      if (isVisible && tile.structure) {
        const building = game.buildings.find((item) => item.id === tile.structure.buildingId);
        if (building) {
          const structureMarker = document.createElement("span");
          structureMarker.className = "tile-improvement tile-structure";
          structureMarker.setAttribute("aria-label", building.name);
          structureMarker.title = `${building.name} · ${game.unitTypes.get(building.unitId)?.name ?? "unidad especial"}`;
          structureMarker.textContent = building.id === "cathedral-of-the-sun" ? "☼" :
            building.id === "infernal-portal" ? "♨" :
              building.id === "great-library-of-justice" ? "▤" : "⚓";
          button.append(structureMarker);
        }
      }
      if (isVisible && camp) {
        const marker = document.createElement("span");
        marker.className = "barbarian-camp-marker";
        const campName = camp.faction === "elves" ? "Campamento élfico" :
          camp.faction === "dwarves" ? "Campamento enano" :
            camp.faction === "dragons" ? "Guarida del Dragón ancestral · peligro extremo" : "Campamento bárbaro";
        marker.setAttribute("aria-label", campName);
        marker.title = campName;
        const campSprite = camp.faction === "elves" ? "camp-elf" :
          camp.faction === "dwarves" ? "camp-dwarf" :
            camp.faction === "barbarians" ? "camp-barbarian" : null;
        if (campSprite) {
          marker.append(createPixelArtElement(campSprite, "0 0 16 16", "camp-pixel-art"));
        } else {
          marker.textContent = "♨";
        }
        button.append(marker);
      }
      if (damageEffect) {
        button.classList.add("combat-damage");
        const damageLabel = document.createElement("span");
        damageLabel.className = "combat-damage-number";
        damageLabel.setAttribute("aria-hidden", "true");
        damageLabel.textContent = `−${damageEffect.amount}`;
        button.append(damageLabel);
      }
      button.addEventListener("click", () => onTileClick(tile));
      mapElement.append(button);
    }
  }
}

function createTerrainTile(tile, includeCoordinates = true) {
  const terrain = TERRAIN[tile.type];
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tile ${tile.type}`;
  button.setAttribute("role", "gridcell");
  button.setAttribute("aria-label", `${terrain.name}${includeCoordinates ? `, columna ${tile.x + 1}, fila ${tile.y + 1}` : ""}`);
  button.title = `${terrain.name}${includeCoordinates ? ` · ${tile.x + 1}, ${tile.y + 1}` : ""}`;
  const icon = createPixelArtElement(`terrain-${tile.type}`, "0 0 24 24", "terrain-icon");
  button.append(icon);
  if (includeCoordinates) {
    const label = document.createElement("span");
    label.className = "tile-label terrain-label";
    label.textContent = terrain.short;
    button.append(label);
  }
  return button;
}

function createPixelArtElement(spriteId, viewBox, className) {
  const namespace = "http://www.w3.org/2000/svg";
  const image = document.createElementNS(namespace, "svg");
  image.setAttribute("viewBox", viewBox);
  image.setAttribute("aria-hidden", "true");
  image.classList.add(...className.split(" "));
  const use = document.createElementNS(namespace, "use");
  const spriteReference = `assets/pixel-art.svg#${spriteId}`;
  use.setAttribute("href", spriteReference);
  use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", spriteReference);
  use.setAttribute("x", "0");
  use.setAttribute("y", "0");
  use.setAttribute("width", viewBox.split(" ")[2]);
  use.setAttribute("height", viewBox.split(" ")[3]);
  image.append(use);
  return image;
}

function renderUnitIcon(type) {
  if (type.id === "abyss-beast") {
    return '<svg class="unit-icon-pixel-art" viewBox="0 0 16 16" aria-hidden="true"><use href="assets/pixel-art.svg#unit-icon-abyss-beast" xlink:href="assets/pixel-art.svg#unit-icon-abyss-beast"></use></svg>';
  }
  return escapeHtml(type.icon);
}

function describeTile(tile, unit, city) {
  const name = TERRAIN[tile.type].name;
  const parts = [`${name}, columna ${tile.x + 1}, fila ${tile.y + 1}`];
  if (city) parts.push(`${city.isCapital ? "capital, " : ""}ciudad ${city.name}`);
  if (unit) {
    const stance = unit.stance === "fortified" ? "en defensa" : unit.stance === "resting" ? "descansando" : "activa";
    parts.push(`${game.unitTypes.get(unit.typeId).name}, salud ${unit.health}/${unit.maxHealth}, ${stance}`);
  }
  if (tile.improvement) parts.push(TILE_IMPROVEMENTS[tile.improvement.id]?.name ?? tile.improvement.id);
  if (tile.structure) {
    parts.push(game.buildings.find((building) => building.id === tile.structure.buildingId)?.name ??
      "construcción territorial");
  }
  const camp = game.barbarianCamps.find((item) => item.x === tile.x && item.y === tile.y);
  if (camp) parts.push(camp.faction === "elves" ? "campamento élfico" :
    camp.faction === "dwarves" ? "campamento enano" :
      camp.faction === "dragons" ? "guarida del Dragón ancestral" : "campamento bárbaro");
  return parts.join(", ");
}

function renderTileContents(tile) {
  const terrain = TERRAIN[tile.type];
  const improvement = tile.improvement && TILE_IMPROVEMENTS[tile.improvement.id];
  const building = tile.structure &&
    game.buildings.find((item) => item.id === tile.structure.buildingId);
  return `<div class="tile-content-details">
    <p class="terrain-description"><strong>Casilla: ${escapeHtml(terrain.name)}</strong> · ${terrain.passable ? "Transitable" : "Infranqueable"} · ✿ ${terrain.food} alimentos · ⚒ ${terrain.production} producción.</p>
    ${improvement ? `<p class="terrain-description">Mejora: ${escapeHtml(improvement.name)} · produce ${improvement.amount} ${escapeHtml(getMaterialName(improvement.resource))} por turno.</p>` : ""}
    ${tile.improvement && !improvement ? `<p class="terrain-description">Mejora: ${escapeHtml(tile.improvement.id)}.</p>` : ""}
    ${building ? `<p class="terrain-description">Construcción: ${escapeHtml(building.name)} · forma ${escapeHtml(game.unitTypes.get(building.unitId)?.name ?? "una unidad")} cada ${building.unitInterval} turnos.</p>` : ""}
    ${tile.structure && !building ? `<p class="terrain-description">Construcción: ${escapeHtml(tile.structure.buildingId)}.</p>` : ""}
  </div>`;
}

function onTileClick(tile) {
  if (game.turnProcessing || game.activeTurnFactionId !== game.civilization?.id) return;
  if (game.victory) {
    showMessage("La partida ha terminado con una victoria.");
    return;
  }
  const isExplored = game.explored[tile.y][tile.x];
  const selectedUnit = getSelectedUnit();
  if (!isExplored && !selectedUnit) {
    showMessage("Envía una unidad para explorar esta zona.");
    return;
  }
  const unit = getUnitAt(tile.x, tile.y);
  if (unit) {
    if (getUnitFaction(unit) !== game.civilization.id) {
      if (selectedUnit && getUnitFaction(selectedUnit) === game.civilization.id) {
        requestAttackOrder(selectedUnit.id, unit.id, "unit");
        return;
      }
      game.selectedUnitId = null;
      game.selectedTile = { x: tile.x, y: tile.y };
      render();
      return;
    }
    game.selectedUnitId = unit.id;
    game.selectedTile = { x: tile.x, y: tile.y };
    render();
    return;
  }

  const city = getCityAt(tile.x, tile.y);
  if (city && city.ownerId !== game.civilization.id &&
      selectedUnit && getUnitFaction(selectedUnit) === game.civilization.id) {
    requestAttackOrder(selectedUnit.id, city.territoryId, "city");
    return;
  }

  if (selectedUnit?.tradeRoute) {
    showMessage("Este comerciante sigue su ruta automáticamente y no se puede mover manualmente.");
    return;
  }

  if (selectedUnit && selectedUnit.movesLeft > 0) {
    const path = findPath(selectedUnit, tile.x, tile.y, selectedUnit.movesLeft);
    if (path) {
      selectedUnit.stance = "active";
      selectedUnit.x = tile.x;
      selectedUnit.y = tile.y;
      selectedUnit.movesLeft -= path.cost;
      processCampEntries(selectedUnit, path.path);
      game.selectedTile = { x: tile.x, y: tile.y };
      render();
      saveGame();
      return;
    }
  }

  if (!isExplored && selectedUnit) {
    showMessage("No hay una ruta disponible hasta esa zona.");
    return;
  }

  game.selectedUnitId = null;
  game.selectedTile = { x: tile.x, y: tile.y };
  render();
}

function getReachableTiles() {
  const unit = getSelectedUnit();
  const result = new Set();
  if (!unit || unit.tradeRoute || unit.movesLeft < 1) return result;

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if ((x !== unit.x || y !== unit.y) && game.visibleTiles.has(`${x},${y}`) &&
          findPath(unit, x, y, unit.movesLeft)) {
        result.add(`${x},${y}`);
      }
    }
  }
  return result;
}

function findPath(unit, targetX, targetY, maxCost) {
  if (targetX < 0 || targetX >= WIDTH || targetY < 0 || targetY >= HEIGHT) return null;
  if (getUnitAt(targetX, targetY) || !canUnitEnterTerrain(unit, game.tiles[targetY][targetX].type)) return null;

  const frontier = [{ x: unit.x, y: unit.y, cost: 0 }];
  const best = new Map([[`${unit.x},${unit.y}`, 0]]);
  const previous = new Map();
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const current = frontier.shift();
    if (current.x === targetX && current.y === targetY) {
      const path = [];
      let key = `${targetX},${targetY}`;
      while (key !== `${unit.x},${unit.y}`) {
        const [x, y] = key.split(",").map(Number);
        path.push({ x, y });
        key = previous.get(key);
      }
      return { path: path.reverse(), cost: current.cost };
    }

    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
      if (getUnitAt(x, y) || !canUnitEnterTerrain(unit, game.tiles[y][x].type)) continue;
      const cost = current.cost + getUnitTerrainCost(unit, game.tiles[y][x].type);
      const key = `${x},${y}`;
      if (cost > maxCost || (best.has(key) && best.get(key) <= cost)) continue;
      best.set(key, cost);
      previous.set(key, `${current.x},${current.y}`);
      frontier.push({ x, y, cost });
    }
  }
  return null;
}

function canUnitEnterTerrain(unit, terrainType) {
  return TERRAIN[terrainType].passable || (terrainType === "water" && game.unitTypes.get(unit.typeId)?.canSail);
}

function getUnitTerrainCost(unit, terrainType) {
  return terrainType === "water" ? 2 : TERRAIN[terrainType].cost;
}

function renderSelection() {
  const unit = getSelectedUnit();
  const tile = game.selectedTile ? game.tiles[game.selectedTile.y][game.selectedTile.x] : null;
  const tileVisible = game.selectedTile && game.visibleTiles.has(`${game.selectedTile.x},${game.selectedTile.y}`);
  const city = tile && tileVisible ? getCityAt(tile.x, tile.y) : null;
  const foreignUnit = tile && tileVisible
    ? game.units.find((item) => item.x === tile.x && item.y === tile.y &&
      getUnitFaction(item) !== game.civilization.id)
    : null;
  actionsElement.replaceChildren();

  if (unit) {
    const type = game.unitTypes.get(unit.typeId);
    selectionElement.innerHTML = `
      <span class="selection-icon" aria-hidden="true">${renderUnitIcon(type)}</span>
      <div class="detail-kicker">${escapeHtml(type.role)} · ${escapeHtml(game.civilization.adjective)}</div>
      <h2>${escapeHtml(type.name)}</h2>
      <p>${escapeHtml(type.description)}</p>
      ${renderTileContents(game.tiles[unit.y][unit.x])}
      <div class="unit-health-summary" aria-label="Salud de la unidad">
        <span>Salud ${unit.health}/${unit.maxHealth} · ${Math.round((unit.health / unit.maxHealth) * 100)} %</span>
        <span class="unit-health-track" role="meter" aria-valuenow="${unit.health}" aria-valuemin="0" aria-valuemax="${unit.maxHealth}" aria-label="Salud">
          <span class="unit-health-fill ${unit.health / unit.maxHealth <= .3 ? "health-critical" : unit.health / unit.maxHealth <= .65 ? "health-wounded" : ""}" style="width:${Math.max(0, Math.min(100, (unit.health / unit.maxHealth) * 100))}%"></span>
        </span>
      </div>
      <div class="unit-meta"><span>⚑ Fuerza ${getUnitStrength(type, getUnitFaction(unit))}</span><span>❤ ${unit.health}/${unit.maxHealth}</span><span>↗ Movimiento ${unit.movesLeft}/${type.movement}</span>${type.range > 1 ? `<span>◎ Alcance ${type.range}</span>` : ""}${type.canSail ? "<span>⛵ Navega por el mar</span>" : ""}</div>
      ${type.canBuild ? `<p class="unit-stance-status">Construcciones restantes: ${unit.buildCharges}/3</p>` : ""}
      ${type.canTrade ? renderMerchantRouteSummary(unit) : ""}
      ${getUnitStrength(type, getUnitFaction(unit)) > 0
        ? `<p class="unit-stance-status">Nivel ${unit.level ?? 1} · ${Number(unit.combatCount ?? 0) % UNIT_COMBATS_PER_LEVEL}/${UNIT_COMBATS_PER_LEVEL} combates para el siguiente nivel.</p>`
        : ""}
      ${unit.pendingUpgrades > 0
        ? `<p class="production-hint production-hint-info">Tiene ${unit.pendingUpgrades} mejora${unit.pendingUpgrades === 1 ? "" : "s"} pendiente${unit.pendingUpgrades === 1 ? "" : "s"}: elige una opción por nivel.</p>`
        : ""}
      ${getUnitStrength(type, getUnitFaction(unit)) > 0
        ? `<p class="unit-stance-status">Estado: ${unit.stance === "fortified" ? "En defensa · recibe un 35 % menos de daño" : unit.stance === "resting" ? "Descansando · recupera 6 de salud al finalizar el turno" : "Activa"}</p>`
        : ""}`;

    if (type.canTrade && getUnitFaction(unit) === game.civilization.id) {
      renderMerchantActions(unit);
    }
    if (unit.pendingUpgrades > 0 && getUnitStrength(type, getUnitFaction(unit)) > 0) {
      for (const upgrade of UNIT_LEVEL_UPGRADES) {
        addAction(`${upgrade.name} · ${upgrade.description}`, () => chooseUnitUpgrade(unit.id, upgrade.id), false, true);
      }
    }
    for (const target of getCombatTargets(unit)) {
      addAction(`Atacar ${target.name} · a ${target.distance} casillas · ${target.health}/${target.maxHealth} ❤`, () => {
        performAttack(unit.id, target.id, target.kind);
      }, unit.movesLeft < 1);
    }
    if (getUnitStrength(type, getUnitFaction(unit)) > 0 && unit.stance !== "resting") {
      addAction("Descansar · recuperar salud", () => setUnitStance(unit.id, "resting"), false, true);
    }
    if (getUnitStrength(type, getUnitFaction(unit)) > 0 && unit.stance !== "fortified") {
      addAction("Poner en defensa · reducir daño", () => setUnitStance(unit.id, "fortified"), false, true);
    }
    if (getUnitStrength(type, getUnitFaction(unit)) > 0 && unit.stance !== "active") {
      addAction("Reanudar servicio", () => setUnitStance(unit.id, "active"), false, true);
    }
    if (type.canFound) {
      const cityAtTile = getCityAt(unit.x, unit.y);
      const inCityInfluence = isTileInCityInfluence(unit.x, unit.y);
      const canFound = unit.movesLeft > 0 &&
        TERRAIN[game.tiles[unit.y][unit.x].type].passable && !inCityInfluence;
      const actionLabel = canFound
        ? "Fundar ciudad"
        : inCityInfluence && !cityAtTile
          ? "Dentro del área de influencia"
          : "No se puede fundar aquí";
      addAction(actionLabel, foundCity, !canFound);
    }
    if (type.canBuild) {
      for (const [id, improvement] of Object.entries(TILE_IMPROVEMENTS)) {
        if (!improvement.terrains.includes(game.tiles[unit.y][unit.x].type)) continue;
        const valid = canBuildImprovement(unit, id);
        addAction(valid ? `Construir ${improvement.name} · +1 ${getMaterialName(improvement.resource)}/turno · ${unit.buildCharges}/3` :
          `${improvement.name} no disponible`, () => buildImprovement(unit, id), !valid);
      }
      const tileCity = game.cities.find((item) =>
        item.territoryId === game.tiles[unit.y][unit.x].territoryCityId
      );
      for (const building of getUnlockedTerritoryBuildings()) {
        const valid = canBuildTerritoryBuilding(unit, building, tileCity);
        addAction(valid
          ? `Construir ${building.name} · forma ${game.unitTypes.get(building.unitId)?.name ?? "unidad"}`
          : `${building.name} no disponible aquí`,
        () => buildTerritoryBuilding(unit, building.id), !valid);
        if (!valid && tileCity) {
          addActionHint(`${building.name} requiere una casilla libre del territorio de ${tileCity.name}; cada ciudad solo admite una.`, "warning");
        }
      }
    }
    addAction("Deseleccionar unidad", () => {
      game.selectedUnitId = null;
      render();
    }, false, true);
    return;
  }

  if (foreignUnit) {
    const type = game.unitTypes.get(foreignUnit.typeId);
    const faction = getUnitFaction(foreignUnit);
    const owner = game.civilizations.find((civilization) => civilization.id === faction);
    const isIndependent = isIndependentFaction(getUnitFaction(foreignUnit));
    const factionName = faction === "elves" ? "PUEBLO ÉLFICO" : faction === "dwarves" ? "PUEBLO ENANO" :
      faction === "dragons" ? "DRAGONES ANCESTRALES" :
        faction === "beasts" ? "BESTIA DEL ABISMO" : "PUEBLO BÁRBARO";
    selectionElement.innerHTML = `
      <span class="selection-icon" aria-hidden="true">${renderUnitIcon(type)}</span>
      <div class="detail-kicker">${isIndependent ? factionName : `UNIDAD EXTRANJERA · ${escapeHtml(owner?.adjective ?? "")}`}</div>
      <h2>${escapeHtml(type.name)}</h2>
      <p>${isIndependent ? faction === "dragons"
        ? "El Dragón ancestral custodia una guarida apartada con fuerza y resistencia descomunales. La nación que lo derrote recibirá un dragón leal."
        : faction === "beasts"
          ? "Emergió de la zona central del Abismo. Es hostil a todas las naciones y ataca ciudades y unidades cercanas."
          : "Un defensor protege este campamento. Derrota a sus guerreros para obtener una recompensa." :
        `Una unidad de ${escapeHtml(owner?.name ?? "otra civilización")} se encuentra en este territorio.`}</p>
      ${renderTileContents(tile)}
      <div class="unit-meta"><span>⚑ Fuerza ${getUnitStrength(type, getUnitFaction(foreignUnit))}</span><span>❤ ${foreignUnit.health}/${foreignUnit.maxHealth}</span>${type.range > 1 ? `<span>◎ Alcance ${type.range}</span>` : ""}</div>`;
    const opponent = game.opponents.find((item) => item.civilization.id === faction);
    if (opponent?.met) addAction("Abrir diplomacia", openDiplomacyDialog);
    return;
  }

  if (city) {
    const owner = game.civilizations.find((civilization) => civilization.id === city.ownerId) ?? game.civilization;
    const belongsToPlayer = city.ownerId === game.civilization.id;
    const territoryCount = getCityTerritory(city).length;
    const influenceStatus = territoryCount >= CITY_MAX_TERRITORY_TILES
      ? "límite alcanzado"
      : `próxima expansión en ${5 - (Number(city.influenceTurns) || 0)} turnos`;
    selectionElement.innerHTML = `
      <span class="selection-icon" aria-hidden="true">⌂</span>
      <div class="detail-kicker">${belongsToPlayer ? "TU CIUDAD" : `CIUDAD EXTRANJERA · ${escapeHtml(owner.adjective)}`}</div>
      <h2>${escapeHtml(city.name)}</h2>
      ${city.isCapital ? `<p class="capital-status">★ Capital de ${escapeHtml(game.civilizations.find((civilization) =>
        civilization.id === (city.originalOwnerId ?? city.ownerId))?.name ?? owner.name)}</p>` : ""}
      <p>Una ciudad de ${escapeHtml(owner.name)} asentada en ${escapeHtml(TERRAIN[tile.type].name.toLowerCase())}.</p>
      ${renderTileContents(tile)}
      <p class="terrain-description">Territorio: ${territoryCount}/${CITY_MAX_TERRITORY_TILES} casillas · ${influenceStatus}.</p>
      ${belongsToPlayer ? `<p class="terrain-description">Las casillas libres marcadas con borde discontinuo se pueden comprar por ${CITY_TILE_PURCHASE_COST} de oro.</p>` : ""}
      <div class="unit-meta"><span>✿ Población ${city.population}</span><span>⌂ Crecimiento ${city.growth}/10</span>
        <span>❤ ${city.health}/${city.maxHealth}</span>
        ${city.buildings?.includes("city-walls") ? "<span>⛨ Murallas · +35 % resistencia</span>" : ""}</div>`;
    if (belongsToPlayer) renderCityProjects(city);
    else {
      const opponent = game.opponents.find((item) => item.civilization.id === city.ownerId);
      if (opponent?.met) addAction("Abrir diplomacia", openDiplomacyDialog);
    }
    addAction("Deseleccionar ciudad", () => {
      game.selectedUnitId = null;
      game.selectedTile = null;
      render();
    }, false, true);
    return;
  }

  if (tile) {
    if (!game.explored[tile.y][tile.x]) {
      selectionElement.innerHTML = `
        <div class="empty-selection-icon" aria-hidden="true">⌖</div>
        <h2>Territorio inexplorado</h2>
        <p>Envía una unidad para descubrir qué hay más allá de la niebla.</p>`;
      return;
    }
    const terrain = TERRAIN[tile.type];
    const territoryOwner = getTerritoryOwner(tile.x, tile.y);
    const owner = game.civilizations.find((civilization) => civilization.id === territoryOwner);
    selectionElement.innerHTML = `
      <span class="selection-icon terrain-code" aria-hidden="true">${escapeHtml(terrain.short)}</span>
      <div class="detail-kicker">${owner ? `TERRITORIO DE ${escapeHtml(owner.name)}` : "TERRITORIO SIN RECLAMAR"}</div>
      <h2>${escapeHtml(terrain.name)}</h2>
      ${renderTileContents(tile)}`;
    if (!territoryOwner) renderCityTilePurchaseActions(tile);
    return;
  }

  selectionElement.innerHTML = `
    <div class="empty-selection-icon" aria-hidden="true">⌖</div>
    <h2>Sin selección</h2>
    <p>Selecciona una unidad o una casilla para consultar sus detalles.</p>`;
}

function setUnitStance(unitId, stance) {
  const unit = game.units.find((item) => item.id === unitId);
  if (!unit || getUnitFaction(unit) !== game.civilization.id ||
      !["active", "resting", "fortified"].includes(stance)) return;
  unit.stance = stance;
  unit.movesLeft = 0;
  const messages = {
    active: `${game.unitTypes.get(unit.typeId).name} vuelve al servicio; recuperará movimiento al próximo turno.`,
    resting: `${game.unitTypes.get(unit.typeId).name} descansa y recuperará salud al finalizar cada turno.`,
    fortified: `${game.unitTypes.get(unit.typeId).name} adopta una posición defensiva y recibirá menos daño.`
  };
  addEvent(messages[stance]);
  render();
  saveGame();
}
