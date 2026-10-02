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

  const gameId = "sokoban";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const maxUndo = Math.max(1, 4 - Math.floor((campaignLevel - 1) / 3));
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("sokobanBoard"));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const levelEl = /** @type {HTMLElement} */ (document.getElementById("level"));
  const movesEl = /** @type {HTMLElement} */ (document.getElementById("moves"));
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
  const controlButtons = Array.from(document.querySelectorAll("[data-control]"));

  const levels = [
    [
      "########",
      "#      #",
      "# .B@  #",
      "#  ##  #",
      "# .B   #",
      "#      #",
      "########",
    ],
    [
      "########",
      "#  .   #",
      "#  B#  #",
      "# @ B. #",
      "#  ##  #",
      "#   .  #",
      "########",
    ],
    [
      "#########",
      "#   .   #",
      "# # B # #",
      "# .B@B. #",
      "# #   # #",
      "#   .   #",
      "#########",
    ],
  ];

  let levelIndex = 0;
  let walls = new Set();
  let targets = new Set();
  let boxes = new Set();
  let player = { x: 0, y: 0 };
  let moves = 0;
  let phase = "playing";
  let history = [];
  let undoUsed = 0;
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let mapWidth = 8;
  let mapHeight = 7;
  let cell = 48;

  function newGame() {
    levelIndex = Math.min(levels.length - 1, Math.floor((campaignLevel - 1) / 4));
    moves = 0;
    phase = "playing";
    history = [];
    undoUsed = 0;
    roundStartedAt = Date.now();
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    hideStatus();
    hideSettlement();
    loadLevel(levelIndex);
    updateSoundButton();
    render();
    canvas.focus();
  }

  function loadLevel(index) {
    walls = new Set();
    targets = new Set();
    boxes = new Set();
    history = [];
    undoUsed = 0;
    const map = levels[index];
    mapHeight = map.length;
    mapWidth = Math.max(...map.map((row) => row.length));
    cell = canvas.width / mapWidth;
    map.forEach((row, y) => {
      row.split("").forEach((tile, x) => {
        const key = posKey(x, y);
        if (tile === "#") {
          walls.add(key);
        } else if (tile === ".") {
          targets.add(key);
        } else if (tile === "B") {
          boxes.add(key);
        } else if (tile === "@") {
          player = { x, y };
        }
      });
    });
    phase = "playing";
    hideStatus();
  }

  function posKey(x, y) {
    return `${x},${y}`;
  }

  function move(dx, dy) {
    if (phase !== "playing") {
      return;
    }
    const next = { x: player.x + dx, y: player.y + dy };
    const nextKey = posKey(next.x, next.y);
    if (walls.has(nextKey)) {
      return;
    }
    const snapshot = snapshotState();
    if (boxes.has(nextKey)) {
      const beyond = { x: next.x + dx, y: next.y + dy };
      const beyondKey = posKey(beyond.x, beyond.y);
      if (walls.has(beyondKey) || boxes.has(beyondKey)) {
        return;
      }
      boxes.delete(nextKey);
      boxes.add(beyondKey);
    }
    player = next;
    moves += 1;
    history.push(snapshot);
    if (isSolved()) {
      handleLevelClear();
    }
    render();
  }

  function snapshotState() {
    return {
      player: { ...player },
      boxes: new Set(boxes),
      moves,
    };
  }

  function undo() {
    if (!history.length || phase !== "playing" || undoUsed >= maxUndo) {
      return;
    }
    const previous = history.pop();
    undoUsed += 1;
    player = previous.player;
    boxes = new Set(previous.boxes);
    moves = previous.moves;
    render();
  }

  function isSolved() {
    return [...boxes].every((box) => targets.has(box));
  }

  function handleLevelClear() {
    if (levelIndex >= levels.length - 1) {
      phase = "complete";
      showSettlement("全部完成");
      return;
    }
    phase = "level-clear";
    showStatus("清场", `第 ${levelIndex + 1} 关`, "下一关");
  }

  function nextLevel() {
    if (phase !== "level-clear") {
      return;
    }
    levelIndex += 1;
    loadLevel(levelIndex);
    render();
  }

  function currentScore() {
    return Math.max(0, (levelIndex + 1) * 1200 - moves * 6 + (phase === "complete" ? 2400 : 0));
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#151b19";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const key = posKey(x, y);
        ctx.fillStyle = "#202725";
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        if (targets.has(key)) {
          ctx.strokeStyle = "#f1b84b";
          ctx.lineWidth = 3;
          ctx.strokeRect(x * cell + cell * 0.25, y * cell + cell * 0.25, cell * 0.5, cell * 0.5);
        }
        if (walls.has(key)) {
          ctx.fillStyle = "#31413d";
          ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        }
        if (boxes.has(key)) {
          ctx.fillStyle = targets.has(key) ? "#66d9c8" : "#9fc2a7";
          ctx.fillRect(x * cell + 8, y * cell + 8, cell - 16, cell - 16);
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.strokeRect(x * cell + 8.5, y * cell + 8.5, cell - 17, cell - 17);
        }
      }
    }
    ctx.fillStyle = "#f3f5ef";
    ctx.beginPath();
    ctx.arc(player.x * cell + cell / 2, player.y * cell + cell / 2, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
    levelEl.textContent = String(levelIndex + 1);
    movesEl.textContent = String(moves);
    bestEl.textContent = formatScore(getGameRecord(gameId).highScore);
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "箱子待命", "继续");
      return;
    }
    if (phase === "paused") {
      phase = "playing";
      pauseButton.textContent = "暂停";
      hideStatus();
      canvas.focus();
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
      highestLevel: levelIndex + 1,
      playTime: Math.round((Date.now() - roundStartedAt) / 1000),
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
    if (moves > 0 && !roundRecorded) {
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
    const key = event.key.toLowerCase();
    const map = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
    };
    if (map[key]) {
      event.preventDefault();
      move(map[key][0], map[key][1]);
    } else if (key === "u" || key === "backspace") {
      event.preventDefault();
      undo();
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  });
  controlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const control = button instanceof HTMLElement ? button.dataset.control : "";
      if (control === "up") move(0, -1);
      if (control === "down") move(0, 1);
      if (control === "left") move(-1, 0);
      if (control === "right") move(1, 0);
      if (control === "undo") undo();
      canvas.focus();
    });
  });
  pauseButton.addEventListener("click", togglePause);
  statusButton.addEventListener("click", () => {
    if (phase === "level-clear") {
      nextLevel();
    } else {
      togglePause();
    }
  });
  newGameButton.addEventListener("click", () => {
    if (moves > 0 && !roundRecorded) {
      recordRound();
    }
    newGame();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的推箱子完成到第 ${levelIndex + 1} 关，用了 ${moves} 步。`;
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
})();
