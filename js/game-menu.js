function renderMenuHome() {
  document.querySelector("#menu-workspace-content").innerHTML = "";
  document.querySelector("#menu-home").hidden = false;
  document.querySelector("#menu-workspace").hidden = true;
}

const SAVE_DIRECTORY_DB = "cronotempo-file-access";
const SAVE_DIRECTORY_STORE = "directories";
const SAVE_DIRECTORY_KEY = "game-saves";
const SAVE_FILE_PREFIX = "partida-";
const MAP_FILE_NAME = "mapa-personalizado.json";
const CIVILIZATION_CREATION_POINT_BUDGET = 24;
let newGameMapSelection = "pandora";
let newGameOpponentIds = null;
let savesDirectoryHandle = null;
let savesDirectoryPromise = null;
const savesWriteQueues = new Map();

function openMenuScreen(screen) {
  document.querySelector("#menu-home").hidden = true;
  const workspace = document.querySelector("#menu-workspace");
  workspace.hidden = false;
  workspace.classList.toggle("new-game-workspace", screen === "new-game");
  workspace.classList.toggle("civilization-creator-workspace", screen === "create-civilization");
  const content = document.querySelector("#menu-workspace-content");

  if (screen === "new-game") {
    const civilizations = getAvailableCivilizations();
    const savedMap = readStorage(STORAGE_KEYS.map, null);
    const hasCustomMap = isValidMap(savedMap);
    if (newGameMapSelection === "custom" && !hasCustomMap) newGameMapSelection = "pandora";
    content.innerHTML = `
      <div class="workspace-heading"><span class="eyebrow">NUEVA CRÓNICA</span><h1>Elige quién dará forma al mundo</h1>
      <p>Escoge una civilización y explora los mapas antes de comenzar. Cada mundo ofrece una geografía y una estrategia distintas.</p></div>
      <div class="new-game-layout">
        <section class="setup-card civilization-picker">
          <span class="eyebrow">TU CIVILIZACIÓN</span>
          <label class="form-field"><span>Selecciona tu pueblo</span><select id="new-game-civilization">${civilizations.map((civilization) =>
            `<option value="${escapeHtml(civilization.id)}" ${civilization.id === game.civilization.id ? "selected" : ""}>${escapeHtml(civilization.name)}</option>`
          ).join("")}</select></label>
          <article id="civilization-card" class="civilization-preview"></article>
        </section>
        <section class="setup-card map-picker">
          <span class="eyebrow">ELIGE EL MUNDO</span>
          <label class="form-field"><span>Mapa</span><select id="new-game-map">
            ${MAP_OPTIONS.map((map) => `<option value="${map.id}" ${map.id === newGameMapSelection ? "selected" : ""}>${escapeHtml(map.name)} · ${escapeHtml(map.subtitle)}</option>`).join("")}
            ${hasCustomMap ? `<option value="custom" ${newGameMapSelection === "custom" ? "selected" : ""}>Mi mapa editado · mapa personal</option>` : ""}
          </select></label>
          <div class="map-preview-frame">
            <canvas id="map-preview" width="600" height="400" role="img"></canvas>
            <span class="map-preview-caption">VISTA PREVIA · 60 × 40</span>
          </div>
          <div class="map-preview-legend"></div>
          <p id="map-description" class="map-description"></p>
        </section>
      </div>
      <section class="setup-card game-options-picker" aria-labelledby="game-options-title">
        <span class="eyebrow" id="game-options-title">OPCIONES DE PARTIDA</span>
        <div class="game-options-grid">
          <label class="form-field"><span>Civilizaciones (incluyéndote)</span><select id="new-game-player-count">
            ${[2, 3, 4].map((count) => `<option value="${count}" ${count === game.playerCount ? "selected" : ""}>${count}${count === 4 ? " · máximo" : ""}</option>`).join("")}
          </select><small>Elige entre dos y cuatro jugadores en total.</small></label>
          <label class="form-field"><span>Dificultad</span><select id="new-game-difficulty">
            ${Object.entries(AI_DIFFICULTIES).map(([id, difficulty]) =>
              `<option value="${id}" ${id === game.difficulty ? "selected" : ""}>${difficulty.name}</option>`
            ).join("")}
          </select><small id="difficulty-description"></small></label>
          <label class="game-option-toggle"><input id="new-game-barbarians" type="checkbox" ${game.barbariansEnabled ? "checked" : ""}>
            <span><strong>Campamentos bárbaros</strong><small>Activa o desactiva los campamentos bárbaros. Las aldeas élficas y enanas, y los dragones, siguen presentes.</small></span>
          </label>
        </div>
        <div class="opponent-picker">
          <div class="opponent-picker-heading"><strong>Civilizaciones rivales</strong><span>Elige quién competirá contigo.</span></div>
          <div id="new-game-opponents" class="opponent-list" role="group" aria-label="Civilizaciones rivales"></div>
          <p id="opponent-selection-status" class="opponent-selection-status" role="status" aria-live="polite"></p>
        </div>
      </section>
      <button id="start-new-game" class="primary-button new-game-start" type="button">Comenzar partida <span aria-hidden="true">→</span></button>`;
    const civilizationSelect = content.querySelector("#new-game-civilization");
    const renderCivilizationCard = () => {
      const selectedCivilization = civilizations.find((item) => item.id === civilizationSelect.value);
      if (!selectedCivilization) return;
      const uniqueContent = game.buildings
        .filter((building) => building.placement === "territory" && building.unitId)
        .map((building) => ({
          building,
          unit: game.unitTypes.get(building.unitId),
          technology: game.technologies.find((item) => item.id === building.technology)
        }))
        .filter((item) => item.unit?.faction === selectedCivilization.id);
      const cityNames = selectedCivilization.cities ?? [];
      const abilities = selectedCivilization.abilities?.descriptions ?? [];
      content.querySelector("#civilization-card").innerHTML = `
        <div class="civilization-card-heading" style="--civilization-color:${escapeHtml(selectedCivilization.color || "#d3b879")}">
          <span class="civilization-sigil" aria-hidden="true">✦</span>
          <div><span class="eyebrow">DOSSIER DE CIVILIZACIÓN</span><h2>${escapeHtml(selectedCivilization.name)}</h2></div>
        </div>
        <p class="civilization-description">${escapeHtml(selectedCivilization.description || "Una nueva civilización lista para escribir su historia.")}</p>
        <div class="civilization-card-section"><span class="eyebrow">HABILIDAD</span>
          <ul>${(abilities.length ? abilities : ["Sin habilidad especial"]).map((ability) => `<li>${escapeHtml(ability)}</li>`).join("")}</ul>
        </div>
        <div class="civilization-card-section"><span class="eyebrow">CAPITAL Y CIUDADES</span>
          <p>${cityNames.map((name) => `<span class="city-chip">${escapeHtml(name)}</span>`).join("") || "Sin ciudades registradas."}</p>
        </div>
        <div class="civilization-card-section"><span class="eyebrow">UNIDAD ÚNICA</span>
          ${uniqueContent.map(({ building, unit, technology }) => `
            <article class="unique-unit-card" style="--civilization-color:${escapeHtml(selectedCivilization.color || "#d3b879")}">
              <div class="unique-unit-heading">
                <span class="unique-unit-icon" aria-hidden="true">${escapeHtml(unit.icon)}</span>
                <div><h3>${escapeHtml(unit.name)}</h3><span>${escapeHtml(unit.role)}</span></div>
                <strong class="unique-unit-strength">⚔ ${getUnitStrength(unit, selectedCivilization.id)}</strong>
              </div>
              <p>${escapeHtml(unit.description)}</p>
              <div class="unique-unit-unlock"><span class="eyebrow">SE DESBLOQUEA CON</span>
                <strong>${escapeHtml(building.name)}</strong>
                ${technology ? `<span>${escapeHtml(technology.name)}</span>` : ""}
              </div>
            </article>`).join("") || `<p>Esta civilización no tiene una unidad única definida.</p>`}
        </div>`;
    };
    const mapSelect = content.querySelector("#new-game-map");
    const playerCountSelect = content.querySelector("#new-game-player-count");
    const difficultySelect = content.querySelector("#new-game-difficulty");
    const barbariansToggle = content.querySelector("#new-game-barbarians");
    const opponentList = content.querySelector("#new-game-opponents");
    const opponentStatus = content.querySelector("#opponent-selection-status");
    const startButton = content.querySelector("#start-new-game");
    const renderOpponentChoices = (adjustSelection = false) => {
      const selectedCivilization = civilizationSelect.value;
      const candidates = getOpponentCivilizations(selectedCivilization);
      const targetCount = Number(playerCountSelect.value) - 1;
      let selectedIds = newGameOpponentIds ?? candidates.slice(0, targetCount).map((item) => item.id);
      selectedIds = selectedIds.filter((id) => candidates.some((item) => item.id === id));
      if (adjustSelection) {
        selectedIds = selectedIds.slice(0, targetCount);
        for (const candidate of candidates) {
          if (selectedIds.length >= targetCount) break;
          if (!selectedIds.includes(candidate.id)) selectedIds.push(candidate.id);
        }
        newGameOpponentIds = selectedIds;
      }
      opponentList.innerHTML = candidates.map((candidate) => {
        const checked = selectedIds.includes(candidate.id);
        const disabled = !checked && selectedIds.length >= targetCount;
        return `<label class="opponent-option ${checked ? "opponent-option-selected" : ""} ${disabled ? "opponent-option-disabled" : ""}" style="--civilization-color:${escapeHtml(candidate.color || "#d3b879")}">
          <input type="checkbox" value="${escapeHtml(candidate.id)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <span><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.adjective || "Civilización rival")}</small></span>
        </label>`;
      }).join("");
      const complete = selectedIds.length === targetCount;
      opponentStatus.textContent = complete
        ? targetCount === 0 ? "Partida individual: no habrá rivales de civilización." :
          `${targetCount} ${targetCount === 1 ? "rival seleccionado" : "rivales seleccionados"}.`
        : `Selecciona ${targetCount} ${targetCount === 1 ? "rival" : "rivales"} para continuar.`;
      opponentStatus.classList.toggle("opponent-selection-invalid", !complete);
      startButton.disabled = !complete;
      renderMapPreview();
    };
    const renderDifficultyDescription = () => {
      content.querySelector("#difficulty-description").textContent =
        AI_DIFFICULTIES[difficultySelect.value].description;
    };
    const renderMapPreview = () => {
      const mapId = mapSelect.value;
      const definition = MAP_OPTIONS.find((map) => map.id === mapId);
      const canvas = content.querySelector("#map-preview");
      const context = canvas.getContext("2d");
      const randomMap = mapId === "random";
      const tiles = randomMap ? null : mapId === "custom"
        ? resizeMapToWorld(savedMap)
        : generateMapTiles(mapId, 928374);
      const selectedCivilization = civilizations.find((item) => item.id === civilizationSelect.value);
      const selectedRivals = (newGameOpponentIds ?? []).map((id) =>
        game.civilizations.find((item) => item.id === id)
      ).filter(Boolean);
      const selectedCivilizations = [selectedCivilization, ...selectedRivals].filter(Boolean);
      if (randomMap) {
        context.fillStyle = "#05090b";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#e4d39e";
        context.font = "bold 120px Georgia, serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("?", canvas.width / 2, canvas.height / 2);
      } else {
        if (mapId === "pandora") createNorthernIslands(tiles, mapId);
        applySharedMapFeatures(mapId, tiles);
        drawMapPreview(context, canvas, tiles, selectedCivilizations);
        drawDragonLairPreview(context, canvas, mapId);
      }
      const legend = content.querySelector(".map-preview-legend");
      legend.innerHTML = [
        ...selectedCivilizations.map((civilization) =>
          `<span><i style="--civilization-color:${escapeHtml(civilization.color || "#ecd39a")}"></i>${escapeHtml(civilization.name)}</span>`
        ),
        "<span><i style=\"--civilization-color:#39233c\"></i>Abismo</span>",
        '<span><i class="map-preview-dragon-key">♨</i>Guarida del dragón</span>'
      ].join("");
      legend.hidden = randomMap;
      canvas.setAttribute("aria-label", randomMap
        ? "Vista previa aleatoria oculta; se mostrará al comenzar la partida."
        : `Vista previa del mapa ${definition?.name ?? "personalizado"}, con el Abismo y la guarida del Dragón ancestral.`);
      content.querySelector(".map-preview-caption").textContent = randomMap
        ? "MUNDO ALEATORIO · SE REVELA AL EMPEZAR"
        : `VISTA PREVIA · ${tiles[0].length} × ${tiles.length}`;
      content.querySelector("#map-description").textContent =
        mapId === "custom" ? "Tu mapa creado en el editor, con una zona del Abismo y una guarida de dragón al norte." :
          `${definition?.subtitle ?? ""}. ${definition?.description ?? ""}`;
    };
    civilizationSelect.addEventListener("change", () => {
      renderCivilizationCard();
      renderOpponentChoices(true);
    });
    mapSelect.addEventListener("change", () => {
      newGameMapSelection = mapSelect.value;
      renderMapPreview();
    });
    playerCountSelect.addEventListener("change", () => {
      game.playerCount = Number(playerCountSelect.value);
      renderOpponentChoices(true);
    });
    difficultySelect.addEventListener("change", () => {
      game.difficulty = difficultySelect.value;
      renderDifficultyDescription();
    });
    barbariansToggle.addEventListener("change", () => {
      game.barbariansEnabled = barbariansToggle.checked;
    });
    opponentList.addEventListener("change", () => {
      newGameOpponentIds = [...opponentList.querySelectorAll('input[type="checkbox"]:checked')]
        .map((input) => input.value);
      renderOpponentChoices();
    });
    renderCivilizationCard();
    renderDifficultyDescription();
    renderOpponentChoices(true);
    startButton.addEventListener("click", () => {
      const civilization = civilizations.find((item) => item.id === content.querySelector("#new-game-civilization").value);
      if (!civilization) {
        showMessage("No se encontró la civilización seleccionada.");
        return;
      }
      const mapChoice = content.querySelector("#new-game-map").value;
      const mapData = mapChoice === "custom" ? savedMap : mapChoice;
      startNewGame(civilization, mapData, {
        playerCount: Number(playerCountSelect.value),
        barbariansEnabled: barbariansToggle.checked,
        difficulty: difficultySelect.value,
        opponentIds: newGameOpponentIds
      });
    });
    return;
  }

  if (screen === "map-editor") {
    openMapEditor(content);
    return;
  }

  if (screen === "load-game") {
    renderSavedGames(content);
    return;
  }

  if (screen === "create-civilization") {
    renderCivilizationForm(content);
  }
}

function drawMapPreview(context, canvas, tiles, civilizations = getAvailableCivilizations()) {
  const colors = {
    grass: "#8eae72", plains: "#b5a36d", forest: "#3e7659", hills: "#aa9267",
    water: "#4b858b", mountain: "#a5a18e", desert: "#bc8757", abyss: "#39233c"
  };
  const tileWidth = canvas.width / tiles[0].length;
  const tileHeight = canvas.height / tiles.length;
  const mapId = document.querySelector("#new-game-map").value;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const row of tiles) {
    for (const tile of row) {
      context.fillStyle = colors[tile.type] ?? colors.water;
      context.fillRect(tile.x * tileWidth, tile.y * tileHeight, Math.ceil(tileWidth), Math.ceil(tileHeight));
    }
  }
  for (const civilization of civilizations) {
    const start = getMapStartPosition(civilization, mapId === "custom" ? "pandora" : mapId);
    const x = (start.x + .5) * tileWidth;
    const y = (start.y + .5) * tileHeight;
    context.beginPath();
    context.arc(x, y, Math.max(4, tileWidth * 1.5), 0, Math.PI * 2);
    context.fillStyle = civilization.color || "#ecd39a";
    context.fill();
    context.strokeStyle = "#10191c";
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawDragonLairPreview(context, canvas, mapId) {
  const lair = getNorthernDragonLairPosition(mapId);
  const tileWidth = canvas.width / WIDTH;
  const tileHeight = canvas.height / HEIGHT;
  const x = (lair.x + .5) * tileWidth;
  const y = (lair.y + .5) * tileHeight;
  context.beginPath();
  context.arc(x, y, Math.max(5, tileWidth * 1.1), 0, Math.PI * 2);
  context.fillStyle = "#6b332f";
  context.fill();
  context.strokeStyle = "#f0bc78";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#fff0d0";
  context.font = `bold ${Math.max(8, tileWidth * 1.2)}px Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("♨", x, y);
}

function showMainMenu() {
  const exitDialog = document.querySelector("#exit-dialog");
  if (exitDialog.open) exitDialog.close();
  document.querySelector("#game-screen").hidden = true;
  document.querySelector("#main-menu").hidden = false;
  renderMenuHome();
}

function getAvailableCivilizations() {
  const custom = readStorage(STORAGE_KEYS.civilizations, []);
  return [...game.civilizations, ...custom].filter((civilization) =>
    civilization?.id && civilization.playable !== false && civilization.independent !== true
  );
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`No se pudo leer el almacenamiento local (${key}).`, error);
    throw new Error("No se pudieron leer los datos guardados en este navegador.");
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`No se pudieron guardar los datos (${key}).`, error);
    showMessage("No se pudieron guardar los datos. Comprueba el espacio disponible del navegador.");
    return false;
  }
}

function isValidMap(map) {
  return Array.isArray(map) && map.length > 0 &&
    map.every((row) => Array.isArray(row) && row.length === map[0].length && row.length > 0 &&
      row.every((tile) => tile && TERRAIN[tile.type]));
}

function resizeMapToWorld(map) {
  if (!isValidMap(map)) throw new Error("El mapa no tiene un formato válido.");
  const sourceMaxX = map[0].length - 1;
  const sourceMaxY = map.length - 1;
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const sourceY = Math.round((y / (HEIGHT - 1)) * sourceMaxY);
      const sourceX = Math.round((x / (WIDTH - 1)) * sourceMaxX);
      return { ...map[sourceY][sourceX], x, y };
    })
  );
}

function openMapEditor(container) {
  const savedMap = readStorage(STORAGE_KEYS.map, null);
  if (isValidMap(savedMap)) {
    editorTiles = resizeMapToWorld(savedMap);
  } else {
    createWorld(false);
    editorTiles = game.tiles.map((row) => row.map((tile) => ({ ...tile })));
  }

  container.innerHTML = `
    <div class="workspace-heading"><span class="eyebrow">TALLER DE CARTOGRAFÍA</span><h1>Edita tu mapa</h1>
    <p>Elige un terreno y pulsa las casillas para pintar el mundo. El Abismo se conserva en las partidas personalizadas y puede albergar bestias. Guarda el diseño o comienza una partida en él.</p></div>
    <div class="editor-toolbar"><label class="form-field"><span>Terreno para pintar</span><select id="editor-terrain">${Object.entries(TERRAIN).map(([id, terrain]) =>
      `<option value="${id}">${escapeHtml(terrain.name)}</option>`).join("")}</select></label>
      <div class="editor-actions"><button id="save-map" class="secondary-button" type="button">Guardar mapa</button>
      <button id="import-map" class="secondary-button" type="button">Importar mapa</button>
      <input id="import-map-file" type="file" accept=".json,application/json" hidden>
      <button id="play-edited-map" class="primary-button" type="button">Jugar en este mapa →</button></div></div>
    <div class="editor-map-wrap"><div id="editor-map" class="game-map editor-map" role="grid" aria-label="Editor de mapa"></div></div>
    ${renderSaveDirectoryControls("map-editor")}`;
  const map = container.querySelector("#editor-map");
  map.style.gridTemplateColumns = `repeat(${WIDTH}, minmax(24px, 1fr))`;
  map.style.minWidth = `${WIDTH * 24}px`;
  editorTerrain = container.querySelector("#editor-terrain").value;
  container.querySelector("#editor-terrain").addEventListener("change", (event) => {
    editorTerrain = event.target.value;
  });
  container.querySelector("#save-map").addEventListener("click", () => {
    if (!writeStorage(STORAGE_KEYS.map, editorTiles)) return;
    persistMapFile(editorTiles);
    showMessage("Mapa guardado. Se sincronizará con la carpeta saves si está conectada.");
  });
  const mapFileInput = container.querySelector("#import-map-file");
  container.querySelector("#import-map").addEventListener("click", () => mapFileInput.click());
  mapFileInput.addEventListener("change", async () => {
    const [file] = mapFileInput.files;
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const tiles = Array.isArray(imported) ? imported : imported.tiles;
      if (!isValidMap(tiles)) throw new Error("El archivo no contiene un mapa válido.");
      const resizedTiles = resizeMapToWorld(tiles);
      if (!writeStorage(STORAGE_KEYS.map, resizedTiles)) return;
      editorTiles = resizedTiles;
      persistMapFile(editorTiles);
      renderEditorMap(map);
      showMessage("Mapa importado y guardado en este navegador.");
    } catch (error) {
      console.error("No se pudo importar el mapa.", error);
      showMessage(`No se pudo importar el mapa: ${error.message}`);
    } finally {
      mapFileInput.value = "";
    }
  });
  container.querySelector("#play-edited-map").addEventListener("click", () => {
    if (!writeStorage(STORAGE_KEYS.map, editorTiles)) return;
    persistMapFile(editorTiles);
    newGameMapSelection = "custom";
    openMenuScreen("new-game");
  });
  attachSaveDirectoryButton(container);

  renderEditorMap(map);
}

function renderEditorMap(map) {
  map.replaceChildren();
  for (const row of editorTiles) {
    for (const tile of row) {
      const button = createTerrainTile(tile, false);
      button.addEventListener("click", () => {
        tile.type = editorTerrain;
        renderEditorMap(map);
      });
      map.append(button);
    }
  }
}

function renderSavedGames(container) {
  const saves = readStorage(STORAGE_KEYS.games, []);
  container.innerHTML = `
    <div class="workspace-heading"><span class="eyebrow">ARCHIVO DE CRÓNICAS</span><h1>Cargar partida</h1>
    <p>Las partidas se guardan automáticamente. Puedes sincronizarlas como archivos JSON en la carpeta <code>saves</code> del proyecto.</p></div>
    ${renderSaveDirectoryControls("load-games")}
    <div class="save-archive-actions">
      <p class="storage-note">Descarga una copia para conservarla o trasladarla a otro navegador.</p>
      <button id="import-saves" class="secondary-button" type="button">Importar partidas</button>
      <input id="import-saves-files" type="file" accept=".json,application/json" multiple hidden>
      <button id="export-all-saves" class="secondary-button" type="button" ${saves.length ? "" : "disabled"}>Exportar todos los guardados</button>
    </div>
    <div class="saved-games">${saves.length ? saves.map((save) => `
      <article class="save-card"><div><span class="eyebrow">TURNO ${Number(save.turn) || 1}</span><h2>${escapeHtml(save.civilization?.name ?? "Civilización desconocida")}</h2>
      <p>${Number(save.cities?.length) || 0} ciudades · Guardada ${escapeHtml(new Date(save.savedAt).toLocaleString("es-ES"))}</p></div>
      <div class="save-card-actions"><button class="primary-button" data-load-save="${escapeHtml(save.saveId)}" type="button">Continuar →</button>
      <button class="secondary-button" data-export-save="${escapeHtml(save.saveId)}" type="button">Exportar</button>
      <button class="secondary-button delete-save-button" data-delete-save="${escapeHtml(save.saveId)}" type="button">Borrar</button></div></article>`).join("") :
      `<p class="empty-message">Todavía no hay partidas guardadas. Inicia una nueva crónica para comenzar.</p>`}</div>`;
  const saveFilesInput = container.querySelector("#import-saves-files");
  container.querySelector("#import-saves").addEventListener("click", () => saveFilesInput.click());
  saveFilesInput.addEventListener("change", async () => {
    const files = [...saveFilesInput.files];
    if (!files.length) return;
    try {
      const imports = [];
      for (const file of files) imports.push(JSON.parse(await file.text()));
      const importedSaves = imports.flatMap((data) => {
        if (data?.format === "cronotempo-saves" && data.version === 1 && Array.isArray(data.saves)) {
          return data.saves;
        }
        return [data];
      });
      if (!importedSaves.length || importedSaves.some((save) => !isValidSave(save))) {
        throw new Error("El archivo no contiene una partida válida o un archivo de guardados compatible.");
      }
      const mergedSaves = readStorage(STORAGE_KEYS.games, []);
      for (const save of importedSaves) {
        const existingIndex = mergedSaves.findIndex((entry) => entry.saveId === save.saveId);
        if (existingIndex >= 0) mergedSaves.splice(existingIndex, 1);
        mergedSaves.push(save);
      }
      mergedSaves.sort((first, second) =>
        String(second.savedAt ?? "").localeCompare(String(first.savedAt ?? ""))
      );
      if (!writeStorage(STORAGE_KEYS.games, mergedSaves.slice(0, 10))) return;
      for (const save of importedSaves) persistSaveFile(save);
      renderSavedGames(container);
      showMessage(`${importedSaves.length} partida${importedSaves.length === 1 ? "" : "s"} importada${importedSaves.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("No se pudieron importar las partidas.", error);
      showMessage(`No se pudieron importar las partidas: ${error.message}`);
    } finally {
      saveFilesInput.value = "";
    }
  });
  container.querySelector("#export-all-saves").addEventListener("click", () => {
    downloadSavedGames(saves);
  });
  container.querySelectorAll("[data-export-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const save = saves.find((entry) => entry.saveId === button.dataset.exportSave);
      if (!save) {
        showMessage("No se pudo encontrar esa partida guardada.");
        return;
      }
      downloadSavedGame(save);
    });
  });
  container.querySelectorAll("[data-load-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const save = saves.find((entry) => entry.saveId === button.dataset.loadSave);
      if (!save) {
        showMessage("No se pudo encontrar esa partida guardada.");
        return;
      }
      restoreGame(save);
    });
  });
  container.querySelectorAll("[data-delete-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const saveId = button.dataset.deleteSave;
      const save = readStorage(STORAGE_KEYS.games, []).find((entry) => entry.saveId === saveId);
      if (!save) {
        showMessage("No se pudo encontrar esa partida guardada.");
        renderSavedGames(container);
        return;
      }
      if (!window.confirm(`¿Borrar la partida de ${save.civilization?.name ?? "esta civilización"} del turno ${Number(save.turn) || 1}? Esta acción no se puede deshacer.`)) return;
      const currentSaves = readStorage(STORAGE_KEYS.games, []);
      if (writeStorage(STORAGE_KEYS.games, currentSaves.filter((entry) => entry.saveId !== saveId))) {
        deleteSaveFile(saveId);
        renderSavedGames(container);
        showMessage("Partida guardada borrada.");
      }
    });
  });
}

function isValidSave(save) {
  return Boolean(save && typeof save.saveId === "string" && save.saveId &&
    save.civilization && typeof save.civilization.id === "string" &&
    Array.isArray(save.tiles) && save.tiles.length > 0 &&
    save.tiles.every((row) => Array.isArray(row) && row.length === save.tiles[0].length &&
      row.length > 0 && row.every((tile) => tile && TERRAIN[tile.type])) &&
    Array.isArray(save.units) && Array.isArray(save.cities));
}

function downloadSavedGame(save) {
  const civilization = save.civilization?.name ?? "cronica";
  const filename = `cronotempo-${sanitizeDownloadFilename(civilization)}-turno-${Number(save.turn) || 1}.json`;
  downloadJsonFile(filename, save);
}

function downloadSavedGames(saves) {
  const exportedData = {
    format: "cronotempo-saves",
    version: 1,
    exportedAt: new Date().toISOString(),
    saves
  };
  downloadJsonFile(`cronotempo-guardados-${new Date().toISOString().slice(0, 10)}.json`, exportedData);
}

function downloadJsonFile(filename, data) {
  try {
    const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage(`Descarga iniciada: ${filename}`);
  } catch (error) {
    console.error("No se pudo exportar la partida guardada.", error);
    showMessage(`No se pudo exportar el guardado: ${error.message}`);
  }
}

function sanitizeDownloadFilename(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "cronica";
}

function renderSaveDirectoryControls(id) {
  const supported = typeof window.showDirectoryPicker === "function";
  const status = savesDirectoryHandle
    ? "Carpeta saves conectada. Las partidas y el mapa personalizado se sincronizan automáticamente."
    : supported
      ? "Elige la carpeta del proyecto; se creará o utilizará su subcarpeta saves."
      : "Este navegador no permite acceso directo a carpetas; el juego seguirá guardando en este navegador.";
  return `<div class="save-directory-controls">
    <p class="storage-note">${escapeHtml(status)}</p>
    <button id="connect-saves-${id}" class="secondary-button" type="button" ${supported ? "" : "disabled"}>
      ${savesDirectoryHandle ? "Cambiar carpeta saves" : "Conectar carpeta saves"}
    </button>
  </div>`;
}

function attachSaveDirectoryButton(container) {
  const button = container.querySelector("[id^='connect-saves-']");
  if (!button) return;
  const status = button.parentElement.querySelector(".storage-note");
  getSavesDirectoryHandle().then((directory) => {
    if (!directory || !button.isConnected) return;
    status.textContent = "Carpeta saves conectada. Las partidas y el mapa personalizado se sincronizan automáticamente.";
    button.textContent = "Cambiar carpeta saves";
  });
  button.addEventListener("click", async () => {
    try {
      await connectSavesDirectory();
      showMessage("Carpeta saves conectada. Los archivos existentes se han sincronizado.");
      const currentScreen = button.id.endsWith("map-editor") ? "map-editor" : "load-game";
      openMenuScreen(currentScreen);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("No se pudo conectar la carpeta saves.", error);
      showMessage(`No se pudo conectar la carpeta saves: ${error.message}`);
    }
  });
}

async function connectSavesDirectory() {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("Tu navegador no admite acceso directo a carpetas.");
  }
  const projectDirectory = await window.showDirectoryPicker({ mode: "readwrite" });
  const directory = await projectDirectory.getDirectoryHandle("saves", { create: true });
  const permission = await directory.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("No se concedió permiso de escritura.");
  savesDirectoryHandle = directory;
  await storeSavesDirectoryHandle(directory);
  await importSavesDirectory();
  await synchronizeLocalDataToSaves();
}

async function getSavesDirectoryHandle() {
  if (savesDirectoryHandle) return savesDirectoryHandle;
  if (!savesDirectoryPromise) {
    savesDirectoryPromise = loadSavesDirectoryHandle()
      .then(async (handle) => {
        if (!handle) return null;
        const permission = await handle.queryPermission({ mode: "readwrite" });
        if (permission !== "granted") return null;
        savesDirectoryHandle = handle;
        return handle;
      })
      .catch((error) => {
        console.error("No se pudo recuperar el acceso a la carpeta saves.", error);
        return null;
      });
  }
  return savesDirectoryPromise;
}

function openSaveDirectoryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVE_DIRECTORY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SAVE_DIRECTORY_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la base de permisos."));
  });
}

async function storeSavesDirectoryHandle(handle) {
  const database = await openSaveDirectoryDatabase();
  try {
    await new Promise((resolve, reject) => {
      const request = database.transaction(SAVE_DIRECTORY_STORE, "readwrite")
        .objectStore(SAVE_DIRECTORY_STORE).put(handle, SAVE_DIRECTORY_KEY);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error ?? new Error("No se pudo recordar la carpeta."));
    });
  } finally {
    database.close();
  }
}

async function loadSavesDirectoryHandle() {
  const database = await openSaveDirectoryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(SAVE_DIRECTORY_STORE, "readonly")
        .objectStore(SAVE_DIRECTORY_STORE).get(SAVE_DIRECTORY_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("No se pudo recuperar la carpeta."));
    });
  } finally {
    database.close();
  }
}

async function writeSavesFile(filename, data) {
  const directory = await getSavesDirectoryHandle();
  if (!directory) return false;
  const permission = await directory.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    throw new Error("El permiso de la carpeta ha caducado. Conéctala de nuevo desde el menú.");
  }
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(JSON.stringify(data, null, 2));
  } catch (error) {
    await writable.abort();
    throw error;
  }
  await writable.close();
  return true;
}

function queueSavesFileWrite(filename, data) {
  const previous = savesWriteQueues.get(filename) ?? Promise.resolve();
  const write = previous.catch(() => {})
    .then(() => writeSavesFile(filename, data));
  savesWriteQueues.set(filename, write);
  const clearQueue = () => {
    if (savesWriteQueues.get(filename) === write) savesWriteQueues.delete(filename);
  };
  write.then(clearQueue, clearQueue);
  return write;
}

async function persistSaveFile(save) {
  try {
    const safeId = String(save.saveId).replace(/[^a-zA-Z0-9_-]/g, "-");
    await queueSavesFileWrite(`${SAVE_FILE_PREFIX}${safeId}.json`, save);
  } catch (error) {
    console.error("No se pudo escribir el archivo de la partida.", error);
    showMessage(`No se pudo sincronizar la partida en saves: ${error.message}`);
  }
}

async function deleteSaveFile(saveId) {
  try {
    const directory = await getSavesDirectoryHandle();
    if (!directory) return;
    const safeId = String(saveId).replace(/[^a-zA-Z0-9_-]/g, "-");
    await directory.removeEntry(`${SAVE_FILE_PREFIX}${safeId}.json`);
  } catch (error) {
    if (error.name !== "NotFoundError") {
      console.error("No se pudo borrar el archivo de la partida.", error);
      showMessage(`La partida se quitó del navegador, pero no de saves: ${error.message}`);
    }
  }
}

async function persistMapFile(tiles) {
  try {
    await queueSavesFileWrite(MAP_FILE_NAME, { tiles, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("No se pudo escribir el archivo del mapa.", error);
    showMessage(`No se pudo sincronizar el mapa en saves: ${error.message}`);
  }
}

async function importSavesDirectory() {
  const directory = await getSavesDirectoryHandle();
  if (!directory) return;
  const saves = readStorage(STORAGE_KEYS.games, []);
  const maps = [];
  for await (const [filename, handle] of directory.entries()) {
    if (handle.kind !== "file" ||
        (!filename.startsWith(SAVE_FILE_PREFIX) && filename !== MAP_FILE_NAME)) continue;
    const file = await handle.getFile();
    const data = JSON.parse(await file.text());
    if (filename === MAP_FILE_NAME) {
      if (!isValidMap(data.tiles)) throw new Error(`${filename} no contiene un mapa válido.`);
      maps.push(data.tiles);
    } else {
      if (!data.saveId || !data.civilization || !Array.isArray(data.tiles)) {
        throw new Error(`${filename} no contiene una partida válida.`);
      }
      const existingIndex = saves.findIndex((entry) => entry.saveId === data.saveId);
      if (existingIndex >= 0) saves.splice(existingIndex, 1);
      saves.push(data);
    }
  }
  saves.sort((first, second) => String(second.savedAt ?? "").localeCompare(String(first.savedAt ?? "")));
  if (!writeStorage(STORAGE_KEYS.games, saves.slice(0, 10))) {
    throw new Error("No se pudieron importar las partidas al almacenamiento del navegador.");
  }
  if (maps.length && !writeStorage(STORAGE_KEYS.map, maps[0])) {
    throw new Error("No se pudo importar el mapa al almacenamiento del navegador.");
  }
}

async function synchronizeLocalDataToSaves() {
  for (const save of readStorage(STORAGE_KEYS.games, [])) {
    await queueSavesFileWrite(`${SAVE_FILE_PREFIX}${String(save.saveId).replace(/[^a-zA-Z0-9_-]/g, "-")}.json`, save);
  }
  const map = readStorage(STORAGE_KEYS.map, null);
  if (isValidMap(map)) await queueSavesFileWrite(MAP_FILE_NAME, { tiles: map, savedAt: new Date().toISOString() });
}

function renderCivilizationForm(container) {
  const unitOptions = [...game.unitTypes.values()].sort((first, second) =>
    first.name.localeCompare(second.name, "es")
  );
  const genericUnitOptions = unitOptions.filter((unit) => unit.faction === "generic");
  container.innerHTML = `
    <div class="workspace-heading"><span class="eyebrow">CREADOR DE CIVILIZACIONES</span><h1>Imagina un nuevo pueblo</h1>
    <p>Define su identidad, capital, unidades iniciales y ventajas. La civilización quedará disponible para tus próximas partidas.</p>
    <button id="import-civilization" class="secondary-button" type="button">Importar civilización XML</button>
    <input id="import-civilization-file" type="file" accept=".xml,application/xml,text/xml" hidden></div>
    <div class="civilization-creator-layout">
    <form id="civilization-form" class="civilization-form">
      <fieldset class="civilization-editor-section"><legend>Identidad</legend>
        <div class="civilization-form-grid">
          <label class="form-field"><span>Nombre de la civilización</span><input name="name" maxlength="48" required placeholder="Ej. La Liga de las Estrellas"></label>
          <label class="form-field"><span>Adjetivo</span><input name="adjective" maxlength="32" required placeholder="Ej. Estelar"></label>
          <label class="form-field color-field"><span>Color de estandarte</span><span class="color-input-wrap"><input name="color" type="color" value="#d3b879" required><output data-color-value>#d3b879</output></span></label>
          <label class="form-field"><span>Agresividad diplomática <small>0–100</small></span><input name="aggression" type="number" min="0" max="100" step="1" value="35" required><input class="range-input" data-range-for="aggression" type="range" min="0" max="100" step="1" value="35" aria-label="Nivel de agresividad"></label>
          <label class="form-field civilization-field-wide"><span>Descripción</span><textarea name="description" maxlength="240" rows="3" required placeholder="Historia, cultura y propósito de esta nación"></textarea></label>
        </div>
      </fieldset>
      <fieldset class="civilization-editor-section"><legend>Ciudades</legend>
        <label class="form-field"><span>Capital</span><input name="capital" maxlength="40" required placeholder="Nombre de la capital"></label>
        <label class="form-field"><span>Otras ciudades <small>Separadas por comas</small></span><input name="cities" maxlength="400" placeholder="Puerto del Alba, Ciudadela Estelar, ..."></label>
      </fieldset>
      <fieldset class="civilization-editor-section"><legend>Unidades y expansión</legend>
        <div class="form-field"><span>Unidades iniciales <small>Elige al menos una e incluye una unidad fundadora</small></span>
          <div class="civilization-unit-options">${unitOptions.map((unit) => `
            <label class="civilization-unit-option"><input name="startingUnits" type="checkbox" value="${escapeHtml(unit.id)}" ${unit.id === "settler" ? "checked" : ""}>
              <i class="civilization-unit-icon" aria-hidden="true">${escapeHtml(unit.icon)}</i><span><strong>${escapeHtml(unit.name)}</strong><small>${escapeHtml(unit.role)}${unit.canFound ? " · funda ciudades" : ""}</small></span><b class="unit-point-cost">${getCivilizationUnitPointCost(unit)} pts</b></label>`).join("")}</div>
        </div>
        <div class="form-field"><span>Unidades adicionales disponibles para producir desde el inicio</span>
          <div class="civilization-unit-options">${genericUnitOptions.map((unit) => `
            <label class="civilization-unit-option"><input name="availableUnits" type="checkbox" value="${escapeHtml(unit.id)}">
              <i class="civilization-unit-icon" aria-hidden="true">${escapeHtml(unit.icon)}</i><span><strong>${escapeHtml(unit.name)}</strong><small>${escapeHtml(unit.role)} · genérica</small></span><b class="unit-point-cost">${getCivilizationUnitPointCost(unit)} pts</b></label>`).join("")}</div>
        </div>
        <label class="civilization-checkbox"><input name="canFoundSettlers" type="checkbox" checked>
          <span>Puede producir colonos y fundar ciudades normalmente</span></label>
      </fieldset>
      <fieldset class="civilization-editor-section"><legend>Rasgos y habilidad pasiva</legend>
        <p class="civilization-points-note">Los modificadores numéricos consumen puntos según su ventaja. La habilidad única escrita es descriptiva y no aplica un efecto automático.</p>
        <label class="form-field"><span>Habilidad única</span><textarea name="passive" maxlength="220" rows="2" required placeholder="Ej. Sus unidades resisten mejor en las montañas"></textarea></label>
        <div class="civilization-trait-grid">
          <label class="civilization-trait-card"><span class="trait-icon" aria-hidden="true">⚒</span><span class="trait-copy"><strong>Producción</strong><small>Coste de unidades</small></span><input name="unitProductionMultiplier" type="number" min="0.25" max="3" step="0.05" value="1" required><small data-trait-cost="unitProductionMultiplier"></small></label>
          <label class="civilization-trait-card"><span class="trait-icon" aria-hidden="true">◈</span><span class="trait-copy"><strong>Compra</strong><small>Coste en oro</small></span><input name="unitPurchaseMultiplier" type="number" min="0.25" max="3" step="0.05" value="1" required><small data-trait-cost="unitPurchaseMultiplier"></small></label>
          <label class="civilization-trait-card"><span class="trait-icon" aria-hidden="true">⚔</span><span class="trait-copy"><strong>Fuerza</strong><small>Poder militar</small></span><input name="unitStrengthMultiplier" type="number" min="0.25" max="3" step="0.05" value="1" required><small data-trait-cost="unitStrengthMultiplier"></small></label>
          <label class="civilization-trait-card"><span class="trait-icon" aria-hidden="true">✧</span><span class="trait-copy"><strong>Conocimiento</strong><small>Coste ciencia/cultura</small></span><input name="progressionCostMultiplier" type="number" min="0.25" max="3" step="0.05" value="1" required><small data-trait-cost="progressionCostMultiplier"></small></label>
        </div>
      </fieldset>
      <div id="civilization-point-status" class="civilization-point-status" role="status" aria-live="polite">
        <div class="point-status-heading"><span>Presupuesto de creación</span><strong data-point-count></strong></div>
        <div class="point-meter" role="meter" aria-label="Puntos de creación" aria-valuemin="0" aria-valuemax="24"><span data-point-fill></span></div>
        <div class="point-status-breakdown"><span data-point-breakdown></span><small data-point-hint></small></div>
      </div>
      <button id="create-civilization-submit" class="primary-button" type="submit">Crear civilización <span aria-hidden="true">→</span></button>
    </form>
    <aside class="civilization-live-preview" aria-label="Vista previa de la civilización">
      <div class="preview-banner" data-preview-banner>
        <span class="preview-sigil">✦</span>
        <span class="eyebrow">ESTANDARTE</span>
        <strong data-preview-name>Nueva civilización</strong>
        <small data-preview-adjective>Tu pueblo</small>
      </div>
      <div class="preview-body">
        <span class="eyebrow">CRÓNICA</span>
        <p data-preview-description>La historia de tu civilización aparecerá aquí.</p>
        <div class="preview-divider"></div>
        <span class="eyebrow">CAPITAL Y CIUDADES</span>
        <strong class="preview-capital" data-preview-capital>Nombre de la capital</strong>
        <div class="preview-city-list" data-preview-cities></div>
        <div class="preview-divider"></div>
        <div class="preview-preview-stat"><span>AGRESIVIDAD</span><strong data-preview-aggression>35</strong></div>
        <div class="preview-aggression-track"><span data-preview-aggression-fill></span></div>
        <div class="preview-divider"></div>
        <div class="preview-units-heading"><span class="eyebrow">FUERZAS INICIALES</span><strong data-preview-unit-count>1</strong></div>
        <div class="preview-unit-list" data-preview-units></div>
        <div class="preview-divider"></div>
        <div class="preview-points"><span class="eyebrow">PUNTOS USADOS</span><strong data-preview-points>3 / 24</strong></div>
        <div class="point-meter preview-point-meter" aria-hidden="true"><span data-preview-point-fill></span></div>
      </div>
    </aside>
    </div>
    <div id="civilization-result" aria-live="polite"></div>
    <p class="storage-note">Se guardará en este navegador. También podrás descargar la definición completa como XML.</p>`;
  const civilizationFileInput = container.querySelector("#import-civilization-file");
  container.querySelector("#import-civilization").addEventListener("click", () => civilizationFileInput.click());
  civilizationFileInput.addEventListener("change", async () => {
    const [file] = civilizationFileInput.files;
    if (!file) return;
    try {
      const civilization = parseCivilizationXml(await file.text());
      const customCivilizations = readStorage(STORAGE_KEYS.civilizations, []);
      const builtIn = game.civilizations.some((entry) => entry.id === civilization.id);
      if (builtIn) throw new Error("El archivo usa el identificador de una civilización incluida en el juego.");
      const existingIndex = customCivilizations.findIndex((entry) => entry.id === civilization.id);
      if (existingIndex >= 0) customCivilizations.splice(existingIndex, 1);
      customCivilizations.push(civilization);
      if (!writeStorage(STORAGE_KEYS.civilizations, customCivilizations)) return;
      showMessage(`${civilization.name} importada. Ya está disponible al empezar una partida.`);
    } catch (error) {
      console.error("No se pudo importar la civilización.", error);
      showMessage(`No se pudo importar la civilización: ${error.message}`);
    } finally {
      civilizationFileInput.value = "";
    }
  });
  const form = container.querySelector("#civilization-form");
  const updatePointStatus = () => {
    const costs = getCivilizationCreationPointCosts(form);
    const total = Math.max(0, costs.units + costs.traits);
    const overBudget = total > CIVILIZATION_CREATION_POINT_BUDGET;
    const hasStartingFounder = [...form.querySelectorAll('input[name="startingUnits"]:checked')]
      .some((input) => game.unitTypes.get(input.value)?.canFound);
    const status = container.querySelector("#civilization-point-status");
    status.classList.toggle("over-budget", overBudget);
    const remaining = CIVILIZATION_CREATION_POINT_BUDGET - total;
    status.querySelector("[data-point-count]").textContent =
      `${Math.max(0, total)} / ${CIVILIZATION_CREATION_POINT_BUDGET}`;
    status.querySelector("[data-point-breakdown]").textContent =
      `Unidades ${costs.units} · Rasgos ${costs.traits}`;
    status.querySelector("[data-point-hint]").textContent = overBudget
      ? "Reduce unidades o ventajas para respetar el límite."
      : !hasStartingFounder
        ? "Selecciona una unidad inicial que pueda fundar ciudades."
        : `${remaining} puntos disponibles.`;
    const meterWidth = Math.min(100, Math.max(0, (total / CIVILIZATION_CREATION_POINT_BUDGET) * 100));
    status.querySelector("[data-point-fill]").style.width = `${meterWidth}%`;
    status.querySelector(".point-meter").setAttribute("aria-valuenow", String(Math.max(0, total)));
    for (const [trait, cost] of Object.entries(costs.traitDetails)) {
      const label = form.querySelector(`[data-trait-cost="${trait}"]`);
      label.textContent = `${formatCivilizationPoints(cost)} puntos`;
      label.classList.toggle("trait-cost-credit", cost < 0);
    }
    updateCivilizationPreview(form, total);
    container.querySelector("#create-civilization-submit").disabled = overBudget || !hasStartingFounder;
  };
  form.addEventListener("input", (event) => {
    const range = event.target.matches("[data-range-for]") ? event.target : null;
    if (range) form.elements.namedItem(range.dataset.rangeFor).value = range.value;
    const numberInput = event.target.matches('input[type="number"]') ? event.target : null;
    const linkedRange = numberInput && form.querySelector(`[data-range-for="${numberInput.name}"]`);
    if (linkedRange) linkedRange.value = numberInput.value;
    updatePointStatus();
  });
  form.addEventListener("change", updatePointStatus);
  updatePointStatus();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const capital = String(data.get("capital")).trim();
    const otherCities = String(data.get("cities")).split(",").map((city) => city.trim()).filter(Boolean);
    const cities = [capital, ...otherCities].filter((city, index, list) =>
      city && list.findIndex((entry) => entry.toLocaleLowerCase("es") === city.toLocaleLowerCase("es")) === index
    );
    const startingUnits = data.getAll("startingUnits").map(String);
    const availableUnits = data.getAll("availableUnits").map(String);
    const hasStartingFounder = startingUnits.some((unitId) => game.unitTypes.get(unitId)?.canFound);
    const pointCosts = getCivilizationCreationPointCosts(form);
    if (Math.max(0, pointCosts.units + pointCosts.traits) > CIVILIZATION_CREATION_POINT_BUDGET) {
      showMessage(`La civilización supera el límite de ${CIVILIZATION_CREATION_POINT_BUDGET} puntos.`);
      return;
    }
    if (!name || !capital || !startingUnits.length || !hasStartingFounder) {
      showMessage("Añade un nombre, una capital y al menos una unidad inicial capaz de fundar ciudades.");
      return;
    }
    const civilization = {
      id: `custom-${Date.now()}`,
      name,
      adjective: String(data.get("adjective")).trim(),
      color: String(data.get("color")),
      aggression: Number(data.get("aggression")),
      playable: true,
      independent: false,
      canFoundSettlers: data.get("canFoundSettlers") === "on",
      description: String(data.get("description")).trim(),
      capital,
      cities,
      startingUnits,
      availableUnits,
      abilities: {
        unitProductionMultiplier: Number(data.get("unitProductionMultiplier")),
        unitPurchaseMultiplier: Number(data.get("unitPurchaseMultiplier")),
        unitStrengthMultiplier: Number(data.get("unitStrengthMultiplier")),
        progressionCostMultiplier: Number(data.get("progressionCostMultiplier")),
        descriptions: [String(data.get("passive")).trim()]
      }
    };
    const all = readStorage(STORAGE_KEYS.civilizations, []);
    all.push(civilization);
    if (!writeStorage(STORAGE_KEYS.civilizations, all)) return;
    const result = container.querySelector("#civilization-result");
    result.innerHTML = `<div class="created-notice"><strong>${escapeHtml(name)} creada</strong><p>Ya puedes seleccionarla al empezar una partida.</p>
      <button id="play-created-civilization" class="primary-button" type="button">Elegir mapa y jugar con esta civilización →</button>
      <button id="download-civilization" class="secondary-button" type="button">Descargar datos XML</button></div>`;
    result.querySelector("#play-created-civilization").addEventListener("click", () => {
      openMenuScreen("new-game");
      const civilizationSelect = container.querySelector("#new-game-civilization");
      civilizationSelect.value = civilization.id;
      civilizationSelect.dispatchEvent(new Event("change"));
    });
    result.querySelector("#download-civilization").addEventListener("click", () => downloadCivilizationXml(civilization));
  });
}

function updateCivilizationPreview(form, total) {
  const value = (name, fallback = "") => String(form.elements.namedItem(name)?.value ?? "").trim() || fallback;
  const color = value("color", "#d3b879");
  const name = value("name", "Nueva civilización");
  const adjective = value("adjective", "Tu pueblo");
  const description = value("description", "La historia de tu civilización aparecerá aquí.");
  const capital = value("capital", "Nombre de la capital");
  const cities = value("cities").split(",").map((city) => city.trim()).filter(Boolean);
  const selectedUnits = [...form.querySelectorAll('input[name="startingUnits"]:checked')]
    .map((input) => game.unitTypes.get(input.value)).filter(Boolean);
  const aggression = Math.min(100, Math.max(0, Number(value("aggression", "35")) || 0));
  const preview = form.parentElement.querySelector(".civilization-live-preview");

  preview.style.setProperty("--preview-color", color);
  preview.querySelector("[data-preview-banner]").style.setProperty("--preview-color", color);
  form.querySelector("[data-color-value]").textContent = color;
  preview.querySelector("[data-preview-name]").textContent = name;
  preview.querySelector("[data-preview-adjective]").textContent = adjective;
  preview.querySelector("[data-preview-description]").textContent = description;
  preview.querySelector("[data-preview-capital]").textContent = capital;
  preview.querySelector("[data-preview-cities]").innerHTML = cities.slice(0, 7)
    .map((city) => `<span>${escapeHtml(city)}</span>`).join("");
  preview.querySelector("[data-preview-aggression]").textContent = String(aggression);
  preview.querySelector("[data-preview-aggression-fill]").style.width = `${aggression}%`;
  preview.querySelector("[data-preview-unit-count]").textContent = String(selectedUnits.length);
  preview.querySelector("[data-preview-units]").innerHTML = selectedUnits.length
    ? selectedUnits.map((unit) => `<span class="preview-unit"><i aria-hidden="true">${escapeHtml(unit.icon)}</i>${escapeHtml(unit.name)}</span>`).join("")
    : `<span class="preview-empty">Aún no has elegido unidades.</span>`;
  preview.querySelector("[data-preview-points]").textContent =
    `${Math.max(0, total)} / ${CIVILIZATION_CREATION_POINT_BUDGET}`;
  preview.querySelector("[data-preview-point-fill]").style.width =
    `${Math.min(100, Math.max(0, (total / CIVILIZATION_CREATION_POINT_BUDGET) * 100))}%`;
  preview.classList.toggle("preview-over-budget", total > CIVILIZATION_CREATION_POINT_BUDGET);
}

function getCivilizationCreationPointCosts(form) {
  const selectedUnitInputs = [
    ...form.querySelectorAll('input[name="startingUnits"]:checked'),
    ...form.querySelectorAll('input[name="availableUnits"]:checked')
  ];
  const units = selectedUnitInputs.reduce((total, input) =>
    total + getCivilizationUnitPointCost(game.unitTypes.get(input.value)), 0
  );
  const multiplierCost = (name, advantageWeight, penaltyRefundWeight, advantageWhenHigher = false) => {
    const multiplier = Number(form.elements.namedItem(name).value);
    if (!Number.isFinite(multiplier)) return Number.POSITIVE_INFINITY;
    if (multiplier < 1) {
      return advantageWhenHigher
        ? -Math.floor((1 - multiplier) * penaltyRefundWeight)
        : Math.ceil((1 - multiplier) * advantageWeight);
    }
    return advantageWhenHigher
      ? Math.ceil((multiplier - 1) * advantageWeight)
      : -Math.floor((multiplier - 1) * penaltyRefundWeight);
  };
  const traitDetails = {
    unitProductionMultiplier: multiplierCost("unitProductionMultiplier", 8, 4),
    unitPurchaseMultiplier: multiplierCost("unitPurchaseMultiplier", 8, 4),
    unitStrengthMultiplier: multiplierCost("unitStrengthMultiplier", 12, 8, true),
    progressionCostMultiplier: multiplierCost("progressionCostMultiplier", 8, 4)
  };
  const traits = Object.values(traitDetails).reduce((total, cost) => total + cost, 0);
  return { units, traits, traitDetails };
}

function getCivilizationUnitPointCost(unit) {
  if (!unit) return 0;
  const estimatedHealth = unit.maxHealth || 20 + unit.strength * 2;
  return 1 +
    Math.ceil(unit.strength / 5) +
    Math.max(0, unit.movement - 2) +
    Math.max(0, unit.range - 1) * 2 +
    Math.ceil(Math.max(0, estimatedHealth - 32) / 20) +
    (unit.canFound ? 2 : 0) +
    (unit.canBuild ? 2 : 0) +
    (unit.canTrade ? 2 : 0) +
    (unit.canSail ? 1 : 0);
}

function formatCivilizationPoints(points) {
  return `${points > 0 ? "+" : ""}${points}`;
}

function downloadCivilizationXml(civilization) {
  const xmlEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[character]);
  const abilities = civilization.abilities;
  const cities = civilization.cities.map((city) => `      <city>${xmlEscape(city)}</city>`).join("\n");
  const startingUnits = civilization.startingUnits.map((unit) => `      <unit type="${xmlEscape(unit)}" />`).join("\n");
  const availableUnits = (civilization.availableUnits ?? []).map((unit) => `      <unit type="${xmlEscape(unit)}" />`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gameData>
  <civilizations>
    <civilization id="${xmlEscape(civilization.id)}" name="${xmlEscape(civilization.name)}" adjective="${xmlEscape(civilization.adjective)}" color="${xmlEscape(civilization.color)}" capital="${xmlEscape(civilization.capital)}" aggression="${civilization.aggression}" canFoundSettlers="${civilization.canFoundSettlers}" playable="true">
  <description>${xmlEscape(civilization.description)}</description>
  <abilities unitProductionMultiplier="${abilities.unitProductionMultiplier}" unitPurchaseMultiplier="${abilities.unitPurchaseMultiplier}" unitStrengthMultiplier="${abilities.unitStrengthMultiplier}" progressionCostMultiplier="${abilities.progressionCostMultiplier}">
${abilities.descriptions.map((description) => `    <ability>${xmlEscape(description)}</ability>`).join("\n")}
  </abilities>
  <cities>
${cities}
  </cities>
  <startingUnits>
${startingUnits}
  </startingUnits>
  <availableUnits>
${availableUnits}
  </availableUnits>
</civilization>
  </civilizations>
</gameData>
`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  link.download = `${civilization.id}.xml`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function parseCivilizationXml(xml) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  if (documentXml.querySelector("parsererror")) throw new Error("El archivo XML está dañado.");
  const definitions = documentXml.querySelectorAll("gameData > civilizations > civilization");
  if (definitions.length !== 1) throw new Error("El XML debe contener una sola definición de civilización.");
  const node = definitions[0];
  const abilitiesNode = node.querySelector("abilities");
  const readMultiplier = (name) => Number(abilitiesNode?.getAttribute(name));
  const civilization = {
    id: node.getAttribute("id"),
    name: node.getAttribute("name"),
    adjective: node.getAttribute("adjective"),
    color: node.getAttribute("color"),
    aggression: Number(node.getAttribute("aggression")),
    playable: node.getAttribute("playable") === "true",
    independent: false,
    canFoundSettlers: node.getAttribute("canFoundSettlers") === "true",
    description: node.querySelector("description")?.textContent.trim() ?? "",
    capital: node.getAttribute("capital"),
    cities: [...node.querySelectorAll("cities > city")].map((city) => city.textContent.trim()),
    startingUnits: [...node.querySelectorAll("startingUnits > unit")].map((unit) => unit.getAttribute("type")),
    availableUnits: [...node.querySelectorAll("availableUnits > unit")].map((unit) => unit.getAttribute("type")),
    abilities: {
      unitProductionMultiplier: readMultiplier("unitProductionMultiplier"),
      unitPurchaseMultiplier: readMultiplier("unitPurchaseMultiplier"),
      unitStrengthMultiplier: readMultiplier("unitStrengthMultiplier"),
      progressionCostMultiplier: readMultiplier("progressionCostMultiplier"),
      descriptions: [...(abilitiesNode?.querySelectorAll("ability") ?? [])]
        .map((ability) => ability.textContent.trim()).filter(Boolean)
    }
  };
  const multipliers = Object.values(civilization.abilities).filter((value) => typeof value === "number");
  const allUnits = [...civilization.startingUnits, ...civilization.availableUnits];
  if (!civilization.id || !civilization.name || !civilization.adjective ||
      !/^#[0-9a-f]{6}$/i.test(civilization.color) || !civilization.capital ||
      !Number.isFinite(civilization.aggression) || civilization.aggression < 0 || civilization.aggression > 100 ||
      !civilization.playable || !civilization.startingUnits.length ||
      allUnits.some((id) => !id || !game.unitTypes.has(id)) ||
      !civilization.startingUnits.some((id) => game.unitTypes.get(id)?.canFound) ||
      multipliers.some((value) => !Number.isFinite(value) || value < 0.25 || value > 3)) {
    throw new Error("El XML no contiene una civilización jugable con unidades y rasgos válidos.");
  }
  if (!civilization.cities.includes(civilization.capital)) civilization.cities.unshift(civilization.capital);
  return civilization;
}
