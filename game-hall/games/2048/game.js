// @ts-check

(function () {
  "use strict";

const {
  formatScore,
  getGameRecord,
  getSettings,
  saveGameResult,
  updateSettings,
} = globalThis.CrediusArcadeStorage;

  const gameId = "2048";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const campaignDifficulty = globalThis.CrediusArcadeCampaign.getLevelConfig(gameId, campaignLevel);
  const size = 4;
  const winningValue = 2048;

  const board = /** @type {HTMLElement} */ (document.getElementById("board"));
  const cellGrid = /** @type {HTMLElement} */ (document.getElementById("cellGrid"));
  const tileLayer = /** @type {HTMLElement} */ (document.getElementById("tileLayer"));
  const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const backLobby = /** @type {HTMLButtonElement} */ (document.getElementById("backLobby"));
  const pauseButton = /** @type {HTMLButtonElement} */ (document.getElementById("pauseGame"));
  const newGameButton = /** @type {HTMLButtonElement} */ (document.getElementById("newGame"));
  const soundButton = /** @type {HTMLButtonElement} */ (document.getElementById("soundGame"));
  const statusPanel = /** @type {HTMLElement} */ (document.getElementById("statusPanel"));
  const statusKicker = /** @type {HTMLElement} */ (document.getElementById("statusKicker"));
  const statusTitle = /** @type {HTMLElement} */ (document.getElementById("statusTitle"));
  const statusButton = /** @type {HTMLButtonElement} */ (document.getElementById("statusButton"));
  const settlementPanel = /** @type {HTMLElement} */ (document.getElementById("settlementPanel"));
  const settlementKicker = /** @type {HTMLElement} */ (document.getElementById("settlementKicker"));
  const settlementTitle = /** @type {HTMLElement} */ (document.getElementById("settlementTitle"));
  const finalScore = /** @type {HTMLElement} */ (document.getElementById("finalScore"));
  const finalBest = /** @type {HTMLElement} */ (document.getElementById("finalBest"));
  const playAgain = /** @type {HTMLButtonElement} */ (document.getElementById("playAgain"));
  const shareResult = /** @type {HTMLButtonElement} */ (document.getElementById("shareResult"));
  const settlementLobby = /** @type {HTMLButtonElement} */ (document.getElementById("settlementLobby"));
  const shareOutput = /** @type {HTMLElement} */ (document.getElementById("shareOutput"));

  let nextId = 1;
  let blockedMove = null;
  let mergedTileIds = new Set();
  let newTileIds = new Set();
  const tileElements = new Map();
  let state = createState();
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let touchStart = null;

  const directions = [
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: -1, col: 0 },
    { row: 1, col: 0 },
  ];

  function createState() {
    return {
      tiles: [],
      score: 0,
      best: getGameRecord(gameId).highScore,
      phase: "playing",
      alreadyWon: false,
    };
  }

  function buildGrid() {
    cellGrid.innerHTML = "";
    for (let i = 0; i < size * size; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cellGrid.append(cell);
    }
  }

  function startGame() {
    nextId = 1;
    blockedMove = null;
    mergedTileIds = new Set();
    newTileIds = new Set();
    tileElements.clear();
    tileLayer.innerHTML = "";
    state = createState();
    roundStartedAt = Date.now();
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    hideStatus();
    hideSettlement();
    const startingTiles = Math.min(4, 2 + Math.floor((campaignLevel - 1) / 4));
    for (let index = 0; index < startingTiles; index += 1) {
      spawnTile();
    }
    render();
    clearTransientMotionClasses();
    board.focus();
  }

  function spawnTile() {
    const emptyCells = [];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!tileAt(row, col)) {
          emptyCells.push({ row, col });
        }
      }
    }

    if (!emptyCells.length) {
      return null;
    }

    const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const tile = {
      id: nextId,
      value: Math.random() < Math.max(0.66, 0.91 - campaignLevel * 0.02) ? 2 : 4,
      row: cell.row,
      col: cell.col,
    };

    nextId += 1;
    state.tiles.push(tile);
    newTileIds.add(tile.id);
    return tile;
  }

  function tileAt(row, col, ignoredId = null) {
    return state.tiles.find(
      (tile) => tile.id !== ignoredId && tile.row === row && tile.col === col,
    );
  }

  function moveBoard(direction) {
    if (state.phase !== "playing") {
      return false;
    }

    let moved = false;
    const nextTiles = [];
    mergedTileIds = new Set();

    for (const line of getMoveLines(direction)) {
      const lineTiles = line
        .map((cell) => tileAt(cell.row, cell.col))
        .filter(Boolean);

      let targetIndex = 0;

      for (let sourceIndex = 0; sourceIndex < lineTiles.length; sourceIndex += 1) {
        const tile = lineTiles[sourceIndex];
        const mergeTarget = lineTiles[sourceIndex + 1];
        const targetCell = line[targetIndex];
        const originalRow = tile.row;
        const originalCol = tile.col;

        if (mergeTarget && mergeTarget.value === tile.value) {
          tile.value *= 2;
          state.score += tile.value;
          mergedTileIds.add(tile.id);
          sourceIndex += 1;
          moved = true;
        }

        tile.row = targetCell.row;
        tile.col = targetCell.col;
        if (tile.row !== originalRow || tile.col !== originalCol) {
          moved = true;
        }

        nextTiles.push(tile);
        targetIndex += 1;
      }
    }

    state.tiles = moved ? nextTiles : state.tiles;
    return moved;
  }

  function getMoveLines(direction) {
    const lines = [];
    const indexes = Array.from({ length: size }, (_, index) => index);

    if (direction.col !== 0) {
      const cols = direction.col < 0 ? indexes : indexes.slice().reverse();
      for (let row = 0; row < size; row += 1) {
        lines.push(cols.map((col) => ({ row, col })));
      }
      return lines;
    }

    const rows = direction.row < 0 ? indexes : indexes.slice().reverse();
    for (let col = 0; col < size; col += 1) {
      lines.push(rows.map((row) => ({ row, col })));
    }
    return lines;
  }

  function completeMove() {
    spawnTile();
    syncBestForDisplay();

    if (!state.alreadyWon && state.tiles.some((tile) => tile.value >= winningValue)) {
      state.alreadyWon = true;
      state.phase = "won";
      showStatus("达成", String(winningValue), "继续");
      return;
    }

    if (!canAnyTileMove()) {
      state.phase = "lost";
      showSettlement("无路可走");
    }
  }

  function canAnyTileMove() {
    if (state.tiles.length < size * size) {
      return true;
    }

    return state.tiles.some((tile) =>
      directions.some((direction) => {
        const neighbor = tileAt(tile.row + direction.row, tile.col + direction.col, tile.id);
        return neighbor?.value === tile.value;
      }),
    );
  }

  function syncBestForDisplay() {
    state.best = Math.max(state.best, state.score);
  }

  function showStatus(kicker, title, buttonLabel) {
    statusKicker.textContent = kicker;
    statusTitle.textContent = title;
    statusButton.textContent = buttonLabel;
    statusPanel.hidden = false;
  }

  function hideStatus() {
    statusPanel.hidden = true;
  }

  function hideSettlement() {
    settlementPanel.hidden = true;
    shareOutput.textContent = "";
  }

  function recordRound() {
    if (roundRecorded) {
      return { record: getGameRecord(gameId), newHighScore: false };
    }

    roundRecorded = true;
    return saveGameResult(gameId, {
      score: state.score,
      playTime: Math.round((Date.now() - roundStartedAt) / 1000),
    });
  }

  function showSettlement(reason) {
    const result = recordRound();
    state.best = result.record.highScore;
    finalScore.textContent = formatScore(state.score);
    finalBest.textContent = formatScore(result.record.highScore);
    settlementKicker.textContent = result.newHighScore ? "新纪录" : "本局结束";
    settlementTitle.textContent = reason;
    settlementPanel.hidden = false;
    hideStatus();
    render();
  }

  function render() {
    scoreEl.textContent = formatScore(state.score);
    bestEl.textContent = formatScore(state.best);
    const activeTileIds = new Set(state.tiles.map((tile) => tile.id));

    for (const [id, tileElement] of tileElements) {
      if (!activeTileIds.has(id)) {
        tileElement.remove();
        tileElements.delete(id);
      }
    }

    state.tiles
      .slice()
      .sort((a, b) => a.id - b.id)
      .forEach((tile) => {
        const tileButton = getTileElement(tile);
        tileButton.textContent = String(tile.value);
        tileButton.dataset.value = String(Math.min(tile.value, 8192));
        tileButton.style.setProperty("--row", String(tile.row));
        tileButton.style.setProperty("--col", String(tile.col));
        tileButton.style.setProperty("--nudge-x", "0px");
        tileButton.style.setProperty("--nudge-y", "0px");
        tileButton.style.setProperty("--nudge-bounce-x", "0px");
        tileButton.style.setProperty("--nudge-bounce-y", "0px");
        tileButton.setAttribute(
          "aria-label",
          `${tile.value}，第 ${tile.row + 1} 行，第 ${tile.col + 1} 列`,
        );
        tileButton.classList.toggle("merged", mergedTileIds.has(tile.id));
        tileButton.classList.toggle("new", newTileIds.has(tile.id));

        if (blockedMove) {
          tileButton.style.setProperty("--nudge-x", `${blockedMove.col * 7}px`);
          tileButton.style.setProperty("--nudge-y", `${blockedMove.row * 7}px`);
          tileButton.style.setProperty("--nudge-bounce-x", `${blockedMove.col * -3}px`);
          tileButton.style.setProperty("--nudge-bounce-y", `${blockedMove.row * -3}px`);
          tileButton.classList.add("blocked");
        } else {
          tileButton.classList.remove("blocked");
        }
      });
  }

  function getTileElement(tile) {
    if (tileElements.has(tile.id)) {
      return tileElements.get(tile.id);
    }

    const tileButton = document.createElement("div");
    tileButton.className = "tile";
    tileButton.setAttribute("role", "img");

    tileElements.set(tile.id, tileButton);
    tileLayer.append(tileButton);
    return tileButton;
  }

  function handleMove(direction) {
    if (state.phase !== "playing") {
      return;
    }

    const moved = moveBoard(direction);
    blockedMove = moved ? null : direction;

    if (moved) {
      completeMove();
    }

    render();
    clearTransientMotionClasses();
  }

  function handleKey(event) {
    const key = event.key.toLowerCase();
    const directionByKey = {
      arrowleft: { row: 0, col: -1 },
      a: { row: 0, col: -1 },
      arrowright: { row: 0, col: 1 },
      d: { row: 0, col: 1 },
      arrowup: { row: -1, col: 0 },
      w: { row: -1, col: 0 },
      arrowdown: { row: 1, col: 0 },
      s: { row: 1, col: 0 },
    };
    const direction = directionByKey[key];

    if (!direction) {
      return;
    }

    event.preventDefault();
    handleMove(direction);
  }

  function clearTransientMotionClasses() {
    if (blockedMove || mergedTileIds.size || newTileIds.size) {
      window.setTimeout(() => {
        blockedMove = null;
        mergedTileIds.clear();
        newTileIds.clear();
        render();
      }, 220);
    }
  }

  function togglePause() {
    if (state.phase === "playing") {
      state.phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "棋盘待命", "继续");
      return;
    }

    if (state.phase === "paused") {
      state.phase = "playing";
      pauseButton.textContent = "暂停";
      hideStatus();
      board.focus();
    }
  }

  function updateSoundButton() {
    soundButton.textContent = getSettings().soundEnabled ? "♪" : "♪̸";
  }

  function returnToLobby() {
    recordRound();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "credius:close-game" }, "*");
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
      return;
    }
    window.location.href = "../../index.html";
  }

  statusButton.addEventListener("click", () => {
    if (state.phase === "lost") {
      startGame();
      return;
    }

    if (state.phase === "paused") {
      togglePause();
      return;
    }

    state.phase = "playing";
    hideStatus();
    render();
    board.focus();
  });
  newGameButton.addEventListener("click", () => {
    if (state.score > 0 && state.phase !== "lost") {
      recordRound();
    }
    startGame();
  });
  pauseButton.addEventListener("click", togglePause);
  soundButton.addEventListener("click", () => {
    updateSettings({ soundEnabled: !getSettings().soundEnabled });
    updateSoundButton();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", startGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的 2048 拿到 ${formatScore(state.score)} 分。`;
  });
  document.addEventListener("keydown", handleKey);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "playing") {
      togglePause();
    }
  });
  board.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  board.addEventListener("touchend", (event) => {
    if (!touchStart) {
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      return;
    }
    event.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove({ row: 0, col: dx > 0 ? 1 : -1 });
    } else {
      handleMove({ row: dy > 0 ? 1 : -1, col: 0 });
    }
  }, { passive: false });

  buildGrid();
  updateSoundButton();
  startGame();
})();
