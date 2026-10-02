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

  const gameId = "minesweeper";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const campaignDifficulty = globalThis.CrediusArcadeCampaign.getLevelConfig(gameId, campaignLevel);
  const size = 9;
  const mineCount = Math.min(22, 10 + Math.floor((campaignLevel - 1) * 1.1));
  const gridEl = /** @type {HTMLElement} */ (document.getElementById("mineGrid"));
  const timerEl = /** @type {HTMLElement} */ (document.getElementById("timer"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const flagsEl = /** @type {HTMLElement} */ (document.getElementById("flags"));
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

  let cells = [];
  let phase = "playing";
  let generated = false;
  let startedAt = Date.now();
  let elapsedSeconds = 0;
  let roundRecorded = false;
  let longPressTimer = 0;

  function createCell(row, col) {
    return { row, col, mine: false, revealed: false, flagged: false, count: 0 };
  }

  function newGame() {
    cells = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        cells.push(createCell(row, col));
      }
    }
    phase = "playing";
    generated = false;
    startedAt = Date.now();
    elapsedSeconds = 0;
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    hideStatus();
    hideSettlement();
    updateSoundButton();
    render();
  }

  function generateMines(safeIndex) {
    const forbidden = new Set([safeIndex, ...neighborsOf(indexToCell(safeIndex)).map(cellToIndex)]);
    let placed = 0;
    while (placed < mineCount) {
      const index = Math.floor(Math.random() * cells.length);
      if (forbidden.has(index) || cells[index].mine) {
        continue;
      }
      cells[index].mine = true;
      placed += 1;
    }

    cells.forEach((cell) => {
      cell.count = neighborsOf(cell).filter((neighbor) => neighbor.mine).length;
    });
    generated = true;
    startedAt = Date.now();
  }

  function indexToCell(index) {
    return cells[index];
  }

  function cellToIndex(cell) {
    return cell.row * size + cell.col;
  }

  function neighborsOf(cell) {
    const neighbors = [];
    for (let row = cell.row - 1; row <= cell.row + 1; row += 1) {
      for (let col = cell.col - 1; col <= cell.col + 1; col += 1) {
        if (row === cell.row && col === cell.col) {
          continue;
        }
        if (row >= 0 && row < size && col >= 0 && col < size) {
          neighbors.push(cells[row * size + col]);
        }
      }
    }
    return neighbors;
  }

  function reveal(index) {
    if (phase !== "playing") {
      return;
    }
    if (!generated) {
      generateMines(index);
    }
    const cell = cells[index];
    if (!cell || cell.flagged || cell.revealed) {
      return;
    }
    cell.revealed = true;

    if (cell.mine) {
      phase = "lost";
      revealAllMines();
      render();
      showSettlement("踩到地雷");
      return;
    }

    if (cell.count === 0) {
      neighborsOf(cell).forEach((neighbor) => reveal(cellToIndex(neighbor)));
    }

    if (isSolved()) {
      phase = "won";
      render();
      showSettlement("雷区清空");
      return;
    }
    render();
  }

  function toggleFlag(index) {
    if (phase !== "playing") {
      return;
    }
    const cell = cells[index];
    if (!cell || cell.revealed) {
      return;
    }
    cell.flagged = !cell.flagged;
    render();
  }

  function revealAllMines() {
    cells.forEach((cell) => {
      if (cell.mine) {
        cell.revealed = true;
      }
    });
  }

  function isSolved() {
    return cells.filter((cell) => !cell.mine && cell.revealed).length === size * size - mineCount;
  }

  function currentScore() {
    const safeRevealed = cells.filter((cell) => cell.revealed && !cell.mine).length;
    if (phase === "won") {
      return Math.max(1000, 10000 - elapsedSeconds * 20 + (mineCount - usedFlags()) * 50);
    }
    return safeRevealed * 25;
  }

  function usedFlags() {
    return cells.filter((cell) => cell.flagged).length;
  }

  function render() {
    gridEl.innerHTML = "";
    cells.forEach((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mine-cell";
      button.dataset.index = String(index);
      button.dataset.count = String(cell.count);
      button.setAttribute("aria-label", `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列`);
      button.classList.toggle("revealed", cell.revealed);
      button.classList.toggle("flagged", cell.flagged);
      button.classList.toggle("mine-hit", cell.revealed && cell.mine && phase === "lost");
      button.textContent = cell.revealed ? (cell.mine ? "×" : cell.count ? String(cell.count) : "") : cell.flagged ? "◆" : "";
      button.addEventListener("click", () => reveal(index));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(index);
      });
      button.addEventListener("pointerdown", () => {
        longPressTimer = window.setTimeout(() => toggleFlag(index), 430);
      });
      button.addEventListener("pointerup", () => window.clearTimeout(longPressTimer));
      button.addEventListener("pointercancel", () => window.clearTimeout(longPressTimer));
      gridEl.append(button);
    });

    timerEl.textContent = `${elapsedSeconds}s`;
    const bestTime = getGameRecord(gameId).bestTime;
    bestEl.textContent = bestTime ? `${Math.round(bestTime)}s` : "--";
    flagsEl.textContent = String(Math.max(0, mineCount - usedFlags()));
  }

  function tick() {
    if (phase === "playing" && generated) {
      elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      timerEl.textContent = `${elapsedSeconds}s`;
    }
    requestAnimationFrame(tick);
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "雷区待命", "继续");
      return;
    }
    if (phase === "paused") {
      startedAt = Date.now() - elapsedSeconds * 1000;
      phase = "playing";
      pauseButton.textContent = "暂停";
      hideStatus();
    }
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
      score: currentScore(),
      bestTime: phase === "won" ? Math.max(1, elapsedSeconds) : undefined,
      playTime: Math.max(1, elapsedSeconds),
    });
  }

  function showSettlement(reason) {
    const result = recordRound();
    finalScore.textContent = formatScore(currentScore());
    finalBest.textContent = formatScore(result.record.highScore);
    settlementKicker.textContent = result.newHighScore ? "新纪录" : "本局结束";
    settlementTitle.textContent = reason;
    settlementPanel.hidden = false;
    hideStatus();
    postRecordUpdate();
  }

  function postRecordUpdate() {
    try {
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
    } catch {
      // Standalone play does not need parent messaging.
    }
  }

  function returnToLobby() {
    if (generated && !roundRecorded) {
      recordRound();
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "credius:close-game" }, "*");
      postRecordUpdate();
      return;
    }
    window.location.href = "../../index.html";
  }

  function updateSoundButton() {
    soundButton.textContent = getSettings().soundEnabled ? "♪" : "♪̸";
  }

  pauseButton.addEventListener("click", togglePause);
  statusButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (generated && phase === "playing") {
      recordRound();
    }
    newGame();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的扫雷用 ${elapsedSeconds}s 清理雷区，得分 ${formatScore(currentScore())}。`;
  });
  soundButton.addEventListener("click", () => {
    updateSettings({ soundEnabled: !getSettings().soundEnabled });
    updateSoundButton();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && phase === "playing") {
      togglePause();
    }
  });

  newGame();
  requestAnimationFrame(tick);
})();
