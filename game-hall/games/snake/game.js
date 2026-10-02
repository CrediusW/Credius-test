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

  const gameId = "snake";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const campaignDifficulty = globalThis.CrediusArcadeCampaign.getLevelConfig(gameId, campaignLevel);
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("snakeBoard"));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const lengthEl = /** @type {HTMLElement} */ (document.getElementById("length"));
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

  const grid = 21;
  const cell = canvas.width / grid;
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  let snake = [];
  let food = { x: 14, y: 10 };
  let direction = directions.right;
  let queuedDirection = directions.right;
  let score = 0;
  let best = 0;
  let phase = "playing";
  let lastStep = 0;
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let touchStart = null;

  function newGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    direction = directions.right;
    queuedDirection = directions.right;
    score = 0;
    best = getGameRecord(gameId).highScore;
    phase = "playing";
    lastStep = 0;
    roundStartedAt = Date.now();
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    shareOutput.textContent = "";
    hideStatus();
    hideSettlement();
    placeFood();
    updateSoundButton();
    render();
    canvas.focus();
  }

  function placeFood() {
    do {
      food = {
        x: Math.floor(Math.random() * grid),
        y: Math.floor(Math.random() * grid),
      };
    } while (snake.some((part) => part.x === food.x && part.y === food.y));
  }

  function speed() {
    return Math.max(58, (145 - Math.floor(score / 50) * 8) * campaignDifficulty.graceMultiplier);
  }

  function loop(now) {
    if (phase === "playing" && now - lastStep > speed()) {
      lastStep = now;
      step();
    }
    render();
    requestAnimationFrame(loop);
  }

  function step() {
    direction = queuedDirection;
    const head = snake[0];
    const next = { x: head.x + direction.x, y: head.y + direction.y };
    const hitsWall = next.x < 0 || next.x >= grid || next.y < 0 || next.y >= grid;
    const hitsBody = snake.some((part) => part.x === next.x && part.y === next.y);

    if (hitsWall || hitsBody) {
      phase = "game-over";
      showSettlement(hitsWall ? "撞到边界" : "咬到自己");
      return;
    }

    snake.unshift(next);
    if (next.x === food.x && next.y === food.y) {
      score += 10 + Math.max(0, snake.length - 3);
      best = Math.max(best, score);
      placeFood();
    } else {
      snake.pop();
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#141b19";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    for (let line = cell; line < canvas.width; line += cell) {
      ctx.beginPath();
      ctx.moveTo(line + 0.5, 0);
      ctx.lineTo(line + 0.5, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, line + 0.5);
      ctx.lineTo(canvas.width, line + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = "#f1b84b";
    ctx.beginPath();
    ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * 0.34, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? "#8bd66d" : "#66d9c8";
      ctx.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
    });

    scoreEl.textContent = formatScore(score);
    bestEl.textContent = formatScore(best);
    lengthEl.textContent = String(snake.length);
  }

  function turn(name) {
    const nextDirection = directions[name];
    if (!nextDirection || phase !== "playing") {
      return;
    }
    if (nextDirection.x + direction.x === 0 && nextDirection.y + direction.y === 0) {
      return;
    }
    queuedDirection = nextDirection;
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "蛇身待命", "继续");
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
  }

  function recordRound() {
    if (roundRecorded) {
      return { record: getGameRecord(gameId), newHighScore: false };
    }
    roundRecorded = true;
    return saveGameResult(gameId, {
      score,
      playTime: Math.round((Date.now() - roundStartedAt) / 1000),
    });
  }

  function showSettlement(reason) {
    const result = recordRound();
    best = result.record.highScore;
    finalScore.textContent = formatScore(score);
    finalBest.textContent = formatScore(result.record.highScore);
    settlementKicker.textContent = result.newHighScore ? "新纪录" : "本局结束";
    settlementTitle.textContent = reason;
    settlementPanel.hidden = false;
    hideStatus();
    render();
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
    if (score > 0 && !roundRecorded) {
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
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };
    if (map[key]) {
      event.preventDefault();
      turn(map[key]);
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  });

  canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", (event) => {
    if (!touchStart) {
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) {
      return;
    }
    event.preventDefault();
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }, { passive: false });

  controlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button instanceof HTMLElement) {
        turn(button.dataset.control ?? "");
      }
    });
  });
  pauseButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (score > 0 && phase !== "game-over") {
      recordRound();
    }
    newGame();
  });
  statusButton.addEventListener("click", togglePause);
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的贪吃蛇拿到 ${formatScore(score)} 分，蛇身长度 ${snake.length}。`;
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
  requestAnimationFrame(loop);
})();
