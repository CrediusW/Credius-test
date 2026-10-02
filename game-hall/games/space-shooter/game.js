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

  const gameId = "space-shooter";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const campaignDifficulty = globalThis.CrediusArcadeCampaign.getLevelConfig(gameId, campaignLevel);
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("spaceBoard"));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const livesEl = /** @type {HTMLElement} */ (document.getElementById("lives"));
  const waveEl = /** @type {HTMLElement} */ (document.getElementById("wave"));
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

  let score = 0;
  let best = 0;
  let lives = 3;
  let wave = 1;
  let phase = "playing";
  let leftHeld = false;
  let rightHeld = false;
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let lastFrame = performance.now();
  let fireTimer = 0;
  let spawnTimer = 0;
  let player = { x: 210, y: 585, width: 34, height: 38, invincible: 0 };
  let bullets = [];
  let enemies = [];
  let particles = [];

  function newGame() {
    score = 0;
    best = getGameRecord(gameId).highScore;
    lives = campaignLevel >= 10 ? 2 : 3;
    wave = 1;
    phase = "playing";
    leftHeld = false;
    rightHeld = false;
    roundStartedAt = Date.now();
    roundRecorded = false;
    fireTimer = 0;
    spawnTimer = 0;
    bullets = [];
    enemies = [];
    particles = [];
    player = { x: canvas.width / 2, y: canvas.height - 55, width: 34, height: 38, invincible: 1.2 };
    pauseButton.textContent = "暂停";
    hideStatus();
    hideSettlement();
    updateSoundButton();
    render();
    canvas.focus();
  }

  function loop(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.033);
    lastFrame = now;
    if (phase === "playing") {
      update(delta);
    } else {
      updateParticles(delta);
    }
    render();
    requestAnimationFrame(loop);
  }

  function update(delta) {
    player.invincible = Math.max(0, player.invincible - delta);
    if (leftHeld) {
      player.x -= 260 * delta;
    }
    if (rightHeld) {
      player.x += 260 * delta;
    }
    player.x = clamp(player.x, player.width / 2, canvas.width - player.width / 2);

    fireTimer -= delta;
    if (fireTimer <= 0) {
      bullets.push({ x: player.x, y: player.y - 24, radius: 4, speed: 430 });
      fireTimer = 0.22;
    }

    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.2, (0.92 - wave * 0.045) / campaignDifficulty.densityMultiplier);
    }

    bullets.forEach((bullet) => {
      bullet.y -= bullet.speed * delta;
    });
    enemies.forEach((enemy) => {
      enemy.y += enemy.speed * delta;
      enemy.x += Math.sin(enemy.y * 0.025 + enemy.seed) * 22 * delta;
    });
    updateParticles(delta);
    handleCollisions();
    bullets = bullets.filter((bullet) => bullet.y > -20);
    enemies = enemies.filter((enemy) => enemy.y < canvas.height + 40 && enemy.hp > 0);
    wave = Math.floor(score / 650) + 1;
  }

  function spawnEnemy() {
    const size = 24 + Math.random() * 10;
    enemies.push({
      x: 30 + Math.random() * (canvas.width - 60),
      y: -30,
      size,
      hp: wave + Math.floor(campaignLevel / 4) >= 4 && Math.random() > 0.72 ? 2 : 1,
      speed: (58 + wave * 8 + Math.random() * 24) * campaignDifficulty.speedMultiplier,
      seed: Math.random() * 10,
    });
  }

  function handleCollisions() {
    bullets.forEach((bullet) => {
      enemies.forEach((enemy) => {
        if (enemy.hp <= 0) {
          return;
        }
        const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
        if (dist < bullet.radius + enemy.size * 0.55) {
          bullet.y = -100;
          enemy.hp -= 1;
          if (enemy.hp <= 0) {
            score += 90 + wave * 12;
            best = Math.max(best, score);
            burst(enemy.x, enemy.y, "#7bdff2", 12);
          }
        }
      });
    });

    enemies.forEach((enemy) => {
      const touchesPlayer =
        Math.abs(enemy.x - player.x) < enemy.size * 0.5 + player.width * 0.45 &&
        Math.abs(enemy.y - player.y) < enemy.size * 0.5 + player.height * 0.45;
      if (touchesPlayer && player.invincible <= 0) {
        enemy.hp = 0;
        lives -= 1;
        player.invincible = 1.4;
        burst(player.x, player.y, "#ff6f7d", 18);
        if (lives <= 0) {
          phase = "game-over";
          showSettlement("飞船损毁");
        }
      }
    });
  }

  function updateParticles(delta) {
    particles.forEach((particle) => {
      particle.life -= delta;
      particle.x += particle.dx * delta;
      particle.y += particle.dy * delta;
      particle.radius += particle.growth * delta;
    });
    particles = particles.filter((particle) => particle.life > 0);
  }

  function burst(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 110;
      particles.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        growth: 10,
        color,
        life: 0.42,
        maxLife: 0.42,
      });
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111719";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let star = 0; star < 48; star += 1) {
      const x = (star * 73) % canvas.width;
      const y = (star * 137 + performance.now() * 0.025) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
    bullets.forEach((bullet) => {
      ctx.fillStyle = "#f1b84b";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    enemies.forEach((enemy) => {
      ctx.fillStyle = enemy.hp > 1 ? "#ffd166" : "#ff6f7d";
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y + enemy.size * 0.55);
      ctx.lineTo(enemy.x - enemy.size * 0.55, enemy.y - enemy.size * 0.4);
      ctx.lineTo(enemy.x + enemy.size * 0.55, enemy.y - enemy.size * 0.4);
      ctx.closePath();
      ctx.fill();
    });
    particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.save();
    if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }
    ctx.fillStyle = "#7bdff2";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - player.height / 2);
    ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    scoreEl.textContent = formatScore(score);
    bestEl.textContent = formatScore(best);
    livesEl.textContent = String(lives);
    waveEl.textContent = String(wave);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "星域待命", "继续");
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
      score,
      highestLevel: wave,
      playTime: Math.round((Date.now() - roundStartedAt) / 1000),
    });
  }

  function showSettlement(reason) {
    const result = recordRound();
    finalScore.textContent = formatScore(score);
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
    if (key === "arrowleft" || key === "a") {
      leftHeld = true;
    } else if (key === "arrowright" || key === "d") {
      rightHeld = true;
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  });
  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      leftHeld = false;
    } else if (key === "arrowright" || key === "d") {
      rightHeld = false;
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    player.x = clamp(((event.clientX - rect.left) / rect.width) * canvas.width, player.width / 2, canvas.width - player.width / 2);
  });
  canvas.addEventListener("pointerdown", () => canvas.focus());
  controlButtons.forEach((button) => {
    button.addEventListener("pointerdown", () => {
      const control = button instanceof HTMLElement ? button.dataset.control : "";
      if (control === "left") leftHeld = true;
      if (control === "right") rightHeld = true;
    });
    button.addEventListener("pointerup", () => {
      leftHeld = false;
      rightHeld = false;
    });
    button.addEventListener("pointercancel", () => {
      leftHeld = false;
      rightHeld = false;
    });
  });
  pauseButton.addEventListener("click", togglePause);
  statusButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (score > 0 && phase !== "game-over") {
      recordRound();
    }
    newGame();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的太空射击拿到 ${formatScore(score)} 分，坚持到第 ${wave} 波。`;
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
