let pendingWarOrder = null;
let currentProgressionKind = "science";
let progressionBranchesVisible = false;
let backgroundMusic = null;
let backgroundMusicEnabled = false;
let backgroundMusicTrackIndex = 0;
let masterAudioVolume = 0.3;
let audioMuted = false;
let unitAudioContext = null;
let unitAudioMasterGain = null;
let audioContextUnsupportedReported = false;
const BACKGROUND_MUSIC_TRACKS = [
  "assets/music/Port Town (Loop).ogg",
  "assets/music/Royal Town (Loop).ogg",
  "assets/music/Whimsical Town (Loop).ogg",
  "assets/music/Shady Town (Loop).ogg",
  "assets/music/Mystical Town (Loop).ogg",
  "assets/music/Mining Town (Loop).ogg",
  "assets/music/Mechanical Town (Loop).ogg",
  "assets/music/Desert Town (Loop).ogg",
  "assets/music/Pleasant Adventure.ogg",
  "assets/music/In the Before Times.ogg",
  "assets/music/The Sand Level.ogg",
  "assets/music/Hordes and Hordes.ogg",
  "assets/music/Madness All Around Me.ogg"
];

function renderStats() {
  const cities = getPlayerCities();
  document.querySelector("#nation-name").textContent = game.civilization.name;
  document.querySelector("#civilization-passive").textContent =
    game.civilization.abilities?.descriptions?.join(" ") ||
    game.civilization.description ||
    "Esta civilización no tiene una habilidad pasiva descrita.";
  document.querySelector("#city-count").textContent = String(cities.length);
  document.querySelector("#unit-count").textContent = String(game.units.filter((unit) =>
    getUnitFaction(unit) === game.civilization.id
  ).length);
  document.querySelector("#food-count").textContent = String(game.food);
  const foodIncome = getFactionFoodIncome(game.civilization.id);
  const foodUpkeep = getFactionFoodUpkeep(game.civilization.id);
  document.querySelector("#food-flow").textContent = `+${foodIncome} / −${foodUpkeep} por turno`;
  document.querySelector("#food-flow").title = "Producción de alimentos / mantenimiento de unidades por turno.";
  document.querySelector("#production-count").textContent = String(game.production);
  document.querySelector("#gold-count").textContent = String(game.gold);
  document.querySelector("#grain-count").textContent = String(game.materials.grain);
  document.querySelector("#stone-count").textContent = String(game.materials.stone);
  const rates = getEmpireRates();
  const activeTechnology = getCivilizationTechnologies().find((item) => item.id === game.currentTechnology);
  const activeCivic = game.civics.find((item) => item.id === game.currentCivic);
  const scienceButton = document.querySelector("#open-science");
  const cultureButton = document.querySelector("#open-culture");
  scienceButton.disabled = !hasFoundedPlayerCity();
  cultureButton.disabled = !hasFoundedPlayerCity();
  scienceButton.title = hasFoundedPlayerCity() ? "" : "Funda tu primera ciudad para desbloquear la ciencia.";
  cultureButton.title = hasFoundedPlayerCity() ? "" : "Funda tu primera ciudad para desbloquear la cultura.";
  document.querySelector("#science-status").textContent = !hasFoundedPlayerCity()
    ? "Funda una ciudad"
    : activeTechnology
    ? `${activeTechnology.name} · +${rates.science}/turno${game.scienceReserve ? ` · reserva ${game.scienceReserve}` : ""}`
    : `+${rates.science}/turno · sin asignar${game.scienceReserve ? ` · reserva ${game.scienceReserve}` : ""}`;
  document.querySelector("#culture-status").textContent = !hasFoundedPlayerCity()
    ? "Funda una ciudad"
    : activeCivic
    ? `${activeCivic.name} · +${rates.culture}/turno`
    : `+${rates.culture}/turno · sin asignar`;
  document.querySelector("#map-caption").textContent = cities.length
    ? `${cities.length} ciudad${cities.length === 1 ? "" : "es"} en el Imperio · turno ${game.turn}`
    : "Explora y funda tu primer asentamiento.";
  document.querySelector("#status-chip").textContent = game.victory
    ? game.victory.type === "defeat" ? "DERROTA" : "VICTORIA"
    : "EN MARCHA";
  document.querySelector("#end-turn").disabled = Boolean(
    game.victory || game.turnProcessing || game.activeTurnFactionId !== game.civilization?.id
  );
  renderTutorialGuide();
  renderVictoryObjectives();
  renderDiplomacySummary();
}

function getTutorialGuideStep() {
  const cities = getPlayerCities();
  const startsWithCity = game.civilization.id === "pagan-sun";
  const total = startsWithCity ? 4 : 5;
  if (!cities.length) {
    return {
      id: "found-city",
      number: 1,
      total,
      title: "Funda tu primera ciudad",
      description: "Selecciona el colono y pulsa «Fundar ciudad». Así establecerás tu capital y desbloquearás ciencia y cultura.",
      action: "Localizar colono"
    };
  }
  if (!game.tutorialProductionAssigned) {
    return {
      id: "production",
      number: startsWithCity ? 1 : 2,
      total,
      title: "Elige qué producir",
      description: "Selecciona tu ciudad y elige una unidad o estructura en «Producir por turnos». La producción avanza al finalizar turnos.",
      action: "Seleccionar ciudad"
    };
  }
  if (!game.currentTechnology && !game.researched.length) {
    return {
      id: "science",
      number: startsWithCity ? 2 : 3,
      total,
      title: "Inicia una investigación",
      description: "Abre Ciencia y elige una tecnología disponible. La investigación es global y avanza cada turno.",
      action: "Abrir ciencia"
    };
  }
  if (!game.currentCivic && !game.adoptedCivics.length) {
    return {
      id: "culture",
      number: startsWithCity ? 3 : 4,
      total,
      title: "Elige una doctrina cultural",
      description: "Abre Cultura y adopta una política. La cultura también se acumula para toda tu civilización.",
      action: "Abrir cultura"
    };
  }
  return {
    id: "overview",
    number: total,
    total,
    title: "Explora y amplía tu territorio",
    description: "Mueve una unidad seleccionándola y pulsando una casilla alcanzable; finaliza el turno para volver a actuar. Las ciudades ganan casillas cada cinco turnos hasta un área de 9×9. Sin una unidad seleccionada, compra una casilla libre adyacente marcada con borde discontinuo por 10 de oro.",
    action: "Terminar guía"
  };
}

function renderTutorialGuide() {
  const guide = document.querySelector("#tutorial-guide");
  const step = !game.tutorialDismissed && !game.victory ? getTutorialGuideStep() : null;
  guide.hidden = !step;
  if (!step) return;
  document.querySelector("#tutorial-progress").textContent = `· PASO ${step.number}/${step.total}`;
  document.querySelector("#tutorial-title").textContent = step.title;
  document.querySelector("#tutorial-description").textContent = step.description;
  document.querySelector("#tutorial-action").textContent = step.action;
}

function handleTutorialAction() {
  const step = getTutorialGuideStep();
  if (!step) return;
  if (step.id === "found-city") {
    const settler = game.units.find((unit) =>
      getUnitFaction(unit) === game.civilization.id && game.unitTypes.get(unit.typeId)?.canFound
    );
    if (!settler) {
      showMessage("No hay ningún colono disponible para fundar una ciudad.");
      return;
    }
    game.selectedUnitId = settler.id;
    game.selectedTile = null;
    render();
    centerMapOnPositions([settler]);
    return;
  }
  if (step.id === "production") {
    const city = getPlayerCities()[0];
    if (!city) return;
    game.selectedUnitId = null;
    game.selectedTile = { x: city.x, y: city.y };
    render();
    centerMapOnPositions([city]);
    return;
  }
  if (step.id === "overview") {
    game.tutorialDismissed = true;
    renderTutorialGuide();
    saveGame();
    return;
  }
  openProgressDialog(step.id);
}

function getPendingTurnActions() {
  const actions = [];
  for (const unit of game.units) {
    if (getUnitFaction(unit) !== game.civilization.id || unit.movesLeft < 1) continue;
    const type = game.unitTypes.get(unit.typeId);
    if (type.canTrade && unit.tradeRoute) continue;
    if (unit.movesLeft < type.movement) continue;
    actions.push({
      key: `unit:${unit.id}`,
      title: `${type.name} todavía puede actuar`,
      detail: type.canFound
        ? "Puedes moverlo o fundar una ciudad."
        : type.canBuild
          ? "Puedes moverlo o construir una mejora en territorio propio."
          : `Le quedan ${unit.movesLeft} puntos de movimiento.`,
      kind: "unit",
      id: unit.id
    });
  }

  for (const city of getPlayerCities()) {
    if (!city.project && getAvailableCityProjects(city).length) {
      actions.push({
        key: `city:${city.territoryId}`,
        title: `Elegir producción para ${city.name}`,
        detail: "Puedes poner en cola una unidad o una mejora.",
        kind: "city",
        id: city.territoryId
      });
    }
  }

  if (hasFoundedPlayerCity() && !game.currentTechnology &&
      getCivilizationTechnologies().some((item) => !game.researched.includes(item.id) &&
        item.prerequisites.every((id) => game.researched.includes(id)))) {
    actions.push({
      key: "science",
      title: "Elegir una investigación",
      detail: "La ciencia está disponible, pero no hay una tecnología asignada.",
      kind: "progression"
    });
  }
  if (hasFoundedPlayerCity() && !game.currentCivic &&
      game.civics.some((item) => !game.adoptedCivics.includes(item.id) &&
        !game.blockedCivics.includes(item.id) &&
        item.prerequisites.every((id) => game.adoptedCivics.includes(id)))) {
    actions.push({
      key: "culture",
      title: "Elegir una política cultural",
      detail: "La cultura está disponible, pero no hay una política asignada.",
      kind: "progression"
    });
  }
  return actions;
}

function handleEndTurnClick() {
  if (game.victory || game.turnProcessing ||
      game.activeTurnFactionId !== game.civilization?.id) return;
  const actions = getPendingTurnActions();
  if (!actions.length) {
    endTurn();
    return;
  }
  const list = document.querySelector("#pending-actions-list");
  document.querySelector("#pending-actions-turn").textContent = String(game.turn);
  list.innerHTML = actions.map((action) => `
    <article class="pending-action">
      <div class="pending-action-copy"><strong>${escapeHtml(action.title)}</strong><span>${escapeHtml(action.detail)}</span></div>
      <button class="secondary-button" type="button" data-pending-action="${escapeHtml(action.key)}">Ir a la acción →</button>
    </article>`).join("");
  list.querySelectorAll("[data-pending-action]").forEach((button) => {
    button.addEventListener("click", () => goToPendingAction(actions.find((action) =>
      action.key === button.dataset.pendingAction
    )));
  });
  document.querySelector("#pending-actions-dialog").showModal();
}

function goToPendingAction(action) {
  if (!action) return;
  document.querySelector("#pending-actions-dialog").close();
  if (action.kind === "progression") {
    openProgressDialog(action.key);
    return;
  }

  if (action.kind === "unit") {
    const unit = game.units.find((item) => item.id === action.id);
    if (!unit) return;
    game.selectedUnitId = unit.id;
    game.selectedTile = { x: unit.x, y: unit.y };
  } else {
    const city = game.cities.find((item) => item.territoryId === action.id);
    if (!city) return;
    game.selectedUnitId = null;
    game.selectedTile = { x: city.x, y: city.y };
  }
  render();
  document.querySelector(`[data-x="${game.selectedTile.x}"][data-y="${game.selectedTile.y}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  document.querySelector("#selection-details").scrollIntoView({ behavior: "smooth", block: "center" });
}

function finishTurnDespitePendingActions() {
  if (game.turnProcessing || game.activeTurnFactionId !== game.civilization?.id) return;
  document.querySelector("#pending-actions-dialog").close();
  endTurn();
}

function getVictoryProgress() {
  const rivalCapitals = game.opponents.map((opponent) =>
    game.cities.find((city) =>
      city.isCapital && (city.originalOwnerId ?? city.ownerId) === opponent.civilization.id
    )
  );
  const capturedCapitals = rivalCapitals.filter((city) => city?.ownerId === game.civilization.id).length;
  const scienceTotal = getCivilizationTechnologies().length;
  const scienceProgress = getCivilizationTechnologies()
    .filter((technology) => game.researched.includes(technology.id)).length;
  const civicGoal = 9;
  return [
    {
      id: "science",
      title: "Victoria científica",
      description: `Completa las ${scienceTotal} investigaciones del árbol.`,
      progress: scienceProgress,
      goal: scienceTotal,
      complete: scienceTotal > 0 && scienceProgress >= scienceTotal
    },
    {
      id: "culture",
      title: "Victoria cultural",
      description: `Adopta ${civicGoal} políticas; desarrolla una ruta ideológica completa.`,
      progress: game.adoptedCivics.length,
      goal: civicGoal,
      complete: game.adoptedCivics.length >= civicGoal
    },
    {
      id: "domination",
      title: "Victoria por dominación",
      description: "Conquista y controla las capitales de todas las naciones rivales.",
      progress: capturedCapitals,
      goal: rivalCapitals.length,
      complete: rivalCapitals.length > 0 && capturedCapitals === rivalCapitals.length
    }
  ];
}

function renderVictoryObjectives() {
  const container = document.querySelector("#victory-objectives");
  if (!container) return;
  container.innerHTML = getVictoryProgress().map((objective) => {
    const percentage = Math.min(100, Math.round((objective.progress / objective.goal) * 100));
    return `<article class="victory-objective ${objective.complete ? "objective-complete" : ""}">
      <div class="victory-objective-heading">
        <strong>${escapeHtml(objective.title)}</strong>
        <span>${objective.progress}/${objective.goal}</span>
      </div>
      <p>${escapeHtml(objective.description)}</p>
      <div class="objective-progress" role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${percentage}%"></span>
      </div>
    </article>`;
  }).join("");
}

function checkVictoryConditions() {
  if (game.victory) return true;
  const completed = getVictoryProgress().find((objective) => objective.complete);
  if (completed) {
    const descriptions = {
      science: `Has completado las ${getCivilizationTechnologies().length} investigaciones disponibles para tu nación y alcanzado la supremacía científica.`,
      culture: "Tu civilización ha adoptado nueve políticas y consolidado su legado cultural.",
      domination: "Has conquistado y controlas las capitales de todas las naciones rivales."
    };
    game.victory = {
      type: completed.id,
      title: completed.title,
      description: descriptions[completed.id],
      turn: game.turn
    };
    addEvent(`${completed.title}: ${game.civilization.name} vence en el turno ${game.turn}.`);
    recordMilestone(`${completed.title}.`);
    return true;
  }

  const playerHasCities = getPlayerCities().length > 0;
  const playerHasUnits = game.units.some((unit) => getUnitFaction(unit) === game.civilization.id);
  if (!playerHasCities && !playerHasUnits) {
    game.victory = {
      type: "defeat",
      title: "Derrota",
      description: "Tu civilización ha sido eliminada: no controla ciudades ni conserva unidades.",
      turn: game.turn
    };
    addEvent(`${game.civilization.name} ha sido eliminada en el turno ${game.turn}.`);
    recordMilestone("La civilización ha sido eliminada.");
    return true;
  }

  return false;
}

function recordMilestone(title) {
  game.milestones.push({ turn: game.turn, title });
  if (game.milestones.length > 40) game.milestones.shift();
}

function renderEndgameSummary() {
  const playerCities = getPlayerCities().length;
  const playerUnits = game.units.filter((unit) =>
    getUnitFaction(unit) === game.civilization.id
  ).length;
  const technologies = getCivilizationTechnologies().filter((item) =>
    game.researched.includes(item.id)
  ).length;
  const capitals = game.opponents.map((opponent) => game.cities.find((city) =>
    city.isCapital && (city.originalOwnerId ?? city.ownerId) === opponent.civilization.id
  ));
  const capturedCapitals = capitals.filter((city) =>
    city?.ownerId === game.civilization.id
  ).length;

  document.querySelector("#endgame-turns").textContent = String(game.victory.turn);
  document.querySelector("#endgame-cities").textContent = String(playerCities);
  document.querySelector("#endgame-units").textContent = String(playerUnits);
  document.querySelector("#endgame-technologies").textContent =
    `${technologies}/${getCivilizationTechnologies().length}`;
  document.querySelector("#endgame-civics").textContent = String(game.adoptedCivics.length);
  document.querySelector("#endgame-capitals").textContent =
    `${capturedCapitals}/${game.opponents.length}`;

  const opponentsList = document.querySelector("#endgame-opponents");
  opponentsList.innerHTML = game.opponents.length
    ? game.opponents.map((opponent) => {
      const cities = game.cities.filter((city) => city.ownerId === opponent.civilization.id).length;
      const capital = game.cities.find((city) =>
        city.isCapital && (city.originalOwnerId ?? city.ownerId) === opponent.civilization.id
      );
      const status = cities === 0 ? "Eliminada"
        : capital?.ownerId === game.civilization.id ? "Capital conquistada"
        : "En pie";
      return `<li><strong>${escapeHtml(opponent.civilization.name)}</strong><span>${cities} ciudades · ${status}</span></li>`;
    }).join("")
    : "<li><strong>Partida en solitario</strong><span>Sin rivales</span></li>";

  const milestones = document.querySelector("#endgame-milestones");
  milestones.innerHTML = game.milestones.length
    ? game.milestones.slice(-8).reverse().map((item) =>
      `<li><span>Turno ${item.turn}</span>${escapeHtml(item.title)}</li>`
    ).join("")
    : "<li>Esta partida no tiene hitos históricos guardados.</li>";
}

function showVictoryDialog() {
  if (!game.victory) return;
  const dialog = document.querySelector("#victory-dialog");
  dialog.classList.toggle("is-defeat", game.victory.type === "defeat");
  document.querySelector("#victory-title").textContent = game.victory.title;
  document.querySelector("#victory-description").textContent =
    `${game.victory.description} · Turno ${game.victory.turn}.`;
  renderEndgameSummary();
  if (!dialog.open) dialog.showModal();
}

function openExitDialog() {
  if (!game.civilization || !game.tiles.length) {
    showMainMenu();
    return;
  }
  document.querySelector("#exit-turn").textContent = String(game.turn);
  document.querySelector("#exit-dialog").showModal();
}

function saveAndExitToMenu() {
  if (!saveGame()) {
    showMessage("No se pudo guardar la partida; sigues en ella.");
    return;
  }
  showMainMenu();
}

function renderDiplomacySummary() {
  const summary = document.querySelector("#diplomacy-summary");
  if (!summary) return;
  const met = game.opponents.filter((opponent) => opponent.met);
  summary.innerHTML = met.length
    ? met.map((opponent) => `
      <div class="diplomacy-mini-card">
        <span class="diplomacy-color" style="--civilization-color:${getCivilizationColor(opponent.civilization)}"></span>
        <span>${escapeHtml(opponent.civilization.name)}</span>
        <strong>${escapeHtml(getRelationLabel(opponent.relation, opponent.atWar))}</strong>
      </div>`).join("")
    : `<p class="diplomacy-empty">Aún no has establecido contacto con otras civilizaciones.</p>`;
}

function openDiplomacyDialog() {
  if (game.victory) return;
  renderDiplomacyDialog();
  document.querySelector("#diplomacy-dialog").showModal();
}

function openVictoryObjectivesDialog() {
  renderVictoryObjectives();
  document.querySelector("#victory-objectives-dialog").showModal();
}

function renderDiplomacyDialog() {
  const content = document.querySelector("#diplomacy-content");
  content.innerHTML = game.opponents.map((opponent) => {
    const cities = game.cities.filter((city) => city.ownerId === opponent.civilization.id);
    const status = opponent.met ? getRelationLabel(opponent.relation, opponent.atWar) : "Sin contacto";
    const action = opponent.met
      ? `<div class="diplomacy-actions">
            <button class="secondary-button" data-war="${escapeHtml(opponent.civilization.id)}"
              ${opponent.atWar ? "disabled" : ""}>
              Declarar la guerra
          </button>
            <button class="secondary-button" data-peace="${escapeHtml(opponent.civilization.id)}"
              ${opponent.atWar ? "" : "disabled"}>
              Proponer la paz
            </button>
            ${opponent.peaceOffered
              ? `<button class="primary-button" data-accept-peace="${escapeHtml(opponent.civilization.id)}">Aceptar oferta de paz</button>`
              : ""}
            <button class="secondary-button" data-delegate="${escapeHtml(opponent.civilization.id)}"
              ${opponent.delegationSent || opponent.atWar ? "disabled" : ""}>
              ${opponent.delegationSent ? "Delegación enviada" : "Enviar delegación · +20 relación"}
            </button>
            <button class="primary-button" data-trade="${escapeHtml(opponent.civilization.id)}"
              ${opponent.atWar || opponent.tradeTurns > 0 || opponent.relation < 15 || game.production < 5 ? "disabled" : ""}>
              ${opponent.tradeTurns > 0
                ? `Comercio activo · ${opponent.tradeTurns} turnos`
                : `Proponer comercio · 5 producción${opponent.relation < 15 ? " · relación 15+" : ""}`}
          </button>
        </div>`
      : `<p class="diplomacy-locked">Envía una unidad para explorar y encontrarte con esta civilización.</p>`;
    return `
      <article class="diplomacy-card">
        <div class="diplomacy-card-heading">
          <span class="diplomacy-color large" style="--civilization-color:${getCivilizationColor(opponent.civilization)}"></span>
          <div><h3>${escapeHtml(opponent.civilization.name)}</h3><span>${escapeHtml(status)}</span></div>
          ${opponent.met ? `<strong class="relation-score">${opponent.atWar ? "GUERRA" : `${opponent.relation > 0 ? "+" : ""}${opponent.relation}`}</strong>` : ""}
        </div>
        ${opponent.met
          ? `<p>${escapeHtml(opponent.civilization.description)} ${cities.length} ciudades conocidas.</p>
             <div class="relation-track"><span style="width:${Math.max(0, Math.min(100, (opponent.relation + 100) / 2))}%"></span></div>
             ${action}`
          : `<p class="diplomacy-locked">${escapeHtml(opponent.civilization.description)}</p>${action}`}
      </article>`;
  }).join("");

  content.querySelectorAll("[data-delegate]").forEach((button) => {
    button.addEventListener("click", () => sendDelegation(button.dataset.delegate));
  });
  content.querySelectorAll("[data-trade]").forEach((button) => {
    button.addEventListener("click", () => proposeTrade(button.dataset.trade));
  });
  content.querySelectorAll("[data-war]").forEach((button) => {
    button.addEventListener("click", () => declareWar(button.dataset.war));
  });
  content.querySelectorAll("[data-peace]").forEach((button) => {
    button.addEventListener("click", () => offerPeace(button.dataset.peace));
  });
  content.querySelectorAll("[data-accept-peace]").forEach((button) => {
    button.addEventListener("click", () => acceptPeace(button.dataset.acceptPeace));
  });
}

function getRelationLabel(relation, atWar = false) {
  if (atWar) return "En guerra";
  if (relation <= -40) return "Hostil";
  if (relation <= -10) return "Tensa";
  if (relation < 20) return "Neutral";
  if (relation < 50) return "Cordial";
  return "Amistosa";
}

function getCivilizationColor(civilization) {
  return /^#[0-9a-f]{6}$/i.test(civilization.color ?? "") ? civilization.color : "#aab8af";
}

function sendDelegation(civilizationId) {
  const opponent = game.opponents.find((item) => item.civilization.id === civilizationId);
  if (!opponent?.met || opponent.delegationSent || opponent.atWar) return;
  opponent.delegationSent = true;
  opponent.relation = Math.min(100, opponent.relation + 20);
  addEvent(`Una delegación mejora las relaciones con ${opponent.civilization.name}.`);
  renderDiplomacyDialog();
  renderDiplomacySummary();
  saveGame();
}

function proposeTrade(civilizationId) {
  const opponent = game.opponents.find((item) => item.civilization.id === civilizationId);
  if (!opponent?.met || opponent.atWar || opponent.tradeTurns > 0 || opponent.relation < 15 || game.production < 5) return;
  game.production -= 5;
  opponent.tradeTurns = 10;
  addEvent(`${opponent.civilization.name} acepta un acuerdo comercial de diez turnos.`);
  renderDiplomacyDialog();
  renderStats();
  saveGame();
}

function declareWar(civilizationId) {
  const opponent = game.opponents.find((item) => item.civilization.id === civilizationId);
  if (!opponent?.met || opponent.atWar) return;
  opponent.atWar = true;
  opponent.relation = -100;
  opponent.tradeTurns = 0;
  opponent.warTurns = 0;
  opponent.peaceOffered = false;
  addEvent(`${game.civilization.name} declara la guerra a ${opponent.civilization.name}.`);
  renderDiplomacyDialog();
  renderStats();
  saveGame();
}

function requestAttackOrder(attackerId, targetId, targetKind) {
  const attacker = game.units.find((unit) => unit.id === attackerId);
  const target = targetKind === "unit"
    ? game.units.find((unit) => unit.id === targetId)
    : game.cities.find((city) => city.territoryId === targetId);
  if (game.victory || !attacker || !target || attacker.movesLeft < 1 ||
      getUnitFaction(attacker) !== game.civilization.id) return;

  const defenderFaction = targetKind === "unit" ? getUnitFaction(target) : target.ownerId;
  if (defenderFaction === game.civilization.id ||
      getUnitStrength(game.unitTypes.get(attacker.typeId), game.civilization.id) < 1) return;
  if (isIndependentFaction(defenderFaction)) {
    moveUnitTowardCombatTarget(attacker, target, targetKind);
    return;
  }
  const opponent = game.opponents.find((item) => item.civilization.id === defenderFaction);
  if (!opponent) return;
  if (opponent.atWar) {
    moveUnitTowardCombatTarget(attacker, target, targetKind);
    return;
  }

  pendingWarOrder = { attackerId, targetId, targetKind, civilizationId: defenderFaction };
  document.querySelector("#war-confirm-title").textContent = `¿Declarar la guerra a ${opponent.civilization.name}?`;
  document.querySelector("#war-confirm-message").textContent =
    `Has ordenado a ${game.unitTypes.get(attacker.typeId).name} avanzar contra ${target.name ?? game.unitTypes.get(target.typeId).name}. Si confirmas, atacará cuando esté a alcance o avanzará hacia el objetivo.`;
  document.querySelector("#war-confirm-dialog").showModal();
}

function confirmWarAttackOrder() {
  const order = pendingWarOrder;
  pendingWarOrder = null;
  document.querySelector("#war-confirm-dialog").close();
  if (!order) return;

  const opponent = game.opponents.find((item) => item.civilization.id === order.civilizationId);
  if (!opponent) return;
  announceCivilizationContact(opponent);
  declareWar(order.civilizationId);
  const attacker = game.units.find((unit) => unit.id === order.attackerId);
  const target = order.targetKind === "unit"
    ? game.units.find((unit) => unit.id === order.targetId)
    : game.cities.find((city) => city.territoryId === order.targetId);
  if (attacker && target) moveUnitTowardCombatTarget(attacker, target, order.targetKind);
}

function offerPeace(civilizationId) {
  const opponent = game.opponents.find((item) => item.civilization.id === civilizationId);
  if (!opponent?.met || !opponent.atWar) return;
  opponent.atWar = false;
  opponent.relation = -30;
  opponent.warTurns = 0;
  opponent.peaceOffered = false;
  addEvent(`${game.civilization.name} y ${opponent.civilization.name} acuerdan un alto el fuego.`);
  renderDiplomacyDialog();
  renderStats();
  saveGame();
}

function acceptPeace(civilizationId) {
  const opponent = game.opponents.find((item) => item.civilization.id === civilizationId);
  if (!opponent?.met || !opponent.atWar || !opponent.peaceOffered) return;
  opponent.atWar = false;
  opponent.relation = -20;
  opponent.warTurns = 0;
  opponent.peaceOffered = false;
  addEvent(`${game.civilization.name} acepta la oferta de paz de ${opponent.civilization.name}.`);
  renderDiplomacyDialog();
  renderStats();
  saveGame();
}

function openProgressDialog(kind) {
  if (game.victory) return;
  if (!hasFoundedPlayerCity()) {
    showMessage("Funda tu primera ciudad para desbloquear la ciencia y la cultura.");
    return;
  }
  currentProgressionKind = kind;
  progressionBranchesVisible = false;
  renderProgressDialog(kind);
  document.querySelector("#progression-dialog").showModal();
}

function renderProgressDialog(kind) {
  const isTechnology = kind === "science";
  const catalog = isTechnology ? getCivilizationTechnologies() : game.civics;
  const completed = isTechnology ? game.researched : game.adoptedCivics;
  const progressMap = isTechnology ? game.technologyProgress : game.civicProgress;
  const currentId = isTechnology ? game.currentTechnology : game.currentCivic;
  const rates = getEmpireRates();
  const rate = isTechnology ? rates.science : rates.culture;
  const noun = isTechnology ? "ciencia" : "cultura";
  const branchToggle = document.querySelector("#toggle-progression-branches");
  branchToggle.textContent = progressionBranchesVisible ? "Ver disponibles" : "Ver ramas";
  branchToggle.setAttribute("aria-pressed", String(progressionBranchesVisible));
  document.querySelector("#progression-kicker").textContent = isTechnology ? "INVESTIGACIÓN GLOBAL" : "CULTURA GLOBAL";
  document.querySelector("#progression-title").textContent = isTechnology ? "Árbol de ciencia" : "Árbol cultural";
  document.querySelector("#progression-summary").textContent = !hasFoundedPlayerCity()
    ? "Funda tu primera ciudad para desbloquear la ciencia y la cultura."
    : isTechnology
      ? `La ciencia se acumula para toda la civilización (${rate} por turno). Las investigaciones desbloquean unidades y mejoras para todas tus ciudades.`
      : `La cultura se acumula para toda la civilización (${rate} por turno). Elige entre ramas de educación, comercio y gobierno; las ideologías excluyen su ruta rival.`;

  const availableItems = isTechnology
    ? catalog.filter((item) => !completed.includes(item.id) &&
      item.prerequisites.every((id) => completed.includes(id)))
    : catalog.filter((item) => !completed.includes(item.id) &&
      !game.blockedCivics.includes(item.id) &&
      item.prerequisites.every((id) => completed.includes(id)) &&
      !(item.exclusiveGroup && completed.some((id) =>
        catalog.find((civic) => civic.id === id)?.exclusiveGroup === item.exclusiveGroup
      )));
  const itemsToRender = progressionBranchesVisible ? catalog : availableItems;
  const cards = itemsToRender.map((item) => {
    const isComplete = completed.includes(item.id);
    const isBlocked = !isTechnology && (game.blockedCivics.includes(item.id) ||
      (item.exclusiveGroup && game.adoptedCivics.some((id) =>
        game.civics.find((civic) => civic.id === id)?.exclusiveGroup === item.exclusiveGroup
      )));
    const requirementsMet = item.prerequisites.every((id) => completed.includes(id));
    const isCurrent = currentId === item.id;
    const progress = Number(progressMap[item.id]) || 0;
    const cost = getProgressionCost(item);
    const turnsRemaining = Math.max(0, Math.ceil((cost - progress) / rate));
    const prerequisites = item.prerequisites.length
      ? `<p class="tree-requirements">${item.prerequisites.map((id) => {
        const requirement = catalog.find((entry) => entry.id === id);
        const met = completed.includes(id);
        return `<span class="${met ? "requirement-met" : ""}">${met ? "✓" : "○"} ${escapeHtml(requirement?.name ?? id)}</span>`;
      }).join("")}</p>`
      : `<p class="tree-requirements">Sin requisitos previos</p>`;
    const unlocks = isTechnology ? formatTechnologyUnlocks(item) : [];
    const effects = isTechnology ? "" : civicEffects(item);
    let actionText = "Iniciar";
    let disabled = !hasFoundedPlayerCity() || isComplete || isBlocked || !requirementsMet;
    if (isComplete) actionText = isTechnology ? "Completada" : "Adoptada";
    else if (isBlocked) actionText = "Ruta cerrada";
    else if (!requirementsMet) actionText = "Requiere anterior";
    else if (!hasFoundedPlayerCity()) actionText = "Funda tu primera ciudad";
    else if (isCurrent) {
      actionText = "Pausar";
      disabled = false;
    }

    return `<article class="tree-card ${isComplete ? "tree-complete" : ""} ${isCurrent ? "tree-current" : ""} ${isBlocked ? "tree-blocked" : ""}">
      <div class="tree-card-top"><span class="tree-node-number">${isComplete ? "✓" : escapeHtml(String(cost))}</span><div><h3>${escapeHtml(item.name)}</h3><span class="tree-cost">${cost} ${noun} · ${isComplete ? "completada" : `~${turnsRemaining} turnos`}</span></div></div>
      <p class="tree-description">${escapeHtml(item.description)}</p>
      ${prerequisites}
      ${unlocks.length ? `<div class="tree-unlocks"><strong class="tree-unlocks-label">Desbloquea</strong><ul class="tree-unlock-list">${unlocks.map((unlock) =>
        `<li class="tree-unlock-item"><span class="tree-unlock-kind">${escapeHtml(unlock.kind)}</span><strong class="tree-unlock-name">${escapeHtml(unlock.name)}</strong><span class="tree-unlock-description">${escapeHtml(unlock.description)}</span><small>${escapeHtml(unlock.details)}</small></li>`
      ).join("")}</ul></div>` : ""}
      ${effects ? `<p class="tree-unlocks">${escapeHtml(effects)}</p>` : ""}
      ${isCurrent ? `<div class="tree-progress"><span style="width:${Math.min(100, Math.round((progress / cost) * 100))}%"></span></div><small class="tree-progress-label">${progress}/${cost} ${noun}</small>` : ""}
      ${!isTechnology && item.exclusiveGroup ? `<small class="exclusive-note">${isBlocked ? "Bloqueada por otra ideología." : "Elección excluyente: cerrará la ruta ideológica rival."}</small>` : ""}
      <button class="tree-action" type="button" data-progress-kind="${kind}" data-progress-id="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""}>${actionText}</button>
    </article>`;
  });
  const content = document.querySelector("#progression-content");
  content.innerHTML = cards.length
    ? progressionBranchesVisible
      ? `<p class="branch-view-hint">Cada columna representa una etapa; los requisitos de cada ficha muestran las conexiones entre ramas.</p><div class="tree-branch-map">${groupProgressionBranches(catalog, cards).map((branch) => `
        <section class="tree-branch-column">
          <h3>${escapeHtml(branch.title)}</h3>
          <div class="tree-branch-nodes">${branch.cards.join("")}</div>
        </section>`).join("")}</div>`
      : `<div class="tree-grid">${cards.join("")}</div>`
    : `<p class="progression-empty">${isTechnology
      ? completed.length === catalog.length
        ? "Has completado todas las investigaciones disponibles."
        : "No hay investigaciones disponibles. Completa una tecnología para descubrir nuevas opciones."
      : completed.length + game.blockedCivics.length >= catalog.length
        ? "No quedan políticas disponibles. Las rutas rivales de la ideología elegida están cerradas."
        : "No hay políticas culturales disponibles. Adopta una política para descubrir nuevas opciones."}</p>`;
  content.querySelectorAll(".tree-action:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => selectProgress(button.dataset.progressKind, button.dataset.progressId));
  });
}

function groupProgressionBranches(catalog, cards) {
  const depthById = new Map();
  const findDepth = (item, visiting = new Set()) => {
    if (depthById.has(item.id)) return depthById.get(item.id);
    if (visiting.has(item.id)) return 0;
    const nextVisiting = new Set(visiting).add(item.id);
    const prerequisites = item.prerequisites
      .map((id) => catalog.find((entry) => entry.id === id))
      .filter(Boolean);
    const depth = prerequisites.length
      ? Math.max(...prerequisites.map((requirement) => findDepth(requirement, nextVisiting))) + 1
      : 0;
    depthById.set(item.id, depth);
    return depth;
  };
  catalog.forEach((item) => findDepth(item));

  const branches = [];
  for (const [index, item] of catalog.entries()) {
    const depth = depthById.get(item.id) ?? 0;
    if (!branches[depth]) {
      branches[depth] = { title: depth === 0 ? "Inicio" : `Etapa ${depth + 1}`, cards: [] };
    }
    branches[depth].cards.push(cards[index]);
  }
  return branches.filter(Boolean);
}

function civicEffects(civic) {
  const effects = [];
  if (civic.science) effects.push(`+${civic.science} ciencia/turno`);
  if (civic.culture) effects.push(`+${civic.culture} cultura/turno`);
  if (civic.production) effects.push(`+${civic.production} producción/ciudad/turno`);
  if (civic.gold) effects.push(`+${civic.gold} oro/turno`);
  return effects.join(" · ");
}

function formatTechnologyUnlocks(technology) {
  return technology.unlocks.map((unlock) => {
    if (unlock.type === "unit") {
      const unit = game.unitTypes.get(unlock.id);
      if (!unit || (unit.faction !== game.civilization.id && unit.faction !== "generic")) return null;
      const details = [];
      const strength = getUnitStrength(unit, game.civilization.id);
      if (strength > 0) details.push(`Fuerza ${strength}`);
      details.push(`Movimiento ${unit.movement}`);
      if (unit.range > 1) details.push(`Alcance ${unit.range}`);
      const materialRequirements = formatMaterialRequirements(unit);
      return {
        kind: "Unidad",
        name: unit.name,
        description: unit.description,
        details: [
          `Fabricación: ${getPlayerUnitOption(unit).cost} producción`,
          materialRequirements ? `Materiales: ${materialRequirements}` : "",
          ...details
        ].filter(Boolean).join(" · ")
      };
    }
    const building = game.buildings.find((item) => item.id === unlock.id);
    if (!building) return null;
    return {
      kind: building.placement === "territory" ? "Edificio territorial" : "Edificio",
      name: building.name,
      description: building.description,
      details: building.placement === "territory"
        ? "Construcción: requiere un constructor y no consume producción de ciudad"
        : `Coste de construcción: ${building.cost} producción`
    };
  }).filter(Boolean);
}

function selectProgress(kind, id) {
  if (game.victory) return;
  if (!hasFoundedPlayerCity()) {
    showMessage("Funda tu primera ciudad para desbloquear la ciencia y la cultura.");
    return;
  }
  const isTechnology = kind === "science";
  const currentKey = isTechnology ? "currentTechnology" : "currentCivic";
  const item = (isTechnology ? getCivilizationTechnologies() : game.civics)
    .find((entry) => entry.id === id);
  if (!item) {
    showMessage("Esa investigación no está disponible para esta civilización.");
    return;
  }
  if (!item) return;
  game[currentKey] = game[currentKey] === id ? null : id;
  if (isTechnology && game.currentTechnology === id && game.scienceReserve > 0) {
    const stored = Math.min(game.scienceReserve, getProgressionCost(item) - (Number(game.technologyProgress[id]) || 0));
    game.technologyProgress[id] = (Number(game.technologyProgress[id]) || 0) + stored;
    game.scienceReserve -= stored;
    if (stored) addEvent(`Se aplican ${stored} puntos de conocimiento de la reserva a ${item.name}.`);
  }
  addEvent(`${game[currentKey] ? "Iniciada" : "Pausada"} ${isTechnology ? "investigación" : "política"}: ${item.name}.`);
  renderProgressDialog(kind);
  renderStats();
  saveGame();
}

function createExplorationMap() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(false));
}

function announceCivilizationContact(opponent) {
  if (opponent.met) return;
  opponent.met = true;
  addEvent(`Has establecido contacto con ${opponent.civilization.name}.`);
  showMessage(`Nuevo contacto: ${opponent.civilization.name}.`);
}

function updateVisibility() {
  if (game.explored.length !== HEIGHT ||
      game.explored.some((row) => !Array.isArray(row) || row.length !== WIDTH)) {
    game.explored = createExplorationMap();
  }
  const visible = new Set();
  const revealAround = (x, y, radius) => {
    for (let tileY = Math.max(0, y - radius); tileY <= Math.min(HEIGHT - 1, y + radius); tileY += 1) {
      for (let tileX = Math.max(0, x - radius); tileX <= Math.min(WIDTH - 1, x + radius); tileX += 1) {
        const distanceX = tileX - x;
        const distanceY = tileY - y;
        if (distanceX * distanceX + distanceY * distanceY > radius * radius) continue;
        visible.add(`${tileX},${tileY}`);
        game.explored[tileY][tileX] = true;
      }
    }
  };

  for (const unit of game.units) {
    if (getUnitFaction(unit) === game.civilization.id) revealAround(unit.x, unit.y, 3);
  }
  for (const city of getPlayerCities()) revealAround(city.x, city.y, 2);
  for (const row of game.tiles) {
    for (const tile of row) {
      if (tile.territoryOwnerId !== game.civilization.id) continue;
      visible.add(`${tile.x},${tile.y}`);
      game.explored[tile.y][tile.x] = true;
    }
  }
  game.visibleTiles = visible;
  for (const opponent of game.opponents) {
    if (opponent.met) continue;
    const hasVisiblePresence = game.units.some((unit) =>
      getUnitFaction(unit) === opponent.civilization.id &&
      visible.has(`${unit.x},${unit.y}`)
    ) || game.cities.some((city) =>
      city.ownerId === opponent.civilization.id && visible.has(`${city.x},${city.y}`)
    );
    if (hasVisiblePresence) announceCivilizationContact(opponent);
  }
}

function setMapZoom(value) {
  const previousZoom = mapZoom;
  mapZoom = Math.min(2, Math.max(0.6, Math.round(value * 10) / 10));
  const input = document.querySelector("#map-zoom");
  input.value = String(mapZoom);
  document.querySelector("#zoom-level").value = `${Math.round(mapZoom * 100)} %`;
  updateMapZoom(previousZoom !== mapZoom);
}

let mapDrag = null;
let suppressMapClick = false;

function startMapDrag(event) {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  suppressMapClick = false;
  mapDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: mapViewport.scrollLeft,
    scrollTop: mapViewport.scrollTop,
    moved: false
  };
}

function moveMapDrag(event) {
  if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
  const deltaX = event.clientX - mapDrag.startX;
  const deltaY = event.clientY - mapDrag.startY;
  if (!mapDrag.moved && Math.hypot(deltaX, deltaY) < 5) return;
  mapDrag.moved = true;
  mapViewport.classList.add("is-dragging");
  mapViewport.scrollLeft = mapDrag.scrollLeft - deltaX;
  mapViewport.scrollTop = mapDrag.scrollTop - deltaY;
  event.preventDefault();
}

function endMapDrag(event) {
  if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
  suppressMapClick = mapDrag.moved;
  mapViewport.classList.remove("is-dragging");
  mapDrag = null;
}

function updateMapZoom(preserveCenter = false) {
  if (!mapViewport || document.querySelector("#game-screen").hidden) return;
  const previousWidth = mapElement.offsetWidth;
  const previousHeight = mapElement.offsetHeight;
  const centerX = mapViewport.scrollLeft + mapViewport.clientWidth / 2;
  const centerY = mapViewport.scrollTop + mapViewport.clientHeight / 2;
  const baseWidth = Math.max(mapViewport.clientWidth, WIDTH * 24);
  mapElement.style.width = `${Math.round(baseWidth * mapZoom)}px`;
  mapElement.style.setProperty("--map-zoom", mapZoom);
  if (!preserveCenter || !previousWidth || !previousHeight) return;

  const scaleX = mapElement.offsetWidth / previousWidth;
  const scaleY = mapElement.offsetHeight / previousHeight;
  mapViewport.scrollLeft = centerX * scaleX - mapViewport.clientWidth / 2;
  mapViewport.scrollTop = centerY * scaleY - mapViewport.clientHeight / 2;
}

function centerMapOnPositions(positions) {
  const tiles = positions.map((position) =>
    mapElement.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`)
  ).filter(Boolean);
  if (!tiles.length) return;

  const centerX = tiles.reduce((total, tile) => total + tile.offsetLeft + tile.offsetWidth / 2, 0) / tiles.length;
  const centerY = tiles.reduce((total, tile) => total + tile.offsetTop + tile.offsetHeight / 2, 0) / tiles.length;
  mapViewport.scrollLeft = Math.max(0, centerX - mapViewport.clientWidth / 2);
  mapViewport.scrollTop = Math.max(0, centerY - mapViewport.clientHeight / 2);
}

function addEvent(message) {
  const log = document.querySelector("#event-log");
  const item = document.createElement("li");
  item.textContent = message;
  const time = document.createElement("time");
  time.textContent = `TURNO ${game.turn}`;
  item.append(time);
  log.prepend(item);
  while (log.children.length > 20) log.lastElementChild.remove();
}

function showMessage(message, duration = 2600) {
  const toast = document.querySelector("#game-message");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(game.messageTimer);
  game.messageTimer = setTimeout(() => toast.classList.remove("visible"), duration);
}

function initializeGameAudio() {
  const volumeControl = document.querySelector("#audio-volume");
  const volumeOutput = document.querySelector("#audio-volume-value");
  const muteButton = document.querySelector("#audio-mute");
  backgroundMusic = new Audio(BACKGROUND_MUSIC_TRACKS[backgroundMusicTrackIndex]);
  backgroundMusic.loop = false;
  backgroundMusic.volume = masterAudioVolume;
  backgroundMusic.preload = "none";

  const updateAudioControls = () => {
    volumeOutput.textContent = `${Math.round(masterAudioVolume * 100)} %`;
    muteButton.textContent = audioMuted ? "Activar sonido" : "Silenciar";
    muteButton.setAttribute("aria-pressed", String(audioMuted));
  };
  const syncAudioLevels = () => {
    backgroundMusic.volume = audioMuted ? 0 : masterAudioVolume;
    if (unitAudioMasterGain && unitAudioContext) {
      unitAudioMasterGain.gain.setTargetAtTime(
        audioMuted ? 0 : masterAudioVolume,
        unitAudioContext.currentTime,
        0.02
      );
    }
  };
  const playMusic = () => {
    if (!backgroundMusicEnabled || audioMuted) return;
    backgroundMusic.play().catch((error) => {
      if (error.name === "AbortError") return;
      console.error("No se pudo reproducir la música.", error);
      showMessage(`No se pudo reproducir la música: ${error.message}`);
    });
  };
  const enableAudioOnFirstInteraction = () => {
    backgroundMusicEnabled = true;
    getUnitAudioContext();
    playMusic();
  };

  backgroundMusic.addEventListener("ended", () => {
    backgroundMusicTrackIndex = (backgroundMusicTrackIndex + 1) % BACKGROUND_MUSIC_TRACKS.length;
    backgroundMusic.src = BACKGROUND_MUSIC_TRACKS[backgroundMusicTrackIndex];
    backgroundMusic.load();
    playMusic();
  });
  volumeControl.addEventListener("input", () => {
    masterAudioVolume = Number(volumeControl.value) / 100;
    syncAudioLevels();
    updateAudioControls();
  });
  muteButton.addEventListener("click", () => {
    audioMuted = !audioMuted;
    getUnitAudioContext();
    syncAudioLevels();
    updateAudioControls();
    if (audioMuted) backgroundMusic.pause();
    else playMusic();
  });
  document.addEventListener("pointerdown", enableAudioOnFirstInteraction, { once: true });
  updateAudioControls();
}

function getUnitAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!unitAudioContext) {
    unitAudioContext = new AudioContextConstructor();
    unitAudioMasterGain = unitAudioContext.createGain();
    unitAudioMasterGain.gain.value = audioMuted ? 0 : masterAudioVolume;
    unitAudioMasterGain.connect(unitAudioContext.destination);
  }
  if (unitAudioContext.state === "suspended") {
    unitAudioContext.resume().catch((error) => {
      console.error("No se pudo activar el audio del juego.", error);
    });
  }
  return unitAudioContext;
}

function playUnitCreatedSound() {
  if (audioMuted || masterAudioVolume === 0) return;
  const context = getUnitAudioContext();
  if (!context) {
    if (!audioContextUnsupportedReported) {
      console.error("Este navegador no admite el sonido de creación de unidades.");
      audioContextUnsupportedReported = true;
    }
    return;
  }
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, start);
  oscillator.frequency.setValueAtTime(990, start + 0.1);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
  oscillator.connect(volume);
  volume.connect(unitAudioMasterGain);
  oscillator.start(start);
  oscillator.stop(start + 0.28);
}

function showLoadError(error) {
  console.error(error);
  document.querySelector("main").innerHTML = `
    <section class="load-error">
      <h1>No se pudo iniciar la partida</h1>
      <p>${escapeHtml(error.message)}</p>
      <p>No abras index.html directamente como archivo: inicia el servidor local con “Iniciar Cronotempo.bat” o usa la extensión Live Server de VS Code para que el navegador pueda cargar los XML.</p>
    </section>`;
}

function getUnitAt(x, y) {
  return game.units.find((unit) => unit.x === x && unit.y === y);
}

function getCityAt(x, y) {
  return game.cities.find((city) => city.x === x && city.y === y);
}

function getSelectedUnit() {
  return game.units.find((unit) => unit.id === game.selectedUnitId) ?? null;
}

function isSelectedTile(x, y) {
  return game.selectedTile?.x === x && game.selectedTile?.y === y;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

document.querySelector("#end-turn").addEventListener("click", handleEndTurnClick);
document.querySelector("#tutorial-action").addEventListener("click", handleTutorialAction);
document.querySelector("#tutorial-dismiss").addEventListener("click", () => {
  game.tutorialDismissed = true;
  renderTutorialGuide();
  saveGame();
});
document.querySelector("#return-menu").addEventListener("click", openExitDialog);
document.querySelector("#menu-back").addEventListener("click", showMainMenu);
document.querySelector("#zoom-out").addEventListener("click", () => setMapZoom(mapZoom - 0.1));
document.querySelector("#zoom-in").addEventListener("click", () => setMapZoom(mapZoom + 0.1));
document.querySelector("#zoom-reset").addEventListener("click", () => setMapZoom(1));
document.querySelector("#map-zoom").addEventListener("input", (event) => setMapZoom(Number(event.target.value)));
window.addEventListener("resize", updateMapZoom);
mapViewport.addEventListener("pointerdown", startMapDrag);
window.addEventListener("pointermove", moveMapDrag);
window.addEventListener("pointerup", endMapDrag);
window.addEventListener("pointercancel", endMapDrag);
mapViewport.addEventListener("click", (event) => {
  if (!suppressMapClick) return;
  suppressMapClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
document.querySelector("#open-science").addEventListener("click", () => openProgressDialog("science"));
document.querySelector("#open-culture").addEventListener("click", () => openProgressDialog("culture"));
document.querySelector("#toggle-progression-branches").addEventListener("click", () => {
  progressionBranchesVisible = !progressionBranchesVisible;
  renderProgressDialog(currentProgressionKind);
});
document.querySelector("#close-progression").addEventListener("click", () => document.querySelector("#progression-dialog").close());
document.querySelector("#open-diplomacy").addEventListener("click", openDiplomacyDialog);
document.querySelector("#close-diplomacy").addEventListener("click", () => document.querySelector("#diplomacy-dialog").close());
document.querySelector("#open-victory-objectives").addEventListener("click", openVictoryObjectivesDialog);
document.querySelector("#close-victory-objectives").addEventListener("click", () => document.querySelector("#victory-objectives-dialog").close());
document.querySelector("#confirm-war-attack").addEventListener("click", confirmWarAttackOrder);
document.querySelector("#cancel-war-attack").addEventListener("click", () => {
  pendingWarOrder = null;
  document.querySelector("#war-confirm-dialog").close();
});
document.querySelector("#victory-menu").addEventListener("click", () => {
  document.querySelector("#victory-dialog").close();
  showMainMenu();
});
document.querySelector("#save-and-exit").addEventListener("click", saveAndExitToMenu);
document.querySelector("#exit-without-saving").addEventListener("click", showMainMenu);
document.querySelector("#cancel-exit").addEventListener("click", () => document.querySelector("#exit-dialog").close());
document.querySelector("#close-pending-actions").addEventListener("click", () => document.querySelector("#pending-actions-dialog").close());
document.querySelector("#finish-turn-anyway").addEventListener("click", finishTurnDespitePendingActions);
document.querySelectorAll("[data-menu]").forEach((button) => {
  button.addEventListener("click", () => openMenuScreen(button.dataset.menu));
});

initializeGameAudio();
loadGameData().catch(showLoadError);