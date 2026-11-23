const TRADE_ROUTE_YIELDS = [
  { id: "gold", name: "Oro" },
  { id: "production", name: "Producción" },
  { id: "food", name: "Alimentos" }
];
const FOOD_DEFICIT_GRACE_TURNS = 1;
const FOOD_STARVATION_DAMAGE = 2;
const ABYSS_BEAST_FIRST_SPAWN_TURN = 8;
const ABYSS_BEAST_SPAWN_INTERVAL = 4;
const CITY_MAX_INFLUENCE_RADIUS = 4;
const CITY_MAX_TERRITORY_TILES = (CITY_MAX_INFLUENCE_RADIUS * 2 + 1) ** 2;
const CITY_TILE_PURCHASE_COST = 10;
const UNIT_PURCHASE_PRICE_MULTIPLIER = 0.75;

function renderCityProjects(city) {
  if (game.victory) {
    addAction("La partida ha terminado", () => {}, true);
    return;
  }
  city.projectQueue ??= [];
  const project = city.project;
  const projectQueue = city.projectQueue ?? [];
  const projectCatalog = project ? getProjectDefinition(project) : null;
  if (projectCatalog) {
    const progress = Number(project.progress) || 0;
    const percentage = Math.min(100, Math.round((progress / projectCatalog.cost) * 100));
    const productionRate = getCityProductionRate(city);
    const remainingTurns = productionRate > 0
      ? Math.ceil((projectCatalog.cost - progress) / productionRate)
      : null;
    addAction(`Produciendo: ${projectCatalog.name} · ${Math.floor(progress)}/${projectCatalog.cost} ⚒`, () => {
      showMessage(`Producción de ${projectCatalog.name}: ${Math.floor(progress)} de ${projectCatalog.cost}${remainingTurns === null ? "" : ` · ~${remainingTurns} turnos restantes`}.`);
    }, false, true);
    addActionHint(remainingTurns === null
      ? "No se puede calcular el tiempo restante de este proyecto."
      : `Avance estimado: ${productionRate} producción/turno · ~${remainingTurns} turnos restantes.`, "info");
    const progressBar = document.createElement("div");
    progressBar.className = "city-progress";
    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuenow", String(percentage));
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");
    progressBar.innerHTML = `<span style="width:${percentage}%"></span>`;
    actionsElement.append(progressBar);
    addAction("Cancelar producción", () => {
      releaseProjectMaterials(city.project);
      city.project = city.projectQueue.shift() ?? null;
      render();
      saveGame();
    }, false, true);
  } else {
    addAction("Sin producción activa", () => {}, true, true);
  }

  const options = getAvailableCityProjects(city);
  if (game.researched.includes("navigation") && !cityHasNavalAccess(city)) {
    addActionHint("Para construir o comprar una Galera, esta ciudad necesita estar junto al agua o tener un puerto.", "locked");
  }
  const categories = [
    { id: "combat", title: "Unidades de combate", options: [] },
    { id: "creation", title: "Creación y apoyo", options: [] },
    { id: "structures", title: "Estructuras", options: [] }
  ];
  for (const option of options) {
    const categoryId = option.type === "building" ? "structures" :
      option.canFound || option.canBuild || option.canTrade ? "creation" : "combat";
    categories.find((category) => category.id === categoryId).options.push(option);
  }
  const productionOptions = categories.filter((category) => category.options.length);
  if (productionOptions.length) {
    const productionSection = document.createElement("details");
    productionSection.className = "production-mode";
    productionSection.open = true;
    productionSection.innerHTML = `<summary class="production-mode-title">Producir por turnos<span>${options.length}</span></summary>`;
    for (const category of productionOptions) {
      appendProductionCategory(productionSection, city, category, project, "produce");
    }
    actionsElement.append(productionSection);
  }

  if (projectQueue.length) {
    const queueList = document.createElement("ol");
    queueList.className = "city-production-queue";
    queueList.setAttribute("aria-label", "Cola de producción");
    for (const [index, queuedProject] of projectQueue.entries()) {
      const definition = getProjectDefinition(queuedProject);
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${index + 1}. ${definition?.name ?? queuedProject.id}`;
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "queue-remove-button";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", `Quitar ${definition?.name ?? queuedProject.id} de la cola`);
      removeButton.title = "Quitar de la cola";
      removeButton.addEventListener("click", () => {
        const [removed] = city.projectQueue.splice(index, 1);
        releaseProjectMaterials(removed);
        render();
        saveGame();
      });
      item.append(name, removeButton);
      queueList.append(item);
    }
    actionsElement.append(queueList);
  }

  const purchaseCategories = categories.filter((category) => category.id !== "structures")
    .map((category) => ({ ...category, options: category.options.filter((option) => option.type === "unit") }))
    .filter((category) => category.options.length);
  if (purchaseCategories.length) {
    const purchaseSection = document.createElement("details");
    purchaseSection.className = "production-mode";
    purchaseSection.innerHTML = `<summary class="production-mode-title">Comprar con oro<span>${purchaseCategories.reduce((total, category) => total + category.options.length, 0)}</span></summary>`;
    for (const category of purchaseCategories) {
      appendProductionCategory(purchaseSection, city, category, project, "buy");
    }
    actionsElement.append(purchaseSection);
  }

  const cityStructures = game.tiles.flat()
    .filter((tile) => tile.structure?.territoryCityId === city.territoryId)
    .map((tile) => game.buildings.find((building) => building.id === tile.structure.buildingId))
    .filter(Boolean);
  if (cityStructures.length) {
    const list = document.createElement("p");
    list.className = "built-improvements";
    list.textContent = `Construcciones territoriales: ${cityStructures.map((building) => building.name).join(", ")}`;
    actionsElement.append(list);
  }

  const resources = document.createElement("p");
  resources.className = "built-improvements";
  resources.textContent = `Materiales: ${formatMaterials(game.materials)}`;
  actionsElement.append(resources);

  if (city.buildings?.length) {
    const list = document.createElement("p");
    list.className = "built-improvements";
    list.textContent = `Mejoras: ${city.buildings.map((id) =>
      game.buildings.find((building) => building.id === id)?.name ?? id
    ).join(", ")}`;
    actionsElement.append(list);
  }
}

function appendProductionCategory(parent, city, category, project, mode) {
  const section = document.createElement("details");
  section.className = "production-category";
  const summary = document.createElement("summary");
  summary.className = "production-category-title";
  summary.innerHTML = `${category.title}<span>${category.options.length}</span>`;
  section.append(summary);
  const content = document.createElement("div");
  content.className = "production-category-options";
  section.append(content);
  parent.append(section);
  for (const option of category.options) {
    renderCityProjectOption(city, option, project, content, mode);
  }
}

function renderCityProjectOption(city, option, project, container, mode) {
  const resourceLabel = formatMaterialRequirements(option);
  const missingMaterials = getMissingMaterials(option);
  if (mode === "produce") {
    const projectQueue = city.projectQueue ?? [];
    const duplicateBuilding = option.type === "building" &&
      [project, ...projectQueue].some((item) => item?.type === "building" && item.id === option.id);
    const productionBlocked = missingMaterials.length > 0 || duplicateBuilding;
    const actionLabel = project ? "Añadir a la cola" : "Producir";
    addAction(`${actionLabel} ${option.name} · ${option.cost} ⚒${resourceLabel ? ` · ${resourceLabel}` : ""}`, () => {
      if (option.type === "unit" && !reserveUnitMaterials(option)) {
        showMessage(`Faltan ${formatMissingMaterials(option)} para producir ${option.name}.`);
        return;
      }
      const nextProject = {
        type: option.type,
        id: option.id,
        progress: 0,
        ...(option.type === "unit" ? { reservedMaterials: getUnitMaterialRequirements(option) } : {})
      };
      if (project) {
        city.projectQueue ??= [];
        city.projectQueue.push(nextProject);
      } else {
        city.project = nextProject;
      }
      if (city.ownerId === game.civilization.id) game.tutorialProductionAssigned = true;
      render();
      saveGame();
      showMessage(project
        ? `${option.name} se añade a la cola de ${city.name}.`
        : `${city.name} comienza a producir ${option.name}.`);
    }, productionBlocked, false, container);
    if (duplicateBuilding) {
      addActionHint(`${option.name} ya está en producción o en la cola.`, "warning", container);
    } else if (missingMaterials.length) {
      addActionHint(`Faltan ${formatMissingMaterials(option)}.`, "warning", container);
    } else if (!project) {
      const productionRate = getCityProductionRate(city);
      const turns = Math.ceil(option.cost / productionRate);
      const unitDetails = option.type === "unit"
        ? `Fuerza ${getUnitStrength(option, game.civilization.id)} · movimiento ${option.movement}${option.range > 1 ? ` · alcance ${option.range}` : ""}. Compra inmediata: ${option.purchaseCost} oro.`
        : option.description;
      addActionHint(`${unitDetails} Tiempo de producción estimado: ~${turns} turnos.`, "info", container);
    }
    return;
  }

  addAction(`Comprar ${option.name} · ${option.purchaseCost} ◉${resourceLabel ? ` · ${resourceLabel}` : ""}`, () => {
    purchaseUnit(city, option.id);
  }, game.gold < option.purchaseCost || missingMaterials.length > 0 || !findUnitSpawnTile(city), false, container);
  const purchaseBlockers = [];
  if (game.gold < option.purchaseCost) purchaseBlockers.push(`Faltan ${option.purchaseCost - game.gold} de oro.`);
  if (missingMaterials.length) purchaseBlockers.push(`Faltan ${formatMissingMaterials(option)}.`);
  if (!findUnitSpawnTile(city)) purchaseBlockers.push("No hay una casilla libre junto a la ciudad.");
  if (purchaseBlockers.length) addActionHint(purchaseBlockers.join(" "), "warning", container);
}

function renderMerchantRouteSummary(unit) {
  const route = unit.tradeRoute;
  if (!route) return `<p class="unit-stance-status">Sin ruta asignada. Puedes establecer un enlace comercial permanente entre ciudades.</p>`;
  const origin = game.cities.find((city) => city.territoryId === route.originCityId);
  const destination = game.cities.find((city) => city.territoryId === route.destinationCityId);
  const yieldOption = TRADE_ROUTE_YIELDS.find((item) => item.id === route.yieldType);
  if (!origin || !destination || !yieldOption) {
    return `<p class="production-hint production-hint-warning">La ruta guardada ya no es válida. Asigna otra ciudad de destino.</p>`;
  }
  const distance = Math.max(1, Math.floor(Number(route.distance) || getTradeRouteDistance(unit, origin, destination)));
  const yieldAmount = getTradeRouteYield(distance, route.yieldType);
  return `<div class="merchant-route-summary">
    <span class="eyebrow">RUTA COMERCIAL PERMANENTE</span>
    <strong>${escapeHtml(origin.name)} <span aria-hidden="true">⇄</span> ${escapeHtml(destination.name)}</strong>
    <span>${escapeHtml(yieldOption.name)} · ${distance} casillas · ${formatTradeRouteYield(route.yieldType, yieldAmount)}</span>
    <span class="merchant-route-note">Movimiento automático al finalizar cada turno. Disuelve la ruta para recuperar el control manual.</span>
  </div>`;
}

function renderMerchantActions(unit) {
  if (!game.researched.includes("commerce")) {
    addActionHint("Investiga Comercio para establecer rutas comerciales.", "locked");
    return;
  }
  const origins = getPlayerCities();
  if (!origins.length) {
    addActionHint("Funda una ciudad para iniciar una ruta comercial.", "warning");
    return;
  }
  const currentOrigin = origins.find((city) => city.territoryId === unit.tradeRoute?.originCityId) ?? origins[0];
  const controls = document.createElement("section");
  controls.className = "merchant-route-controls";
  controls.innerHTML = `
    <span class="eyebrow">ESTABLECER O CAMBIAR RUTA</span>
    <label>Ciudad de origen<select class="merchant-origin">
      ${origins.map((city) => `<option value="${escapeHtml(city.territoryId)}" ${city.territoryId === currentOrigin.territoryId ? "selected" : ""}>${escapeHtml(city.name)}</option>`).join("")}
    </select></label>
    <label>Ciudad de destino<select class="merchant-destination"></select></label>`;
  const originSelect = controls.querySelector(".merchant-origin");
  const destinationSelect = controls.querySelector(".merchant-destination");
  const preview = document.createElement("div");
  preview.className = "merchant-route-preview";
  preview.setAttribute("aria-live", "polite");
  controls.append(preview);
  actionsElement.append(controls);
  const routeButtons = new Map();
  for (const yieldOption of TRADE_ROUTE_YIELDS) {
    const button = addAction(`Asignar ruta · ${yieldOption.name}`, () => {
      establishTradeRoute(unit.id, originSelect.value, destinationSelect.value, yieldOption.id);
    }, true, true);
    routeButtons.set(yieldOption.id, button);
  }

  const getDestinations = (originCityId) => game.cities.filter((city) => city.territoryId !== originCityId &&
    (city.ownerId === game.civilization.id ||
      (game.opponents.some((opponent) => opponent.civilization.id === city.ownerId && opponent.met) &&
       game.explored[city.y]?.[city.x])));
  const updatePreview = () => {
    const origin = origins.find((city) => city.territoryId === originSelect.value);
    const destination = game.cities.find((city) => city.territoryId === destinationSelect.value);
    const hasDestination = Boolean(origin && destination);
    if (!hasDestination) {
      preview.textContent = "No hay otras ciudades conocidas con las que comerciar.";
      for (const button of routeButtons.values()) button.disabled = true;
      return;
    }

    const distance = getTradeRouteDistance(unit, origin, destination);
    const heading = document.createElement("strong");
    heading.textContent = `${origin.name} → ${destination.name}`;
    const distanceLabel = document.createElement("span");
    distanceLabel.textContent = `Distancia: ${distance} casillas`;
    const earningsLabel = document.createElement("span");
    earningsLabel.textContent = "Ganancia por turno";
    const earnings = document.createElement("ul");
    for (const yieldOption of TRADE_ROUTE_YIELDS) {
      const amount = getTradeRouteYield(distance, yieldOption.id);
      const item = document.createElement("li");
      item.textContent = `${yieldOption.name}: ${formatTradeRouteYield(yieldOption.id, amount)}`;
      earnings.append(item);
      const button = routeButtons.get(yieldOption.id);
      button.textContent = `Asignar ${yieldOption.name} · ${formatTradeRouteYield(yieldOption.id, amount)}`;
    }
    const opponent = game.opponents.find((item) => item.civilization.id === destination.ownerId);
    const atWar = Boolean(opponent?.atWar);
    for (const button of routeButtons.values()) button.disabled = atWar;
    preview.replaceChildren(heading, distanceLabel, earningsLabel, earnings);
    if (atWar) {
      const warning = document.createElement("span");
      warning.className = "production-hint-warning";
      warning.textContent = "No se puede comerciar mientras haya guerra con el destino.";
      preview.append(warning);
    }
  };
  const updateDestinations = (preferredDestinationId = null) => {
    const availableDestinations = getDestinations(originSelect.value);
    const previousDestinationId = preferredDestinationId ?? destinationSelect.value;
    destinationSelect.replaceChildren();
    for (const city of availableDestinations) {
      const option = document.createElement("option");
      option.value = city.territoryId;
      option.textContent = `${city.name} · ${game.civilizations.find((item) => item.id === city.ownerId)?.name ?? "tu civilización"}`;
      destinationSelect.append(option);
    }
    destinationSelect.disabled = availableDestinations.length === 0;
    if (availableDestinations.some((city) => city.territoryId === previousDestinationId)) {
      destinationSelect.value = previousDestinationId;
    }
    updatePreview();
  };
  originSelect.addEventListener("change", () => updateDestinations());
  destinationSelect.addEventListener("change", updatePreview);
  updateDestinations(unit.tradeRoute?.destinationCityId);
  if (!destinationSelect.options.length) {
    addActionHint("No hay otras ciudades conocidas con las que comerciar.", "warning");
  }
  if (unit.tradeRoute) {
    addAction("Disolver ruta comercial", () => {
      delete unit.tradeRoute;
      addEvent(`${game.unitTypes.get(unit.typeId).name} interrumpe su ruta comercial.`);
      render();
      saveGame();
    }, false, true);
  }
}

function establishTradeRoute(unitId, originCityId, destinationCityId, yieldType) {
  const unit = game.units.find((item) => item.id === unitId);
  const origin = game.cities.find((city) => city.territoryId === originCityId);
  const destination = game.cities.find((city) => city.territoryId === destinationCityId);
  const yieldOption = TRADE_ROUTE_YIELDS.find((item) => item.id === yieldType);
  if (!unit || !game.unitTypes.get(unit.typeId)?.canTrade || !game.researched.includes("commerce") ||
      !origin || origin.ownerId !== game.civilization.id || !destination || origin === destination || !yieldOption) {
    showMessage("No se puede establecer esa ruta comercial.");
    return;
  }
  const opponent = game.opponents.find((item) => item.civilization.id === destination.ownerId);
  if (opponent?.atWar) {
    showMessage("No se puede comerciar con una civilización en guerra.");
    return;
  }
  if (destination.ownerId !== game.civilization.id &&
      (!opponent?.met || !game.explored[destination.y]?.[destination.x])) {
    showMessage("Primero debes descubrir la ciudad y establecer contacto con su civilización.");
    return;
  }
  unit.tradeRoute = {
    originCityId: origin.territoryId,
    destinationCityId: destination.territoryId,
    yieldType: yieldOption.id,
    distance: getTradeRouteDistance(unit, origin, destination),
    nextCityId: origin.territoryId
  };
  addEvent(`${game.unitTypes.get(unit.typeId).name} abre una ruta entre ${origin.name} y ${destination.name}: ${yieldOption.name.toLowerCase()}.`);
  render();
  saveGame();
}

function getTradeRouteDistance(unit, origin, destination) {
  const start = `${origin.x},${origin.y}`;
  const target = `${destination.x},${destination.y}`;
  const queue = [{ x: origin.x, y: origin.y, distance: 0 }];
  const visited = new Set([start]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (`${current.x},${current.y}` === target) return current.distance;
    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT ||
          !canUnitEnterTerrain(unit, game.tiles[y][x].type)) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x, y, distance: current.distance + 1 });
    }
  }

  return Math.abs(destination.x - origin.x) + Math.abs(destination.y - origin.y);
}

function getTradeRouteYield(distance, yieldType) {
  const scaleYield = (baseYield) => Math.max(1, Math.floor(baseYield * distance / 10));
  if (yieldType === "gold") return { gold: scaleYield(2) };
  if (yieldType === "production") return { production: scaleYield(2) };
  if (yieldType === "food") {
    return { food: scaleYield(3), foodGrowth: Math.floor(distance / 10) };
  }
  return {};
}

function formatTradeRouteYield(yieldType, amount) {
  if (yieldType === "gold") return `+${amount.gold} oro/turno`;
  if (yieldType === "production") return `+${amount.production} producción/turno`;
  if (yieldType === "food") {
    return `+${amount.food} alimentos/turno${amount.foodGrowth ? ` · +${amount.foodGrowth} crecimiento/turno` : ""}`;
  }
  return "";
}

function getUnitMaterialRequirements(unit) {
  return { grain: unit.grain ?? 0, stone: unit.stone ?? 0 };
}

function getMissingMaterials(unit) {
  return Object.entries(getUnitMaterialRequirements(unit))
    .filter(([material, amount]) => (game.materials[material] ?? 0) < amount)
    .map(([material, amount]) => ({
      material,
      amount: amount - (game.materials[material] ?? 0)
    }));
}

function formatMissingMaterials(unit) {
  return getMissingMaterials(unit)
    .map(({ material, amount }) => `${amount} ${getMaterialName(material)}`)
    .join(" y ");
}

function addActionHint(message, kind, container = actionsElement) {
  const hint = document.createElement("p");
  hint.className = `production-hint production-hint-${kind}`;
  hint.textContent = message;
  container.append(hint);
}

function hasUnitMaterials(unit) {
  const required = getUnitMaterialRequirements(unit);
  return Object.entries(required).every(([material, amount]) => (game.materials[material] ?? 0) >= amount);
}

function reserveUnitMaterials(unit) {
  if (!hasUnitMaterials(unit)) return false;
  for (const [material, amount] of Object.entries(getUnitMaterialRequirements(unit))) {
    game.materials[material] -= amount;
  }
  return true;
}

function releaseProjectMaterials(project) {
  for (const [material, amount] of Object.entries(project?.reservedMaterials ?? {})) {
    if (material in game.materials) game.materials[material] += Number(amount) || 0;
  }
}

function formatMaterialRequirements(unit) {
  return Object.entries(getUnitMaterialRequirements(unit))
    .filter(([, amount]) => amount > 0)
    .map(([material, amount]) => `${amount} ${getMaterialName(material)}`)
    .join(" + ");
}

function formatMaterials(materials) {
  return `${materials.grain} grano · ${materials.stone} piedra`;
}

function getMaterialName(material) {
  return material === "grain" ? "grano" : "piedra";
}

function getMaterialProduction() {
  const production = { grain: 0, stone: 0 };
  for (const tile of game.tiles.flat()) {
    if (tile.improvement?.ownerId === game.civilization.id) {
      const improvement = TILE_IMPROVEMENTS[tile.improvement.id];
      if (improvement) production[improvement.resource] += improvement.amount;
    }
  }
  for (const city of getPlayerCities()) {
    for (const id of city.buildings ?? []) {
      const building = game.buildings.find((item) => item.id === id);
      if (building) {
        production.grain += building.grain;
        production.stone += building.stone;
      }
    }
  }
  return production;
}

function getCityProductionRate(city) {
  const tile = game.tiles[city.y]?.[city.x];
  if (!tile || !TERRAIN[tile.type]) return 0;
  const improvements = (city.buildings ?? [])
    .map((id) => game.buildings.find((building) => building.id === id))
    .filter(Boolean);
  return TERRAIN[tile.type].production + 1 +
    improvements.reduce((total, building) => total + building.production, 0) +
    getAdoptedCivicBonus("production") + getCityTradeBonuses(city).production;
}

function canBuildImprovement(unit, improvementId) {
  const improvement = TILE_IMPROVEMENTS[improvementId];
  const tile = game.tiles[unit.y]?.[unit.x];
  return Boolean(unit.movesLeft > 0 && unit.buildCharges > 0 && game.unitTypes.get(unit.typeId)?.canBuild && improvement &&
    tile && improvement.terrains.includes(tile.type) && !tile.improvement &&
    getTerritoryOwner(unit.x, unit.y) === game.civilization.id);
}

function buildImprovement(unit, improvementId) {
  if (game.victory) return;
  if (!canBuildImprovement(unit, improvementId)) {
    showMessage("El constructor necesita una casilla válida dentro del territorio de una ciudad.");
    return;
  }
  const improvement = TILE_IMPROVEMENTS[improvementId];
  game.tiles[unit.y][unit.x].improvement = { id: improvementId, ownerId: game.civilization.id };
  unit.movesLeft = 0;
  unit.buildCharges -= 1;
  addEvent(`${improvement.name} construido. Producirá ${improvement.amount} ${getMaterialName(improvement.resource)} por turno.`);
  if (unit.buildCharges === 0) {
    const type = game.unitTypes.get(unit.typeId);
    game.units = game.units.filter((item) => item.id !== unit.id);
    game.selectedUnitId = null;
    addEvent(`${type.name} ha agotado sus tres construcciones y se ha retirado.`);
  }
  render();
  saveGame();
}

function purchaseUnit(city, unitId) {
  if (game.victory) return;
  const unit = getAvailableCityProjects(city).find((item) => item.id === unitId && item.type === "unit");
  if (!unit ||
      game.gold < unit.purchaseCost || !hasUnitMaterials(unit)) {
    showMessage("Faltan oro o materiales para comprar esa unidad.");
    return;
  }
  const spawn = findUnitSpawnTile(city);
  if (!spawn) {
    showMessage("No hay una casilla libre junto a la ciudad para desplegar la unidad.");
    return;
  }
  for (const [material, amount] of Object.entries(getUnitMaterialRequirements(unit))) {
    game.materials[material] -= amount;
  }
  game.gold -= unit.purchaseCost;
  spawnUnit(unitId, spawn.x, spawn.y, game.civilization.id);
  addEvent(`${city.name} ha comprado ${unit.name} por ${unit.purchaseCost} de oro.`);
  render();
  saveGame();
}

function getProjectDefinition(project) {
  if (project.type === "unit") {
    const unit = game.unitTypes.get(project.id);
    return unit ? getPlayerUnitOption(unit) : null;
  }
  const building = game.buildings.find((item) => item.id === project.id);
  return building ? { ...building, type: "building" } : null;
}

function getAvailableCityProjects(city) {
  const unlockedBuildings = game.buildings.filter((building) =>
    !building.placement && game.researched.includes(building.technology) &&
      !city.buildings?.includes(building.id)
  ).map((building) => ({ ...building, type: "building" }));
  const unlockedUnits = getCivilizationTechnologies()
    .filter((technology) => game.researched.includes(technology.id))
    .flatMap((technology) => technology.unlocks
      .filter((unlock) => unlock.type === "unit")
      .map((unlock) => game.unitTypes.get(unlock.id)))
    .filter((unit) => unit && !(!game.civilization.canFoundSettlers && unit.canFound) &&
      (unit.faction === game.civilization.id || unit.faction === "generic" ||
        (game.civilization.id === "pagan-sun" && ["elves", "dwarves"].includes(unit.faction))))
    .map(getPlayerUnitOption);
  if (game.civilization.id === "pagan-sun") {
    for (const unitId of ["elf-scout", "dwarf-guardian"]) {
      const unit = game.unitTypes.get(unitId);
      if (unit) unlockedUnits.push(getPlayerUnitOption(unit));
    }
  }
  const constructors = [...game.unitTypes.values()]
    .filter((unit) => unit.faction === game.civilization.id && unit.canBuild)
    .map(getPlayerUnitOption);
  const startingUnits = (game.civilization.startingUnits ?? [])
    .map((unitId) => game.unitTypes.get(unitId))
    .filter((unit) => unit && (game.civilization.canFoundSettlers !== false || !unit.canFound))
    .map(getPlayerUnitOption);
  const availableUnits = (game.civilization.availableUnits ?? [])
    .map((unitId) => game.unitTypes.get(unitId))
    .filter((unit) => unit && (game.civilization.canFoundSettlers !== false || !unit.canFound))
    .map(getPlayerUnitOption);
  const uniqueUnits = [...new Map([...constructors, ...unlockedUnits, ...startingUnits, ...availableUnits]
    .map((unit) => [unit.id, unit])).values()];
  return [...unlockedBuildings, ...uniqueUnits.filter((unit) =>
    unit.id !== "galley" || cityHasNavalAccess(city)
  )];
}

function cityHasNavalAccess(city) {
  if (!city) return false;
  const portIds = new Set(game.buildings
    .filter((building) => building.id === "port" || /harbou?r/i.test(`${building.id} ${building.name}`) ||
      /\bpuert/i.test(building.name))
    .map((building) => building.id));
  if ((city.buildings ?? []).some((id) => portIds.has(id)) ||
      game.tiles.some((row) => row.some((tile) =>
        tile.structure?.territoryCityId === city.territoryId && portIds.has(tile.structure.buildingId)
      ))) return true;
  for (let y = Math.max(0, city.y - 1); y <= Math.min(HEIGHT - 1, city.y + 1); y += 1) {
    for (let x = Math.max(0, city.x - 1); x <= Math.min(WIDTH - 1, city.x + 1); x += 1) {
      if ((x !== city.x || y !== city.y) && game.tiles[y][x].type === "water") return true;
    }
  }
  return false;
}

function getCivilizationTechnologies(civilization = game.civilization) {
  return game.technologies.filter((technology) =>
    !technology.civilization || technology.civilization === civilization.id
  );
}

function getUnlockedTerritoryBuildings(civilization = game.civilization) {
  const allowedTechnologies = new Set(getCivilizationTechnologies(civilization)
    .filter((technology) => game.researched.includes(technology.id))
    .map((technology) => technology.id));
  return game.buildings.filter((building) =>
    building.placement === "territory" && allowedTechnologies.has(building.technology)
  );
}

function canBuildTerritoryBuilding(unit, building, city) {
  const tile = game.tiles[unit.y]?.[unit.x];
  if (!tile || !city || !getUnlockedTerritoryBuildings().some((item) => item.id === building.id)) return false;
  return unit.movesLeft > 0 && unit.buildCharges > 0 &&
    game.unitTypes.get(unit.typeId)?.canBuild &&
    getTerritoryOwner(unit.x, unit.y) === game.civilization.id &&
    tile.territoryCityId === city.territoryId &&
    !tile.improvement && !tile.structure &&
    !game.tiles.flat().some((areaTile) =>
      areaTile.structure?.territoryCityId === city.territoryId &&
      areaTile.structure.buildingId === building.id
    );
}

function buildTerritoryBuilding(unit, buildingId) {
  if (game.victory) return;
  const building = game.buildings.find((item) => item.id === buildingId);
  const tile = game.tiles[unit.y]?.[unit.x];
  const city = game.cities.find((item) => item.territoryId === tile?.territoryCityId);
  if (!building || !canBuildTerritoryBuilding(unit, building, city)) {
    showMessage("Esta construcción necesita ciencia desbloqueada y una casilla libre dentro de una ciudad propia.");
    return;
  }
  tile.structure = {
    buildingId,
    ownerId: game.civilization.id,
    territoryCityId: city.territoryId,
    nextSpawnTurn: game.turn + building.unitInterval
  };
  unit.movesLeft = 0;
  unit.buildCharges -= 1;
  addEvent(`${building.name} comienza a construirse en el territorio de ${city.name}.`);
  if (unit.buildCharges === 0) {
    game.units = game.units.filter((item) => item.id !== unit.id);
    game.selectedUnitId = null;
  }
  render();
  saveGame();
}

function getPlayerUnitOption(unit) {
  const abilities = game.civilization.abilities ?? {};
  return {
    ...unit,
    faction: game.civilization.id,
    cost: Math.max(1, Math.ceil(unit.cost * (abilities.unitProductionMultiplier ?? 1))),
    purchaseCost: Math.max(0, Math.ceil(unit.purchaseCost * UNIT_PURCHASE_PRICE_MULTIPLIER *
      (abilities.unitPurchaseMultiplier ?? 1))),
    type: "unit"
  };
}

function addAction(label, action, disabled = false, secondary = false, container = actionsElement) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-button${secondary ? " secondary" : ""}`;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", action);
  container.append(button);
  return button;
}

function getCombatTargets(unit) {
  const type = unit && game.unitTypes.get(unit.typeId);
  if (!unit || getUnitStrength(type, getUnitFaction(unit)) < 1) return [];
  const inRange = (target) => {
    const distance = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
    return distance > 0 && distance <= Math.max(1, type.range ?? 1);
  };
  const unitTargets = game.units.filter((target) => {
    if (target.id === unit.id || !inRange(target)) return false;
    const faction = getUnitFaction(target);
    if (isIndependentFaction(faction)) return true;
    return game.opponents.some((opponent) => opponent.civilization.id === faction && opponent.atWar);
  }).map((target) => ({
    id: target.id,
    kind: "unit",
    x: target.x,
    y: target.y,
    health: target.health,
    maxHealth: target.maxHealth,
    name: game.unitTypes.get(target.typeId).name
  }));
  const cityTargets = game.cities.filter((city) => city.ownerId !== game.civilization.id &&
    inRange(city) && game.opponents.some((opponent) =>
      opponent.civilization.id === city.ownerId && opponent.atWar
    )).map((city) => ({
      id: city.territoryId,
      kind: "city",
      x: city.x,
      y: city.y,
      health: city.health,
      maxHealth: city.maxHealth,
      name: city.name
    }));
  return [...unitTargets, ...cityTargets].map((target) => ({
    ...target,
    distance: Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y)
  }));
}

function performAttack(attackerId, targetId, targetKind) {
  if (game.victory) return;
  const attacker = game.units.find((unit) => unit.id === attackerId);
  const target = targetKind === "unit"
    ? game.units.find((unit) => unit.id === targetId)
    : targetKind === "city" ? game.cities.find((city) => city.territoryId === targetId) : null;
  const attackerFaction = attacker && getUnitFaction(attacker);
  const defenderFaction = targetKind === "unit" && target
    ? getUnitFaction(target)
    : target?.ownerId;
  const canAttack = isIndependentFaction(defenderFaction) ||
    game.opponents.some((opponent) => opponent.civilization.id === defenderFaction && opponent.atWar);
  const attackerType = attacker && game.unitTypes.get(attacker.typeId);
  const distance = attacker && target
    ? Math.abs(target.x - attacker.x) + Math.abs(target.y - attacker.y)
    : Infinity;
  if (!attacker || !target || attacker.movesLeft < 1 ||
      distance < 1 || distance > (attackerType.range ?? 1) ||
      getUnitStrength(attackerType, attackerFaction) < 1 || !canAttack ||
      attackerFaction !== game.civilization.id) return;

  attacker.stance = "active";
  if (targetKind === "unit") resolveUnitCombat(attacker, target, distance);
  else resolveCityCombat(attacker, target);
  attacker.movesLeft = 0;
  checkVictoryConditions();
  render();
  saveGame();
}

function moveUnitTowardCombatTarget(attacker, target, targetKind) {
  const attackerType = game.unitTypes.get(attacker.typeId);
  const attackRange = Math.max(1, attackerType.range ?? 1);
  const distanceToTarget = Math.abs(target.x - attacker.x) + Math.abs(target.y - attacker.y);
  if (distanceToTarget <= attackRange) {
    performAttack(attacker.id, targetKind === "city" ? target.territoryId : target.id, targetKind);
    return;
  }

  const destinations = [];
  for (let y = Math.max(0, target.y - attackRange); y <= Math.min(HEIGHT - 1, target.y + attackRange); y += 1) {
    for (let x = Math.max(0, target.x - attackRange); x <= Math.min(WIDTH - 1, target.x + attackRange); x += 1) {
      const distance = Math.abs(target.x - x) + Math.abs(target.y - y);
      if (distance < 1 || distance > attackRange || distance >= distanceToTarget) continue;
      const path = findPath(attacker, x, y, attacker.movesLeft);
      if (path) destinations.push({ x, y, distance, path });
    }
  }

  destinations.sort((first, second) =>
    first.distance - second.distance || first.path.cost - second.path.cost
  );
  const destination = destinations[0];
  if (!destination) {
    showMessage("No hay una ruta disponible para acercarse al objetivo este turno.");
    return;
  }

  attacker.stance = "active";
  attacker.x = destination.x;
  attacker.y = destination.y;
  attacker.movesLeft -= destination.path.cost;
  game.selectedTile = { x: attacker.x, y: attacker.y };
  addEvent(`${attackerType.name} avanza hacia ${target.name ?? game.unitTypes.get(target.typeId)?.name ?? "el objetivo"}.`);
  render();
  saveGame();
}

function resolveUnitCombat(attacker, defender) {
  const attackerType = game.unitTypes.get(attacker.typeId);
  const defenderType = game.unitTypes.get(defender.typeId);
  recordUnitCombat(attacker, attackerType);
  recordUnitCombat(defender, defenderType);
  const attackerStrength = getUnitStrength(attackerType, getUnitFaction(attacker));
  const defenderStrength = getUnitStrength(defenderType, getUnitFaction(defender));
  const rawDamage = calculateUnitDamage(attackerStrength, defenderStrength, attacker.upgrades?.attack ?? 0);
  const damage = applyStanceDefense(defender, rawDamage);
  defender.health = Math.max(0, defender.health - damage);
  showCombatDamageEffect(defender, damage);
  addEvent(`${attackerType.name} inflige ${damage} de daño a ${defenderType.name}.`);
  if (defender.health <= 0) {
    removeDefeatedUnit(defender, defenderType, getUnitFaction(attacker));
    return;
  }

  if (attackerType.range > 1) return;
  const counterDamage = applyStanceDefense(attacker,
    calculateUnitDamage(defenderStrength, attackerStrength, defender.upgrades?.attack ?? 0));
  attacker.health = Math.max(0, attacker.health - counterDamage);
  showCombatDamageEffect(attacker, counterDamage);
  addEvent(`${defenderType.name} contraataca e inflige ${counterDamage} de daño.`);
  if (attacker.health <= 0) {
    removeDefeatedUnit(attacker, attackerType, getUnitFaction(defender));
  }
}

function calculateUnitDamage(attackerStrength, defenderStrength, attackUpgrade = 0) {
  const totalStrength = attackerStrength + defenderStrength;
  const strengthRatio = totalStrength > 0 ? attackerStrength / totalStrength : 0;
  const baseDamage = Math.round(24 * strengthRatio);
  const variation = Math.floor(Math.random() * 5) - 2;
  return Math.max(3, Math.min(30, baseDamage + attackUpgrade * 2 + variation));
}

function applyStanceDefense(unit, damage) {
  const stanceMultiplier = unit.stance === "fortified" ? 0.65 : 1;
  const upgradeMultiplier = Math.max(0.4, 1 - (unit.upgrades?.defense ?? 0) * 0.1);
  return Math.max(1, Math.ceil(damage * stanceMultiplier * upgradeMultiplier));
}

function recordUnitCombat(unit, type) {
  if (!unit || getUnitStrength(type, getUnitFaction(unit)) < 1) return;
  unit.combatCount = Math.max(0, Number(unit.combatCount) || 0) + 1;
  unit.level = Math.max(1, Number(unit.level) || 1);
  const newLevel = 1 + Math.floor(unit.combatCount / UNIT_COMBATS_PER_LEVEL);
  if (newLevel <= unit.level) return;

  const levelsGained = newLevel - unit.level;
  unit.level = newLevel;
  if (getUnitFaction(unit) === game.civilization.id) {
    unit.pendingUpgrades = (Number(unit.pendingUpgrades) || 0) + levelsGained;
    addEvent(`${type.name} alcanza el nivel ${unit.level}. Puede elegir una mejora.`);
    return;
  }
  for (let level = 0; level < levelsGained; level += 1) applyUnitUpgrade(unit, "attack");
  addEvent(`${type.name} alcanza el nivel ${unit.level}.`);
}

function applyUnitUpgrade(unit, upgradeId) {
  if (!UNIT_LEVEL_UPGRADES.some((upgrade) => upgrade.id === upgradeId)) return false;
  unit.upgrades ??= { attack: 0, vitality: 0, defense: 0 };
  unit.upgrades[upgradeId] = (Number(unit.upgrades[upgradeId]) || 0) + 1;
  if (upgradeId === "vitality") {
    unit.maxHealth += 8;
    unit.health = Math.min(unit.maxHealth, unit.health + 8);
  }
  return true;
}

function chooseUnitUpgrade(unitId, upgradeId) {
  const unit = game.units.find((item) => item.id === unitId);
  const upgrade = UNIT_LEVEL_UPGRADES.find((item) => item.id === upgradeId);
  if (!unit || !upgrade || getUnitFaction(unit) !== game.civilization.id ||
      Number(unit.pendingUpgrades) < 1) return;
  applyUnitUpgrade(unit, upgradeId);
  unit.pendingUpgrades -= 1;
  addEvent(`${game.unitTypes.get(unit.typeId).name} elige ${upgrade.name}. ${upgrade.description}`);
  render();
  saveGame();
}

function removeDefeatedUnit(unit, type, defeatedByFaction) {
  game.units = game.units.filter((item) => item.id !== unit.id);
  addEvent(`${type.name} ha sido derrotado.`);
  if (getUnitFaction(unit) === "beasts") {
    addEvent("La criatura del Abismo se disuelve en una nube de ceniza oscura.");
    return;
  }
  if (unit.typeId === "dragon" && unit.campId) {
    game.barbarianCamps = game.barbarianCamps.filter((camp) => camp.id !== unit.campId);
    const owner = game.civilizations.find((civilization) =>
      civilization.id === defeatedByFaction && civilization.playable !== false && !civilization.independent
    );
    if (owner) {
      const dragon = spawnUnit("dragon", unit.x, unit.y, owner.id);
      dragon.movesLeft = 0;
      addEvent(`${owner.name} ha derrotado al Dragón ancestral y obtiene un dragón leal a su nación.`);
      return;
    }
  }
}

function foundPaganSunCityAtVillage(camp) {
  const civilization = game.civilizations.find((item) => item.id === "pagan-sun");
  const opponent = game.opponents.find((item) => item.civilization.id === "pagan-sun");
  if (!civilization || (!opponent && game.civilization.id !== "pagan-sun")) {
    throw new Error("No se encontró la Nación Independiente del Sol Pagano.");
  }
  game.barbarianCamps = game.barbarianCamps.filter((item) => item.id !== camp.id);
  const nameIndex = opponent ? opponent.cityNameIndex : game.cityNameIndex;
  const name = civilization.cities[nameIndex] ?? `Colonia ${nameIndex + 1}`;
  if (opponent) opponent.cityNameIndex += 1;
  else game.cityNameIndex += 1;
  const isCapital = !game.cities.some((city) =>
    (city.originalOwnerId ?? city.ownerId) === civilization.id && city.isCapital
  );
  const city = {
    name,
    ownerId: civilization.id,
    originalOwnerId: civilization.id,
    isCapital,
    x: camp.x,
    y: camp.y,
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
  const villageType = camp.faction === "barbarians" ? "bárbaro"
    : camp.faction === "elves" ? "élfico" : "enano";
  addEvent(`${civilization.name} conquista un poblado ${villageType} y funda ${name}${isCapital ? ", su capital" : ""}.`);
  recordMilestone(`${name} fundada al conquistar un poblado ${villageType}.`);
}

function resolveCityCombat(attacker, city) {
  const attackerType = game.unitTypes.get(attacker.typeId);
  const cityBuildings = (city.buildings ?? [])
    .map((id) => game.buildings.find((building) => building.id === id))
    .filter(Boolean);
  const damageReduction = Math.min(0.75, cityBuildings.reduce((total, building) =>
    total + (building.damageReduction ?? 0), 0));
  const damage = Math.max(1, Math.ceil(applyStanceDefense(attacker,
    Math.max(3, getUnitStrength(attackerType, getUnitFaction(attacker)) * 2 + Math.floor(Math.random() * 4)) *
    (1 - damageReduction))));
  city.health = Math.max(0, city.health - damage);
  showCombatDamageEffect(city, damage);
  addEvent(`${attackerType.name} asedia ${city.name} e inflige ${damage} de daño.`);
  if (city.health > 0) {
    const cityDefense = cityBuildings.reduce((total, building) => total + (building.cityDefense ?? 0), 0);
    const counterDamage = applyStanceDefense(attacker, 6 + cityDefense);
    attacker.health = Math.max(0, attacker.health - counterDamage);
    showCombatDamageEffect(attacker, counterDamage);
    addEvent(`${city.name} se defiende e inflige ${counterDamage} de daño.`);
    if (attacker.health <= 0) {
      game.units = game.units.filter((unit) => unit.id !== attacker.id);
      addEvent(`${attackerType.name} ha sido derrotado.`);
    }
    return;
  }

  if (getUnitFaction(attacker) === "beasts") {
    game.cities = game.cities.filter((item) => item.territoryId !== city.territoryId);
    for (const tile of game.tiles.flat()) {
      if (tile.territoryCityId !== city.territoryId) continue;
      delete tile.territoryCityId;
      delete tile.territoryOwnerId;
      delete tile.structure;
    }
    addEvent(`Una Bestia del Abismo arrasa ${city.name}; la ciudad queda destruida.`);
    return;
  }

  const previousOwner = city.ownerId;
  city.ownerId = getUnitFaction(attacker);
  city.health = city.maxHealth;
  for (const tile of game.tiles.flat()) {
    if (tile.territoryCityId === city.territoryId) {
      tile.territoryOwnerId = city.ownerId;
      if (tile.structure) delete tile.structure;
    }
  }
  const owner = game.civilizations.find((civilization) => civilization.id === city.ownerId);
  addEvent(`${owner?.name ?? "El ejército atacante"} conquista ${city.name}.`);
  if (city.isCapital && city.ownerId === game.civilization.id) {
    recordMilestone(`Conquistaste la capital ${city.name}.`);
  }
  const opponent = game.opponents.find((item) => item.civilization.id === previousOwner);
  if (opponent) opponent.relation = Math.min(opponent.relation, -100);
}

function rewardForBarbarianCamp(campId) {
  game.barbarianCamps = game.barbarianCamps.filter((camp) => camp.id !== campId);
  const reward = Math.floor(Math.random() * 3);
  if (reward === 0) {
    const gold = 15 + Math.floor(Math.random() * 16);
    game.gold += gold;
    addEvent(`Campamento despejado: encuentras ${gold} de oro.`);
  } else if (reward === 1) {
    const insight = 3;
    if (game.currentTechnology) {
      const technology = getCivilizationTechnologies().find((item) => item.id === game.currentTechnology);
      const progress = Number(game.technologyProgress[game.currentTechnology]) || 0;
      const applied = Math.min(insight, Math.max(0, getProgressionCost(technology) - progress));
      game.technologyProgress[game.currentTechnology] = progress + applied;
      game.scienceReserve += insight - applied;
      addEvent(`El campamento aporta ${insight} de conocimiento: ${technology.name} avanza ${applied}.`);
    } else {
      game.scienceReserve += insight;
      addEvent(`El campamento aporta ${insight} de conocimiento, guardado para tu próxima investigación.`);
    }
  } else {
    const material = Math.random() < 0.5 ? "grain" : "stone";
    game.materials[material] += 3;
    addEvent(`El campamento deja 3 de ${material === "grain" ? "grano" : "piedra"}.`);
  }
}

function processCampEntries(unit, path) {
  for (const tile of path) {
    const camp = game.barbarianCamps.find((item) => item.x === tile.x && item.y === tile.y);
    if (!camp || unit.campId === camp.id ||
        game.units.some((item) => item.campId === camp.id)) continue;
    const faction = getUnitFaction(unit);
    if (faction === "pagan-sun" &&
        (camp.faction === "barbarians" ||
          (!game.barbariansEnabled && ["elves", "dwarves"].includes(camp.faction)))) {
      foundPaganSunCityAtVillage(camp);
    } else if (faction === game.civilization.id) {
      rewardForBarbarianCamp(camp.id);
    } else {
      game.barbarianCamps = game.barbarianCamps.filter((item) => item.id !== camp.id);
    }
  }
}

function foundCity() {
  if (game.victory) return;
  const settler = getSelectedUnit();
  if (!settler || !game.unitTypes.get(settler.typeId).canFound) return;
  if (getCityAt(settler.x, settler.y)) {
    showMessage("Ya existe una ciudad en esta casilla.");
    return;
  }
  if (isTileInCityInfluence(settler.x, settler.y)) {
    showMessage("No se puede fundar dentro del área de influencia de otra ciudad.");
    return;
  }

  const name = game.civilization.cities[game.cityNameIndex] ?? `Colonia ${game.cityNameIndex + 1}`;
  game.cityNameIndex += 1;
  const isCapital = !game.cities.some((city) =>
    (city.originalOwnerId ?? city.ownerId) === game.civilization.id && city.isCapital
  );
  game.cities.push({
    name, ownerId: game.civilization.id, originalOwnerId: game.civilization.id, isCapital, x: settler.x, y: settler.y,
    population: 1, growth: 0, influenceTurns: 0, health: 30, maxHealth: 30,
    buildings: [], project: null, projectQueue: []
  });
  initializeCityTerritory(game.cities.at(-1));
  game.units = game.units.filter((unit) => unit.id !== settler.id);
  game.selectedUnitId = null;
  game.selectedTile = { x: settler.x, y: settler.y };
  addEvent(`${name} ha sido fundada. Comienza una nueva era.`);
  recordMilestone(`Fundaste la ciudad ${name}.`);
  showMessage(`${name} ya forma parte del Imperio.`);
  checkVictoryConditions();
  render();
  saveGame();
}

function getPlayerCities() {
  return game.cities.filter((city) => city.ownerId === game.civilization.id);
}

function hasFoundedPlayerCity() {
  return getPlayerCities().length > 0;
}

function getTerritoryOwner(x, y) {
  return game.tiles[y]?.[x]?.territoryOwnerId ?? null;
}

function isTileInCityInfluence(x, y) {
  return Boolean(getCityAt(x, y) || getTerritoryOwner(x, y));
}

function getCityTerritory(city) {
  return game.tiles.flat().filter((tile) => tile.territoryCityId === city.territoryId);
}

function initializeCityTerritory(city, legacyRadius = 1) {
  city.territoryId ??= `${city.ownerId}:${city.x}:${city.y}`;
  const radius = Math.max(1, Math.min(CITY_MAX_INFLUENCE_RADIUS, Math.floor(Number(legacyRadius) || 1)));
  for (let y = Math.max(0, city.y - radius); y <= Math.min(HEIGHT - 1, city.y + radius); y += 1) {
    for (let x = Math.max(0, city.x - radius); x <= Math.min(WIDTH - 1, city.x + radius); x += 1) {
      const tile = game.tiles[y][x];
      if (tile.territoryOwnerId) continue;
      tile.territoryOwnerId = city.ownerId;
      tile.territoryCityId = city.territoryId;
    }
  }
}

function getCityExpansionCandidates(city) {
  if (!city) return [];
  const territory = getCityTerritory(city);
  if (territory.length >= CITY_MAX_TERRITORY_TILES) return [];
  const candidates = new Map();
  for (const tile of territory) {
    for (let y = Math.max(0, tile.y - 1); y <= Math.min(HEIGHT - 1, tile.y + 1); y += 1) {
      for (let x = Math.max(0, tile.x - 1); x <= Math.min(WIDTH - 1, tile.x + 1); x += 1) {
        const candidate = game.tiles[y][x];
        if (candidate.territoryOwnerId ||
            Math.abs(candidate.x - city.x) > CITY_MAX_INFLUENCE_RADIUS ||
            Math.abs(candidate.y - city.y) > CITY_MAX_INFLUENCE_RADIUS) continue;
        candidates.set(`${x},${y}`, candidate);
      }
    }
  }
  return [...candidates.values()];
}

function getCityTilePurchaseCandidates(city) {
  if (!city || city.ownerId !== game.civilization.id) return [];
  return getCityExpansionCandidates(city).filter((tile) =>
    game.explored[tile.y]?.[tile.x] &&
    !getUnitAt(tile.x, tile.y) &&
    !getCityAt(tile.x, tile.y)
  );
}

function getPurchasableCityTileMap() {
  const cityByTile = new Map();
  if (game.victory || game.turnProcessing || game.selectedUnitId ||
      game.activeTurnFactionId !== game.civilization?.id) {
    return cityByTile;
  }
  for (const city of getPlayerCities()) {
    for (const tile of getCityTilePurchaseCandidates(city)) {
      const key = `${tile.x},${tile.y}`;
      if (!cityByTile.has(key)) cityByTile.set(key, []);
      cityByTile.get(key).push(city);
    }
  }
  return cityByTile;
}

function renderCityTilePurchaseActions(tile) {
  const cities = getPurchasableCityTileMap().get(`${tile.x},${tile.y}`) ?? [];
  if (!cities.length) return;
  addActionHint(`Casilla adyacente libre: puedes comprarla para una ciudad por ${CITY_TILE_PURCHASE_COST} de oro.`, "info");
  for (const city of cities) {
    addAction(`Comprar para ${city.name} · ${CITY_TILE_PURCHASE_COST} ◉`,
      () => purchaseCityTile(city.territoryId, tile.x, tile.y),
      game.gold < CITY_TILE_PURCHASE_COST);
  }
  if (game.gold < CITY_TILE_PURCHASE_COST) {
    addActionHint(`Te faltan ${CITY_TILE_PURCHASE_COST - game.gold} de oro.`, "warning");
  }
}

function purchaseCityTile(cityId, x, y) {
  if (game.victory || game.turnProcessing || game.activeTurnFactionId !== game.civilization.id) return;
  const city = getPlayerCities().find((item) => item.territoryId === cityId);
  const tile = game.tiles[y]?.[x];
  const isAvailable = city && getCityTilePurchaseCandidates(city).some((candidate) =>
    candidate.x === x && candidate.y === y
  );
  if (!isAvailable) {
    showMessage("Esta casilla no está disponible para compra: debe estar libre, explorada y junto al territorio de una ciudad.");
    return;
  }
  if (game.gold < CITY_TILE_PURCHASE_COST) {
    showMessage(`Comprar una casilla cuesta ${CITY_TILE_PURCHASE_COST} de oro.`);
    return;
  }
  game.gold -= CITY_TILE_PURCHASE_COST;
  tile.territoryOwnerId = city.ownerId;
  tile.territoryCityId = city.territoryId;
  game.selectedUnitId = null;
  game.selectedTile = { x, y };
  addEvent(`${city.name} compra una casilla de ${TERRAIN[tile.type].name} por ${CITY_TILE_PURCHASE_COST} de oro.`);
  render();
  saveGame();
}

function processCityInfluence(city) {
  city.influenceTurns = (Number(city.influenceTurns) || 0) + 1;
  if (city.influenceTurns < 5) return;
  city.influenceTurns = 0;
  const available = getCityExpansionCandidates(city);
  if (!available.length) return;
  const tile = available[Math.floor(Math.random() * available.length)];
  tile.territoryOwnerId = city.ownerId;
  tile.territoryCityId = city.territoryId;
  const civilization = game.civilizations.find((item) => item.id === city.ownerId);
  addEvent(`${city.name} reclama una nueva casilla para ${civilization?.name ?? "su civilización"}.`);
}

function getActiveTradeBonus() {
  return game.opponents.filter((opponent) => opponent.tradeTurns > 0).length;
}

function processAIOpponents(activeOpponentId) {
  const difficulty = AI_DIFFICULTIES[game.difficulty] ?? AI_DIFFICULTIES.normal;
  for (const opponent of game.opponents) {
    if (opponent.civilization.id !== activeOpponentId) continue;
    opponent.turns += 1;
    if (opponent.turns % 4 === 0) {
      const desiredRelation = -10 - (opponent.civilization.aggression ?? 0) * 0.7;
      const relationDifference = desiredRelation - opponent.relation;
      opponent.relation += Math.sign(relationDifference) *
        Math.min(Math.abs(relationDifference), difficulty.relationStep);
    }
    if (opponent.met && !opponent.atWar && opponent.relation <= difficulty.warThreshold) {
      opponent.atWar = true;
      opponent.tradeTurns = 0;
      opponent.warTurns = 0;
      opponent.peaceOffered = false;
      addEvent(`${opponent.civilization.name} declara la guerra debido al deterioro de las relaciones.`);
    }
    if (opponent.atWar) {
      opponent.warTurns = (Number(opponent.warTurns) || 0) + 1;
      if (opponent.warTurns >= 12 && !opponent.peaceOffered) {
        opponent.peaceOffered = true;
        addEvent(`${opponent.civilization.name} ofrece negociar la paz.`);
      }
    }

    const civilizationId = opponent.civilization.id;
    const cities = game.cities.filter((city) => city.ownerId === civilizationId);
    opponent.production += cities.length * difficulty.productionMultiplier;
    for (const city of cities) {
      city.growth += 1;
      if (city.growth >= 5) {
        city.growth -= 5;
        city.population += 1;
        addEvent(`${city.name}, de ${opponent.civilization.name}, ha crecido.`);
      }
    }

    const units = game.units.filter((unit) => getUnitFaction(unit) === civilizationId);
    for (const unit of units) {
      if (!game.units.includes(unit)) continue;
      if (civilizationId === "pagan-sun" && unit.typeId !== "dragon") advanceAIPaganSunUnit(unit);
      else if (game.unitTypes.get(unit.typeId).canFound) advanceAISettler(unit, opponent, cities);
      else if (opponent.atWar) advanceAIGuard(unit);
    }

    if (opponent.civilization.canFoundSettlers !== false &&
        opponent.production >= 8 && cities.length < 3 &&
        !game.units.some((unit) => getUnitFaction(unit) === civilizationId &&
          game.unitTypes.get(unit.typeId).canFound)) {
      const city = cities[0];
      const founderType = opponent.civilization.startingUnits.find((id) => game.unitTypes.get(id)?.canFound);
      const spawn = city && findSpawnTile(city.x, city.y);
      if (founderType && spawn) {
        opponent.production -= 8;
        spawnUnit(founderType, spawn.x, spawn.y);
        addEvent(`${opponent.civilization.name} prepara una expedición para fundar otra ciudad.`);
      }
    }

    if (opponent.met && opponent.turns % 6 === 0 && opponent.relation >= 0 && opponent.relation < 40) {
      opponent.relation += 2;
      addEvent(`${opponent.civilization.name} envía una delegación diplomática.`);
    }
  }
}

function spawnAbyssBeast() {
  const lairs = game.tiles.flat().filter((tile) =>
    tile.type === "abyss" && !getUnitAt(tile.x, tile.y) && !getCityAt(tile.x, tile.y)
  );
  if (!lairs.length || game.units.filter((unit) => getUnitFaction(unit) === "beasts").length >= 8) return;
  const lair = lairs[Math.floor(Math.random() * lairs.length)];
  const beast = spawnUnit("abyss-beast", lair.x, lair.y);
  addEvent(`Una Bestia del Abismo emerge en las grietas centrales (${lair.x + 1}, ${lair.y + 1}).`);
}

function isAbyssBeastSpawnTurn(turn) {
  return turn >= ABYSS_BEAST_FIRST_SPAWN_TURN &&
    (turn - ABYSS_BEAST_FIRST_SPAWN_TURN) % ABYSS_BEAST_SPAWN_INTERVAL === 0;
}

function processAbyssBeasts() {
  if (isAbyssBeastSpawnTurn(game.turn)) spawnAbyssBeast();
  for (const beast of game.units.filter((unit) => getUnitFaction(unit) === "beasts")) {
    if (!game.units.includes(beast)) continue;
    const targets = [
      ...game.units.filter((unit) => getUnitFaction(unit) !== "beasts")
        .map((target) => ({ target, kind: "unit" })),
      ...game.cities.map((target) => ({ target, kind: "city" }))
    ].map((entry) => ({
      ...entry,
      distance: Math.abs(entry.target.x - beast.x) + Math.abs(entry.target.y - beast.y)
    })).sort((first, second) => first.distance - second.distance);
    const target = targets[0];
    if (!target || target.distance > 8) continue;
    if (target.distance === 1) {
      if (target.kind === "unit") resolveUnitCombat(beast, target.target, target.distance);
      else resolveCityCombat(beast, target.target);
      beast.movesLeft = 0;
      continue;
    }

    const approaches = [];
    for (let y = Math.max(0, target.target.y - 1); y <= Math.min(HEIGHT - 1, target.target.y + 1); y += 1) {
      for (let x = Math.max(0, target.target.x - 1); x <= Math.min(WIDTH - 1, target.target.x + 1); x += 1) {
        if (Math.abs(target.target.x - x) + Math.abs(target.target.y - y) !== 1) continue;
        const route = findPath(beast, x, y, beast.movesLeft);
        if (route?.path.length) approaches.push({ route, distance: Math.abs(target.target.x - x) + Math.abs(target.target.y - y) });
      }
    }
    approaches.sort((first, second) => first.distance - second.distance || first.route.cost - second.route.cost);
    if (approaches[0]) moveAlongPath(beast, approaches[0].route.path);
  }
}

function processTerritoryBuildings() {
  for (const tile of game.tiles.flat()) {
    const structure = tile.structure;
    if (!structure || game.turn < structure.nextSpawnTurn) continue;
    const building = game.buildings.find((item) => item.id === structure.buildingId);
    const unit = building && game.unitTypes.get(building.unitId);
    if (!building || !unit || unit.faction !== structure.ownerId) continue;
    const spawn = findUnitSpawnTileNear(tile.x, tile.y, unit);
    if (!spawn) {
      structure.nextSpawnTurn = game.turn + 1;
      continue;
    }
    spawnUnit(unit.id, spawn.x, spawn.y, structure.ownerId);
    structure.nextSpawnTurn = game.turn + building.unitInterval;
    addEvent(`${building.name} forma un ${unit.name} para ${getCivilizationById(structure.ownerId)?.name ?? "su nación"}.`);
  }
}

function findUnitSpawnTileNear(x, y, unit) {
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  return directions.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find((tile) =>
    tile.x >= 0 && tile.x < WIDTH && tile.y >= 0 && tile.y < HEIGHT &&
    canUnitEnterTerrain(unit, game.tiles[tile.y][tile.x].type) && !getUnitAt(tile.x, tile.y) &&
    !getCityAt(tile.x, tile.y)
  ) ?? null;
}

function advanceAISettler(unit, opponent, cities) {
  const cityDistance = cities.length
    ? Math.min(...cities.map((city) => Math.abs(city.x - unit.x) + Math.abs(city.y - unit.y)))
    : Infinity;
  if (!isTileInCityInfluence(unit.x, unit.y) && cityDistance >= 4) {
    const name = opponent.civilization.cities[opponent.cityNameIndex] ??
      `Colonia ${opponent.cityNameIndex + 1}`;
    opponent.cityNameIndex += 1;
    const isCapital = !game.cities.some((city) =>
      (city.originalOwnerId ?? city.ownerId) === opponent.civilization.id && city.isCapital
    );
    game.cities.push({
      name, ownerId: opponent.civilization.id, originalOwnerId: opponent.civilization.id, isCapital, x: unit.x, y: unit.y,
      population: 1, growth: 0, influenceTurns: 0, health: 30, maxHealth: 30,
      buildings: [], project: null, projectQueue: []
    });
    initializeCityTerritory(game.cities.at(-1));
    game.units = game.units.filter((item) => item.id !== unit.id);
    addEvent(`${opponent.civilization.name} ha fundado ${name}.`);
    return;
  }

  if (!cities.length) return;
  const candidates = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!TERRAIN[game.tiles[y][x].type].passable || getUnitAt(x, y) ||
          isTileInCityInfluence(x, y)) continue;
      const distanceFromCity = Math.min(...cities.map((city) => Math.abs(city.x - x) + Math.abs(city.y - y)));
      const distanceFromUnit = Math.abs(unit.x - x) + Math.abs(unit.y - y);
      if (distanceFromCity < 4 || distanceFromCity > 6 || distanceFromUnit > 12) continue;
      candidates.push({ x, y, score: distanceFromUnit + Math.abs(distanceFromCity - 5) * 2 });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  for (const target of candidates) {
    const route = findPath(unit, target.x, target.y, WIDTH * HEIGHT);
    if (!route?.path.length) continue;
    moveAlongPath(unit, route.path);
    return;
  }
}

function advanceAIPaganSunUnit(unit) {
  const villages = game.barbarianCamps.filter((camp) =>
    camp.faction === "barbarians" ||
    (!game.barbariansEnabled && ["elves", "dwarves"].includes(camp.faction))
  )
    .map((camp) => ({
      camp,
      guard: game.units.find((item) => item.campId === camp.id),
      distance: Math.abs(camp.x - unit.x) + Math.abs(camp.y - unit.y)
    }))
    .sort((first, second) => first.distance - second.distance);
  const target = villages[0];
  if (!target || !game.units.includes(unit)) return;
  const type = game.unitTypes.get(unit.typeId);
  const attackRange = Math.max(1, type.range ?? 1);
  if (!target.guard) {
    if (unit.x === target.camp.x && unit.y === target.camp.y) {
      processCampEntries(unit, [target.camp]);
      return;
    }
    const path = findPath(unit, target.camp.x, target.camp.y, WIDTH * HEIGHT);
    if (path?.path.length) moveAlongPath(unit, path.path);
    return;
  }
  if (target.distance <= attackRange) {
    resolveUnitCombat(unit, target.guard, target.distance);
    if (game.units.includes(unit)) unit.movesLeft = 0;
    return;
  }

  const approaches = [];
  for (let y = Math.max(0, target.camp.y - attackRange); y <= Math.min(HEIGHT - 1, target.camp.y + attackRange); y += 1) {
    for (let x = Math.max(0, target.camp.x - attackRange); x <= Math.min(WIDTH - 1, target.camp.x + attackRange); x += 1) {
      const distance = Math.abs(target.camp.x - x) + Math.abs(target.camp.y - y);
      if (!distance || distance > attackRange) continue;
      const route = findPath(unit, x, y, WIDTH * HEIGHT);
      if (route?.path.length) approaches.push({ route, distance });
    }
  }
  approaches.sort((first, second) => first.distance - second.distance || first.route.cost - second.route.cost);
  if (approaches[0]) moveAlongPath(unit, approaches[0].route.path);
}

function advanceAIGuard(unit) {
  const type = game.unitTypes.get(unit.typeId);
  const targets = [
    ...game.units.filter((target) => getUnitFaction(target) === game.civilization.id &&
      getUnitStrength(game.unitTypes.get(target.typeId), game.civilization.id) > 0),
    ...getPlayerCities()
  ].map((target) => ({
    target,
    kind: "territoryId" in target ? "city" : "unit",
    distance: Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y)
  })).sort((a, b) => a.distance - b.distance);
  const closest = targets[0];
  if (!closest || closest.distance > 6) return;
  if (closest.distance > 0 && closest.distance <= (type.range ?? 1)) {
    if (closest.kind === "unit") resolveUnitCombat(unit, closest.target, closest.distance);
    else resolveCityCombat(unit, closest.target);
    unit.movesLeft = 0;
    return;
  }
  const movement = type.movement;
  const reachable = [];
  for (let y = Math.max(0, unit.y - movement); y <= Math.min(HEIGHT - 1, unit.y + movement); y += 1) {
    for (let x = Math.max(0, unit.x - movement); x <= Math.min(WIDTH - 1, unit.x + movement); x += 1) {
      if (x === unit.x && y === unit.y) continue;
      const route = findPath(unit, x, y, unit.movesLeft);
      if (!route?.path.length) continue;
      const distance = Math.abs(closest.target.x - x) + Math.abs(closest.target.y - y);
      if (distance === 0) continue;
      reachable.push({
        route,
        distance
      });
    }
  }
  reachable.sort((a, b) => a.distance - b.distance || a.route.cost - b.route.cost);
  if (reachable[0]?.distance < closest.distance && reachable[0].distance > 0) {
    moveAlongPath(unit, reachable[0].route.path);
  }
}

function processBarbarianTurns(factionId) {
  for (const unit of game.units.filter((item) =>
    getUnitFaction(item) === factionId && isIndependentFaction(factionId) && factionId !== "beasts"
  )) {
    if (!game.units.includes(unit)) continue;
    const targets = game.units.filter((target) =>
      getUnitFaction(target) === game.civilization.id &&
      getUnitStrength(game.unitTypes.get(target.typeId), game.civilization.id) > 0
    );
    if (!targets.length) continue;
    targets.sort((a, b) =>
      Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y) -
      (Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y))
    );
    const target = targets[0];
    const distance = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
    const range = game.unitTypes.get(unit.typeId).range ?? 1;
    if (distance > 0 && distance <= range) {
      resolveUnitCombat(unit, target, distance);
      continue;
    }
    if (distance > 6) continue;
    const movement = game.unitTypes.get(unit.typeId).movement;
    const approaches = [];
    for (let y = Math.max(0, unit.y - movement); y <= Math.min(HEIGHT - 1, unit.y + movement); y += 1) {
      for (let x = Math.max(0, unit.x - movement); x <= Math.min(WIDTH - 1, unit.x + movement); x += 1) {
        const nextDistance = Math.abs(target.x - x) + Math.abs(target.y - y);
        if (nextDistance >= distance || nextDistance < 1) continue;
        const route = findPath(unit, x, y, unit.movesLeft);
        if (route?.path.length) approaches.push({ route, distance: nextDistance });
      }
    }
    approaches.sort((a, b) => a.distance - b.distance || a.route.cost - b.route.cost);
    if (approaches[0]) moveAlongPath(unit, approaches[0].route.path);
  }
}

function moveAlongPath(unit, path) {
  let cost = 0;
  const traversed = [];
  for (const step of path) {
    const stepCost = getUnitTerrainCost(unit, game.tiles[step.y][step.x].type);
    if (cost + stepCost > unit.movesLeft) break;
    cost += stepCost;
    traversed.push(step);
  }
  if (!traversed.length) return;
  const destination = traversed[traversed.length - 1];
  unit.x = destination.x;
  unit.y = destination.y;
  unit.movesLeft -= cost;
  processCampEntries(unit, traversed);
}

function findSpawnTile(x, y) {
  const offsets = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  return offsets.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .find((tile) => tile.x >= 0 && tile.x < WIDTH && tile.y >= 0 && tile.y < HEIGHT &&
      TERRAIN[game.tiles[tile.y][tile.x].type].passable && !getUnitAt(tile.x, tile.y)) ?? null;
}

function resetFactionTurn(factionId) {
  for (const unit of game.units.filter((item) => getUnitFaction(item) === factionId)) {
    if (factionId === game.civilization.id && unit.stance === "resting") {
      const previousHealth = unit.health;
      unit.health = Math.min(unit.maxHealth, unit.health + 6);
      unit.movesLeft = 0;
      const recovered = unit.health - previousHealth;
      if (recovered > 0) addEvent(`${game.unitTypes.get(unit.typeId).name} recupera ${recovered} de salud mientras descansa.`);
    } else if (factionId === game.civilization.id && unit.stance === "fortified") {
      const previousHealth = unit.health;
      unit.health = Math.min(unit.maxHealth, unit.health + 2);
      unit.movesLeft = 0;
      const recovered = unit.health - previousHealth;
      if (recovered > 0) addEvent(`${game.unitTypes.get(unit.typeId).name} recupera ${recovered} de salud al mantener la defensa.`);
    } else {
      unit.stance = "active";
      unit.movesLeft = game.unitTypes.get(unit.typeId).movement;
    }
  }
}

function getTurnFactionName(factionId) {
  const independentNames = {
    elves: "Elfos",
    dwarves: "Enanos",
    barbarians: "Bárbaros",
    dragons: "Dragones",
    beasts: "Bestias del Abismo"
  };
  return getCivilizationById(factionId)?.name ?? independentNames[factionId] ?? "Facción independiente";
}

async function showFactionTurn(factionId, label = getTurnFactionName(factionId)) {
  game.activeTurnFactionId = factionId;
  const transition = document.querySelector("#turn-transition");
  transition.querySelector("#turn-transition-name").textContent = label;
  transition.hidden = false;
  await new Promise((resolve) => window.setTimeout(resolve, 350));
}

async function endTurn() {
  if (game.victory || game.turnProcessing ||
      game.activeTurnFactionId !== game.civilization?.id) return;
  game.turnProcessing = true;
  const gameScreen = document.querySelector("#game-screen");
  const transition = document.querySelector("#turn-transition");
  gameScreen.inert = true;
  document.querySelector("#end-turn").disabled = true;

  try {
    for (const opponent of game.opponents) {
      const factionId = opponent.civilization.id;
      await showFactionTurn(factionId);
      resetFactionTurn(factionId);
      processAIOpponents(factionId);
      render();
    }

    const independentFactionIds = [...new Set(game.units
      .map(getUnitFaction)
      .filter((factionId) => isIndependentFaction(factionId) && factionId !== "beasts"))];
    for (const factionId of independentFactionIds) {
      await showFactionTurn(factionId);
      resetFactionTurn(factionId);
      processBarbarianTurns(factionId);
      render();
    }

    game.turn += 1;
    const hasBeasts = game.units.some((unit) => getUnitFaction(unit) === "beasts");
    const beastSpawnDue = isAbyssBeastSpawnTurn(game.turn);
    if (hasBeasts || beastSpawnDue) {
      await showFactionTurn("beasts");
      resetFactionTurn("beasts");
    }
    processAbyssBeasts();
    await showFactionTurn("world", "Cierre de ronda");
    resetFactionTurn(game.civilization.id);
    processMerchantRoutes();
    processTerritoryBuildings();
    for (const city of game.cities) processCityInfluence(city);

    const earnedFood = getFactionFoodIncome(game.civilization.id);
    const opponentFoodIncomes = game.opponents.map((opponent) => ({
      opponent,
      earnedFood: getFactionFoodIncome(opponent.civilization.id)
    }));
    const rates = getEmpireRates();
    let earnedProduction = 0;
    let tradeGold = 0;
    for (const city of getPlayerCities()) {
      const trade = getCityTradeBonuses(city);
      tradeGold += trade.gold;
      const cityProduction = getCityProductionRate(city);
      earnedProduction += cityProduction;
      processCityProject(city, cityProduction);
      city.growth += 2 + trade.foodGrowth;
      if (city.growth >= 10) {
        city.growth -= 10;
        city.population += 1;
        addEvent(`${city.name} crece hasta alcanzar ${city.population} de población.`);
      }
    }
    const playerFoodEconomy = processFactionFoodEconomy(game.civilization.id, game, earnedFood);
    for (const { opponent, earnedFood: opponentEarnedFood } of opponentFoodIncomes) {
      processFactionFoodEconomy(opponent.civilization.id, opponent, opponentEarnedFood);
    }
    game.production += earnedProduction;
    const earnedGold = getPlayerCities().length + tradeGold + getAdoptedCivicBonus("gold");
    game.gold += earnedGold;
    const earnedMaterials = getMaterialProduction();
    game.materials.grain += earnedMaterials.grain;
    game.materials.stone += earnedMaterials.stone;
    processGlobalProgress("technology", rates.science);
    processGlobalProgress("civic", rates.culture);
    for (const opponent of game.opponents) {
      if (opponent.tradeTurns > 0) opponent.tradeTurns -= 1;
    }
    document.querySelector("#turn-number").textContent = String(game.turn);
    if (getPlayerCities().length) {
      addEvent(`Turno ${game.turn}: +${earnedFood} alimentos, −${playerFoodEconomy.upkeep} de mantenimiento, +${earnedProduction} producción, +${earnedGold} oro, +${earnedMaterials.grain} grano, +${earnedMaterials.stone} piedra, +${rates.science} ciencia y +${rates.culture} cultura.`);
    } else {
      addEvent(`Turno ${game.turn}: sin ciudades propias; −${playerFoodEconomy.upkeep} alimentos de mantenimiento y las unidades recuperan su movimiento.`);
    }
    checkVictoryConditions();
    game.selectedUnitId = null;
    game.activeTurnFactionId = game.civilization.id;
    render();
    if (!game.victory) {
      await showFactionTurn(game.civilization.id, `${game.civilization.name} · tu turno`);
    }
    saveGame();
  } catch (error) {
    showMessage(`No se pudo completar el ciclo de turnos: ${error.message}`);
    throw error;
  } finally {
    game.turnProcessing = false;
    game.activeTurnFactionId = game.civilization.id;
    transition.hidden = true;
    gameScreen.inert = false;
    render();
  }
}

function getCityTradeBonuses(city) {
  const bonuses = { gold: 0, production: 0, food: 0, foodGrowth: 0 };
  for (const unit of game.units) {
    const route = unit.tradeRoute;
    if (!route || route.originCityId !== city.territoryId) continue;
    const destination = game.cities.find((item) => item.territoryId === route.destinationCityId);
    if (!destination) continue;
    const opponent = game.opponents.find((item) => item.civilization.id === destination.ownerId);
    if (opponent?.atWar) continue;
    const distance = Math.max(1, Math.floor(Number(route.distance) ||
      getTradeRouteDistance(unit, city, destination)));
    const yieldAmount = getTradeRouteYield(distance, route.yieldType);
    bonuses.gold += yieldAmount.gold ?? 0;
    bonuses.production += yieldAmount.production ?? 0;
    bonuses.food += yieldAmount.food ?? 0;
    bonuses.foodGrowth += yieldAmount.foodGrowth ?? 0;
  }
  return bonuses;
}

function getUnitFoodUpkeep(unit) {
  return game.unitTypes.get(unit.typeId)?.canFound ? 2 : 1;
}

function getFactionFoodUpkeep(factionId) {
  return game.units.reduce((total, unit) =>
    total + (getUnitFaction(unit) === factionId ? getUnitFoodUpkeep(unit) : 0), 0);
}

function getFactionFoodIncome(factionId) {
  return game.cities.reduce((income, city) => {
    if (city.ownerId !== factionId) return income;
    const tile = game.tiles[city.y][city.x];
    const buildingFood = (city.buildings ?? []).reduce((total, id) =>
      total + (game.buildings.find((building) => building.id === id)?.food ?? 0), 0);
    return income + TERRAIN[tile.type].food + 1 + buildingFood + getCityTradeBonuses(city).food;
  }, 0);
}

function processFactionFoodEconomy(factionId, economy, earnedFood) {
  const upkeep = getFactionFoodUpkeep(factionId);
  const availableFood = Math.max(0, Number(economy.food) || 0) + earnedFood;
  const shortage = Math.max(0, upkeep - availableFood);
  economy.food = Math.max(0, availableFood - upkeep);
  economy.foodDeficitTurns = shortage > 0
    ? Math.max(0, Math.floor(Number(economy.foodDeficitTurns) || 0)) + 1
    : 0;

  if (shortage > 0) {
    const factionName = getCivilizationById(factionId)?.name ?? "La facción";
    addEvent(`${factionName} no puede cubrir ${shortage} de mantenimiento alimentario.`);
    if (economy.foodDeficitTurns > FOOD_DEFICIT_GRACE_TURNS) {
      applyStarvationDamage(factionId, factionName);
    }
  }
  return { upkeep, shortage };
}

function applyStarvationDamage(factionId, factionName) {
  const units = game.units.filter((unit) => getUnitFaction(unit) === factionId);
  if (!units.length) return;
  for (const unit of units) {
    unit.health = Math.max(0, unit.health - FOOD_STARVATION_DAMAGE);
    if (unit.health > 0) continue;
    const type = game.unitTypes.get(unit.typeId);
    game.units = game.units.filter((remaining) => remaining.id !== unit.id);
    addEvent(`${type.name} de ${factionName} muere por inanición.`);
  }
  addEvent(`${factionName} sufre desgaste por hambre: sus unidades pierden hasta ${FOOD_STARVATION_DAMAGE} de salud.`);
}

function processMerchantRoutes() {
  for (const unit of game.units) {
    const type = game.unitTypes.get(unit.typeId);
    const route = unit.tradeRoute;
    if (!type?.canTrade || !route) continue;
    const origin = game.cities.find((city) => city.territoryId === route.originCityId);
    const destination = game.cities.find((city) => city.territoryId === route.destinationCityId);
    if (!origin || !destination) continue;
    const opponent = game.opponents.find((item) => item.civilization.id === destination.ownerId);
    if (opponent?.atWar) continue;
    let target = game.cities.find((city) => city.territoryId === route.nextCityId);
    if (!target) {
      route.nextCityId = origin.territoryId;
      target = origin;
    }
    if (Math.abs(unit.x - target.x) + Math.abs(unit.y - target.y) <= 1) {
      target = target.territoryId === origin.territoryId ? destination : origin;
      route.nextCityId = target.territoryId;
    }
    const path = findMerchantRoutePath(unit, target);
    if (!path) continue;
    let movementCost = 0;
    for (const step of path) {
      const stepCost = getUnitTerrainCost(unit, game.tiles[step.y][step.x].type);
      if (movementCost + stepCost > unit.movesLeft) break;
      movementCost += stepCost;
      unit.x = step.x;
      unit.y = step.y;
    }
    unit.movesLeft -= movementCost;
  }
}

function findMerchantRoutePath(unit, city) {
  const approaches = [
    { x: city.x, y: city.y },
    { x: city.x + 1, y: city.y }, { x: city.x - 1, y: city.y },
    { x: city.x, y: city.y + 1 }, { x: city.x, y: city.y - 1 },
    { x: city.x + 1, y: city.y + 1 }, { x: city.x - 1, y: city.y + 1 },
    { x: city.x + 1, y: city.y - 1 }, { x: city.x - 1, y: city.y - 1 }
  ].filter((tile) => tile.x >= 0 && tile.x < WIDTH && tile.y >= 0 && tile.y < HEIGHT &&
    canUnitEnterTerrain(unit, game.tiles[tile.y][tile.x].type) &&
    (!getUnitAt(tile.x, tile.y) || getUnitAt(tile.x, tile.y) === unit));
  const targets = new Set(approaches.map((tile) => `${tile.x},${tile.y}`));
  if (targets.has(`${unit.x},${unit.y}`)) return [];
  const frontier = [{ x: unit.x, y: unit.y, cost: 0 }];
  const best = new Map([[`${unit.x},${unit.y}`, 0]]);
  const previous = new Map();
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (frontier.length) {
    frontier.sort((first, second) => first.cost - second.cost);
    const current = frontier.shift();
    const currentKey = `${current.x},${current.y}`;
    if (targets.has(currentKey)) {
      const path = [];
      let key = currentKey;
      while (key !== `${unit.x},${unit.y}`) {
        const [x, y] = key.split(",").map(Number);
        path.push({ x, y });
        key = previous.get(key);
      }
      return path.reverse();
    }
    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT ||
          (getUnitAt(x, y) && getUnitAt(x, y) !== unit) ||
          !canUnitEnterTerrain(unit, game.tiles[y][x].type)) continue;
      const key = `${x},${y}`;
      const cost = current.cost + getUnitTerrainCost(unit, game.tiles[y][x].type);
      if (best.has(key) && best.get(key) <= cost) continue;
      best.set(key, cost);
      previous.set(key, currentKey);
      frontier.push({ x, y, cost });
    }
  }
  return null;
}

function getEmpireRates() {
  const buildings = getPlayerCities().flatMap((city) => (city.buildings ?? [])
    .map((id) => game.buildings.find((building) => building.id === id)).filter(Boolean));
  return {
    science: 1 + getPlayerCities().length + buildings.reduce((total, building) => total + building.science, 0) +
      getAdoptedCivicBonus("science") + getActiveTradeBonus(),
    culture: 1 + getPlayerCities().length + buildings.reduce((total, building) => total + building.culture, 0) +
      getAdoptedCivicBonus("culture") + getActiveTradeBonus()
  };
}

function getAdoptedCivicBonus(yieldName) {
  return game.adoptedCivics.reduce((total, id) => {
    const civic = game.civics.find((item) => item.id === id);
    return total + (civic?.[yieldName] ?? 0);
  }, 0);
}

function processGlobalProgress(kind, rate) {
  if (!hasFoundedPlayerCity()) return;
  const isTechnology = kind === "technology";
  const currentId = isTechnology ? game.currentTechnology : game.currentCivic;
  if (!currentId) return;
  const item = (isTechnology ? game.technologies : game.civics).find((entry) => entry.id === currentId);
  if (!item) return;
  const progressKey = isTechnology ? "technologyProgress" : "civicProgress";
  game[progressKey][currentId] = (Number(game[progressKey][currentId]) || 0) + rate;
  const cost = getProgressionCost(item);
  if (game[progressKey][currentId] < cost) return;

  game[progressKey][currentId] = cost;
  if (isTechnology) {
    game.researched.push(currentId);
    game.currentTechnology = null;
    addEvent(`Investigación completada: ${item.name}. Sus desbloqueos ya están disponibles.`);
    recordMilestone(`Investigación completada: ${item.name}.`);
  } else {
    game.adoptedCivics.push(currentId);
    game.currentCivic = null;
    recordMilestone(`Política adoptada: ${item.name}.`);
    const group = item.exclusiveGroup;
    if (group) {
      for (const rival of game.civics) {
        if (rival.exclusiveGroup === group && rival.id !== currentId && !game.blockedCivics.includes(rival.id)) {
          game.blockedCivics.push(rival.id);
        }
      }
      addEvent(`Doctrina adoptada: ${item.name}. Las rutas culturales rivales quedan cerradas.`);
    } else {
      addEvent(`Política adoptada: ${item.name}.`);
    }
  }
}

function processCityProject(city, production) {
  city.projectQueue ??= [];
  if (!city.project) city.project = city.projectQueue.shift() ?? null;
  if (!city.project) return;
  const definition = getProjectDefinition(city.project);
  if (!definition) {
    releaseProjectMaterials(city.project);
    city.project = city.projectQueue.shift() ?? null;
    return;
  }
  if (definition.id === "galley" && !cityHasNavalAccess(city)) {
    releaseProjectMaterials(city.project);
    city.project = city.projectQueue.shift() ?? null;
    addEvent(`${city.name} cancela la Galera: necesita un puerto o estar junto al agua.`);
    return;
  }
  city.project.progress = (Number(city.project.progress) || 0) + production;
  if (city.project.progress < definition.cost) return;

  if (city.project.type === "building") {
    city.buildings ??= [];
    if (!city.buildings.includes(definition.id)) {
      city.buildings.push(definition.id);
      if (definition.cityHealth) {
        city.maxHealth += definition.cityHealth;
        city.health = Math.min(city.maxHealth, city.health + definition.cityHealth);
      }
    }
    addEvent(`${city.name} ha construido ${definition.name}.`);
  } else {
    if (!city.project.reservedMaterials) {
      if (!reserveUnitMaterials(definition)) {
        city.project.progress = definition.cost;
        return;
      }
      city.project.reservedMaterials = getUnitMaterialRequirements(definition);
    }
    const spawn = findUnitSpawnTile(city);
    if (!spawn) {
      city.project.progress = definition.cost;
      return;
    }
    spawnUnit(definition.id, spawn.x, spawn.y, game.civilization.id);
    addEvent(`${city.name} ha formado una unidad: ${definition.name}.`);
  }
  city.project = city.projectQueue.shift() ?? null;
}

function findUnitSpawnTile(city) {
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  return directions.map(([dx, dy]) => ({ x: city.x + dx, y: city.y + dy })).find((tile) =>
    tile.x >= 0 && tile.x < WIDTH && tile.y >= 0 && tile.y < HEIGHT &&
    TERRAIN[game.tiles[tile.y][tile.x].type].passable && !getUnitAt(tile.x, tile.y)
  ) ?? null;
}
