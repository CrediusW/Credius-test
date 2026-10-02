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

  const gameId = "sudoku";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const maxMistakes = Math.max(2, 5 - Math.floor((campaignLevel - 1) / 3));
  const puzzle =
    "530070000" +
    "600195000" +
    "098000060" +
    "800060003" +
    "400803001" +
    "700020006" +
    "060000280" +
    "000419005" +
    "000080079";
  const solution =
    "534678912" +
    "672195348" +
    "198342567" +
    "859761423" +
    "426853791" +
    "713924856" +
    "961537284" +
    "287419635" +
    "345286179";

  const gridEl = /** @type {HTMLElement} */ (document.getElementById("sudokuGrid"));
  const padEl = /** @type {HTMLElement} */ (document.getElementById("numberPad"));
  const timerEl = /** @type {HTMLElement} */ (document.getElementById("timer"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const mistakesEl = /** @type {HTMLElement} */ (document.getElementById("mistakes"));
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

  let values = [];
  let activePuzzle = puzzle;
  let selected = 0;
  let mistakes = 0;
  let phase = "playing";
  let startedAt = Date.now();
  let elapsedSeconds = 0;
  let roundRecorded = false;

  function newGame() {
    activePuzzle = puzzleForLevel();
    values = activePuzzle.split("").map((value) => (value === "0" ? "" : value));
    selected = values.findIndex((value) => !value);
    mistakes = 0;
    phase = "playing";
    startedAt = Date.now();
    elapsedSeconds = 0;
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    hideStatus();
    hideSettlement();
    updateSoundButton();
    renderPad();
    render();
  }

  function puzzleForLevel() {
    const cells = puzzle.split("");
    const givens = cells.map((value, index) => value === "0" ? -1 : index).filter((index) => index >= 0);
    const removalCount = Math.min(13, Math.floor((campaignLevel - 1) * 1.2));
    for (let index = 0; index < removalCount; index += 1) {
      cells[givens[(index * 7 + campaignLevel * 3) % givens.length]] = "0";
    }
    return cells.join("");
  }

  function renderPad() {
    padEl.innerHTML = "";
    for (let number = 1; number <= 9; number += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(number);
      button.addEventListener("click", () => inputNumber(String(number)));
      padEl.append(button);
    }
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "清除";
    clear.addEventListener("click", () => inputNumber(""));
    padEl.append(clear);
  }

  function render() {
    gridEl.innerHTML = "";
    values.forEach((value, index) => {
      const cell = document.createElement("button");
      const row = Math.floor(index / 9);
      const col = index % 9;
      const given = activePuzzle[index] !== "0";
      const selectedRow = Math.floor(selected / 9);
      const selectedCol = selected % 9;
      cell.type = "button";
      cell.className = "sudoku-cell";
      cell.textContent = value;
      cell.classList.toggle("given", given);
      cell.classList.toggle("selected", selected === index);
      cell.classList.toggle("peer", row === selectedRow || col === selectedCol || sameBox(index, selected));
      cell.classList.toggle("error", Boolean(value && value !== solution[index]));
      cell.addEventListener("click", () => {
        selected = index;
        render();
      });
      gridEl.append(cell);
    });
    timerEl.textContent = `${elapsedSeconds}s`;
    bestEl.textContent = formatScore(getGameRecord(gameId).highScore);
    mistakesEl.textContent = String(mistakes);
  }

  function sameBox(a, b) {
    return Math.floor(Math.floor(a / 9) / 3) === Math.floor(Math.floor(b / 9) / 3) &&
      Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3);
  }

  function inputNumber(number) {
    if (phase !== "playing" || selected < 0 || activePuzzle[selected] !== "0") {
      return;
    }
    values[selected] = number;
    if (number && number !== solution[selected]) {
      mistakes += 1;
      if (mistakes >= maxMistakes) {
        phase = "lost";
        render();
        showSettlement("错误过多");
        return;
      }
    }
    if (values.every((value, index) => value === solution[index])) {
      phase = "won";
      render();
      showSettlement("九宫完成");
      return;
    }
    render();
  }

  function currentScore() {
    const filled = values.filter(Boolean).length;
    const completeBonus = phase === "won" ? 7000 : 0;
    return Math.max(0, filled * 45 + completeBonus - elapsedSeconds * 8 - mistakes * 180);
  }

  function tick() {
    if (phase === "playing") {
      elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      timerEl.textContent = `${elapsedSeconds}s`;
    }
    requestAnimationFrame(tick);
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "九宫待命", "继续");
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
    if (values.some((value, index) => activePuzzle[index] === "0" && value) && !roundRecorded) {
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

  document.addEventListener("keydown", (event) => {
    const key = event.key;
    if (/^[1-9]$/.test(key)) {
      inputNumber(key);
    } else if (key === "Backspace" || key === "Delete" || key === "0") {
      inputNumber("");
    } else if (key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
    }
  });
  pauseButton.addEventListener("click", togglePause);
  statusButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (!roundRecorded && values.some((value, index) => activePuzzle[index] === "0" && value)) {
      recordRound();
    }
    newGame();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的数独拿到 ${formatScore(currentScore())} 分，用时 ${elapsedSeconds}s。`;
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
