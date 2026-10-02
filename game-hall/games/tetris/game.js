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
const { findCompleteRows, removeRows } = globalThis.CrediusTetrisLineRules;
const { getDropInterval, getLevelProgress, levels: levelConfigs } = globalThis.CrediusTetrisProgressRules;

const gameId = "tetris";
const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
const campaignDifficulty = globalThis.CrediusArcadeCampaign.getLevelConfig(gameId, campaignLevel);
const cols = 10;
const rows = 20;
const block = 30;
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("tetrisBoard"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
const nextCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("nextPiece"));
const nextCtx = /** @type {CanvasRenderingContext2D} */ (nextCanvas.getContext("2d"));
const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
const levelEl = /** @type {HTMLElement} */ (document.getElementById("level"));
const linesEl = /** @type {HTMLElement} */ (document.getElementById("lines"));
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

const shapes = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
};

const palettes = {
  I: "#7bdff2",
  J: "#7aa7ff",
  L: "#f1b84b",
  O: "#ffd166",
  S: "#66d9c8",
  T: "#c5a3ff",
  Z: "#ff6f7d",
};
const qaEnabled = new URLSearchParams(window.location.search).has("qa");
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const clearDuration = prefersReducedMotion ? 120 : 460;

let board = createBoard();
let active = createPiece();
let next = createPiece();
let score = 0;
let best = getGameRecord(gameId).highScore;
let level = 1;
let lines = 0;
let phase = "playing";
let dropCounter = 0;
let lastTime = performance.now();
let roundStartedAt = Date.now();
let roundRecorded = false;
/** @type {{rows: number[], startedAt: number} | null} */
let clearAnimation = null;

function createBoard() {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

function createPiece() {
  const keys = Object.keys(shapes);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const matrix = shapes[type].map((row) => row.slice());
  return {
    type,
    matrix,
    x: Math.floor((cols - matrix[0].length) / 2),
    y: 0,
  };
}

function newGame() {
  board = createBoard();
  active = createPiece();
  next = createPiece();
  score = 0;
  best = getGameRecord(gameId).highScore;
  level = 1;
  lines = 0;
  phase = "playing";
  dropCounter = 0;
  roundStartedAt = Date.now();
  roundRecorded = false;
  clearAnimation = null;
  pauseButton.textContent = "暂停";
  pauseButton.disabled = false;
  hideStatus();
  hideSettlement();
  updateSoundButton();
  draw();
  canvas.focus();
}

function dropInterval() {
  return getDropInterval(level, campaignDifficulty.graceMultiplier);
}

function update(time = performance.now()) {
  const delta = time - lastTime;
  lastTime = time;

  if (phase === "playing") {
    dropCounter += delta;
    if (dropCounter > dropInterval()) {
      softDrop();
    }
  } else if (phase === "clearing" && clearAnimation && time - clearAnimation.startedAt >= clearDuration) {
    finishLineClear();
  }

  draw();
  requestAnimationFrame(update);
}

function softDrop() {
  if (phase !== "playing") {
    return;
  }

  active.y += 1;
  if (collides()) {
    active.y -= 1;
    lockPiece();
  } else {
    score += 1;
    syncBestForDisplay();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (phase !== "playing") {
    return;
  }

  let distance = 0;
  while (!collides()) {
    active.y += 1;
    distance += 1;
  }
  active.y -= 1;
  distance -= 1;
  score += Math.max(0, distance) * 2;
  lockPiece();
  dropCounter = 0;
}

function move(dx) {
  if (phase !== "playing") {
    return;
  }
  active.x += dx;
  if (collides()) {
    active.x -= dx;
  }
}

function rotatePiece() {
  if (phase !== "playing" || active.type === "O") {
    return;
  }

  const previous = active.matrix;
  active.matrix = rotateMatrix(active.matrix);
  const originalX = active.x;
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    active.x = originalX + kick;
    if (!collides()) {
      return;
    }
  }

  active.x = originalX;
  active.matrix = previous;
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collides() {
  for (let y = 0; y < active.matrix.length; y += 1) {
    for (let x = 0; x < active.matrix[y].length; x += 1) {
      if (!active.matrix[y][x]) {
        continue;
      }
      const boardX = active.x + x;
      const boardY = active.y + y;
      if (boardX < 0 || boardX >= cols || boardY >= rows) {
        return true;
      }
      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function lockPiece() {
  active.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = active.y + y;
        const boardX = active.x + x;
        if (boardY >= 0) {
          board[boardY][boardX] = active.type;
        }
      }
    });
  });

  const completeRows = findCompleteRows(board);
  if (completeRows.length) {
    phase = "clearing";
    clearAnimation = {
      rows: completeRows,
      startedAt: performance.now(),
    };
    return;
  }

  advancePiece();
}

function advancePiece() {
  active = next;
  next = createPiece();

  if (collides()) {
    phase = "game-over";
    showSettlement("堆叠到顶");
    return false;
  }
  return true;
}

function finishLineClear() {
  if (!clearAnimation) {
    return;
  }

  const requestedRows = clearAnimation.rows;
  const completeRows = new Set(findCompleteRows(board));
  const verifiedRows = requestedRows.filter((rowIndex) => completeRows.has(rowIndex));
  const cleared = verifiedRows.length;
  board = removeRows(board, requestedRows);
  clearAnimation = null;
  const lineScores = [0, 100, 300, 500, 800];
  score += lineScores[cleared] * level;
  lines += cleared;
  const previousLevel = level;
  const progress = getLevelProgress(lines);
  level = progress.level;
  syncBestForDisplay();

  if (progress.completed) {
    phase = "completed";
    showSettlement("三关完成");
    return;
  }

  phase = level > previousLevel ? "level-transition" : "playing";
  if (!advancePiece()) {
    return;
  }
  if (phase === "level-transition") {
    pauseButton.disabled = true;
    showStatus(`第 ${level} 关`, `速度提升 · ${progress.linesInLevel}/20 行`, "开始本关");
  }
}

function syncBestForDisplay() {
  best = Math.max(best, score);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height, block);
  drawBoard();
  if (phase === "playing" || phase === "paused" || phase === "level-transition") {
    drawPiece(ctx, active.matrix, active.x, active.y, active.type, block);
  }
  drawNext();
  renderHud();
  if (qaEnabled) {
    canvas.dataset.phase = phase;
    canvas.dataset.completeRows = findCompleteRows(board).join(",");
    canvas.dataset.bottomFilled = String(board[rows - 1].filter(Boolean).length);
    canvas.dataset.level = String(level);
    canvas.dataset.totalLines = String(lines);
    canvas.dataset.levelLines = String(getLevelProgress(lines).linesInLevel);
    canvas.dataset.dropInterval = String(dropInterval());
  }
}

function drawGrid(context, width, height, size) {
  context.fillStyle = "#151c1a";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255, 255, 255, 0.045)";
  context.lineWidth = 1;
  for (let x = size; x < width; x += size) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = size; y < height; y += size) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
}

function drawBoard() {
  const clearProgress = clearAnimation
    ? Math.min(1, (performance.now() - clearAnimation.startedAt) / clearDuration)
    : 0;
  const clearingRows = new Set(clearAnimation?.rows ?? []);

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) {
        if (clearingRows.has(y)) {
          drawClearingCell(x, y, palettes[type], clearProgress);
        } else {
          drawCell(ctx, x * block, y * block, block, palettes[type]);
        }
      }
    });
  });

  if (clearAnimation) {
    drawClearSweep(clearAnimation.rows, clearProgress);
  }
}

function drawClearingCell(x, y, color, progress) {
  const distanceFromCenter = Math.abs(x - (cols - 1) / 2) / (cols / 2);
  const delayedProgress = Math.max(0, Math.min(1, (progress - distanceFromCenter * 0.09) / 0.91));
  const collapse = delayedProgress < 0.42 ? 0 : (delayedProgress - 0.42) / 0.58;
  const scaleX = Math.max(0.04, 1 - collapse);

  ctx.save();
  ctx.globalAlpha = Math.max(0.08, 1 - collapse * 0.92);
  ctx.translate(x * block + block / 2, y * block + block / 2);
  ctx.scale(scaleX, 1 - collapse * 0.45);
  drawCell(ctx, -block / 2, -block / 2, block, color);
  if (delayedProgress < 0.5) {
    ctx.globalAlpha = 0.75 * (1 - delayedProgress / 0.5);
    ctx.fillStyle = "#fff7cf";
    ctx.fillRect(-block / 2 + 3, -block / 2 + 3, block - 6, block - 6);
  }
  ctx.restore();
}

function drawClearSweep(rowIndexes, progress) {
  const sweepWidth = canvas.width * Math.sin(Math.min(1, progress) * Math.PI);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 0.8 - progress * 0.7);
  ctx.fillStyle = "#fff0a8";
  for (const rowIndex of rowIndexes) {
    ctx.fillRect((canvas.width - sweepWidth) / 2, rowIndex * block + block * 0.42, sweepWidth, block * 0.16);
  }
  ctx.restore();
}

function drawPiece(context, matrix, offsetX, offsetY, type, size) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && offsetY + y >= 0) {
        drawCell(context, (offsetX + x) * size, (offsetY + y) * size, size, palettes[type]);
      }
    });
  });
}

function drawCell(context, x, y, size, color) {
  context.fillStyle = color;
  context.fillRect(x + 2, y + 2, size - 4, size - 4);
  context.fillStyle = "rgba(255, 255, 255, 0.25)";
  context.fillRect(x + 4, y + 4, size - 8, 4);
  context.strokeStyle = "rgba(0, 0, 0, 0.22)";
  context.strokeRect(x + 2.5, y + 2.5, size - 5, size - 5);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawGrid(nextCtx, nextCanvas.width, nextCanvas.height, 24);
  const matrix = next.matrix;
  const startX = Math.floor((4 - matrix[0].length) / 2);
  const startY = Math.floor((4 - matrix.length) / 2);
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(nextCtx, (startX + x) * 24, (startY + y) * 24, 24, palettes[next.type]);
      }
    });
  });
}

function renderHud() {
  const progress = getLevelProgress(lines);
  scoreEl.textContent = formatScore(score);
  bestEl.textContent = formatScore(best);
  levelEl.textContent = `${level}/${levelConfigs.length}`;
  linesEl.textContent = `${progress.linesInLevel}/20`;
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

function togglePause() {
  if (phase === "playing") {
    phase = "paused";
    pauseButton.textContent = "继续";
    showStatus("暂停", "方块待命", "继续");
    return;
  }

  if (phase === "paused") {
    phase = "playing";
    pauseButton.textContent = "暂停";
    hideStatus();
    canvas.focus();
  }
}

function handleStatusAction() {
  if (phase === "paused") {
    togglePause();
    return;
  }
  if (phase === "level-transition") {
    phase = "playing";
    pauseButton.disabled = false;
    hideStatus();
    dropCounter = 0;
    canvas.focus();
  }
}

function recordRound() {
  if (roundRecorded) {
    return { record: getGameRecord(gameId), newHighScore: false };
  }

  roundRecorded = true;
  return saveGameResult(gameId, {
    score,
    highestLevel: level,
    completed: phase === "completed",
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
  pauseButton.disabled = true;
  hideStatus();
  renderHud();

  try {
    window.parent.postMessage({ type: "credius:records-updated" }, "*");
  } catch {
    // Standalone play does not need parent messaging.
  }
}

function updateSoundButton() {
  soundButton.textContent = getSettings().soundEnabled ? "♪" : "♪̸";
}

function returnToLobby() {
  if (score > 0 && !roundRecorded) {
    recordRound();
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "credius:close-game" }, "*");
    window.parent.postMessage({ type: "credius:records-updated" }, "*");
    return;
  }
  window.location.href = "../../index.html";
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    move(-1);
  } else if (key === "arrowright" || key === "d") {
    event.preventDefault();
    move(1);
  } else if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    softDrop();
  } else if (key === "arrowup" || key === "w") {
    event.preventDefault();
    rotatePiece();
  } else if (key === " ") {
    event.preventDefault();
    hardDrop();
  } else if (key === "p") {
    event.preventDefault();
    togglePause();
  }
}

function handleControl(control) {
  if (control === "left") {
    move(-1);
  } else if (control === "right") {
    move(1);
  } else if (control === "down") {
    softDrop();
  } else if (control === "rotate") {
    rotatePiece();
  } else if (control === "drop") {
    hardDrop();
  }
  draw();
  canvas.focus();
}

controlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button instanceof HTMLElement) {
      handleControl(button.dataset.control ?? "");
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
statusButton.addEventListener("click", handleStatusAction);
backLobby.addEventListener("click", returnToLobby);
settlementLobby.addEventListener("click", returnToLobby);
playAgain.addEventListener("click", newGame);
shareResult.addEventListener("click", () => {
  shareOutput.textContent = `我在 CREDIUS ARCADE 的俄罗斯方块拿到 ${formatScore(score)} 分，消了 ${lines} 行。`;
});
soundButton.addEventListener("click", () => {
  updateSettings({ soundEnabled: !getSettings().soundEnabled });
  updateSoundButton();
});
document.addEventListener("keydown", handleKey);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && phase === "playing") {
    togglePause();
  }
});

newGame();
if (qaEnabled) {
  const previewFourLineClear = () => {
    board = createBoard();
    for (let rowIndex = rows - 4; rowIndex < rows; rowIndex += 1) {
      board[rowIndex] = ["I", "J", "L", "O", "S", "T", "Z", "I", "J", "L"];
    }
    phase = "clearing";
    clearAnimation = {
      rows: findCompleteRows(board),
      startedAt: performance.now(),
    };
    draw();
  };

  globalThis.CrediusTetrisQA = {
    previewFourLineClear,
    previewStaleBottomRow() {
      board = createBoard();
      board[rows - 1] = ["I", "J", "L", "O", "S", "T", "Z", "I", "J", ""];
      phase = "clearing";
      clearAnimation = {
        rows: [rows - 1],
        startedAt: performance.now(),
      };
      draw();
    },
  };

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.textContent = "测试四行消除";
  previewButton.dataset.qaControl = "line-clear";
  previewButton.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:30;min-height:42px;padding:0 14px;border:1px solid #f1d27a;background:#1b2421;color:#fff;border-radius:6px;font-weight:800;";
  previewButton.addEventListener("click", previewFourLineClear);
  document.body.append(previewButton);
}
requestAnimationFrame(update);
})();
