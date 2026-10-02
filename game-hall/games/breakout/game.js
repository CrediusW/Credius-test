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
  const campaign = globalThis.CrediusArcadeCampaign;
  const {
    TOTAL_CAMPAIGN_LEVELS,
    countBreakableBricks,
    createLevelEntities,
    isLevelCleared,
    levels,
  } = globalThis.CrediusBreakoutLevels;

  const gameId = "breakout";
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("breakoutBoard"));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const livesEl = /** @type {HTMLElement} */ (document.getElementById("lives"));
  const levelEl = /** @type {HTMLElement} */ (document.getElementById("level"));
  const targetEl = /** @type {HTMLElement} */ (document.getElementById("target"));
  const timerEl = /** @type {HTMLElement} */ (document.getElementById("timer"));
  const levelSelectPanel = /** @type {HTMLElement} */ (document.getElementById("levelSelectPanel"));
  const levelCards = /** @type {HTMLElement} */ (document.getElementById("levelCards"));
  const gameStage = /** @type {HTMLElement} */ (document.getElementById("gameStage"));
  const missionKicker = /** @type {HTMLElement} */ (document.getElementById("missionKicker"));
  const missionTitle = /** @type {HTMLElement} */ (document.getElementById("missionTitle"));
  const missionFeature = /** @type {HTMLElement} */ (document.getElementById("missionFeature"));
  const chooseLevelButton = /** @type {HTMLButtonElement} */ (document.getElementById("chooseLevel"));
  const comboNotice = /** @type {HTMLElement} */ (document.getElementById("comboNotice"));
  const backLobby = /** @type {HTMLButtonElement} */ (document.getElementById("backLobby"));
  const pauseButton = /** @type {HTMLButtonElement} */ (document.getElementById("pauseGame"));
  const canvasPause = /** @type {HTMLButtonElement} */ (document.getElementById("canvasPause"));
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
  const finalTime = /** @type {HTMLElement} */ (document.getElementById("finalTime"));
  const finalLives = /** @type {HTMLElement} */ (document.getElementById("finalLives"));
  const clearResult = /** @type {HTMLElement} */ (document.getElementById("clearResult"));
  const rewardSummary = /** @type {HTMLElement} */ (document.getElementById("rewardSummary"));
  const playAgain = /** @type {HTMLButtonElement} */ (document.getElementById("playAgain"));
  const shareResult = /** @type {HTMLButtonElement} */ (document.getElementById("shareResult"));
  const settlementLobby = /** @type {HTMLButtonElement} */ (document.getElementById("settlementLobby"));
  const shareOutput = /** @type {HTMLElement} */ (document.getElementById("shareOutput"));
  const controlButtons = Array.from(document.querySelectorAll("[data-control]"));

  const PICKUP_TYPES = ["wide", "multi", "life", "slow"];
  const PICKUP_LABELS = {
    wide: "扩展挡板",
    multi: "双球",
    life: "额外生命",
    slow: "减速球",
  };
  const PICKUP_COLORS = {
    wide: "#66d9c8",
    multi: "#c5a3ff",
    life: "#ff7f91",
    slow: "#7aa7ff",
  };

  let score = 0;
  let best = 0;
  let lives = 3;
  let phase = "selecting";
  let launched = false;
  let leftHeld = false;
  let rightHeld = false;
  let pointerDragging = false;
  let elapsedSeconds = 0;
  let roundRecorded = false;
  let splitTriggered = false;
  let combo = 0;
  let lastBrickHitAt = 0;
  let pickupCycle = 0;
  let activeLevel = levels[0];
  let bricks = [];
  let movingObstacles = [];
  let particles = [];
  let pickups = [];
  let collectedPickups = [];
  let balls = [];
  let lastFrame = performance.now();
  let audioContext = null;
  const paddle = { x: 180, y: 592, width: 120, height: 14, speed: 430 };

  function requestedLevel() {
    const queryLevel = campaign.getCurrentLevel(gameId);
    const progress = campaign.getGameProgress(gameId);
    return Math.min(levels.length, progress.unlockedLevel, queryLevel);
  }

  function renderLevelCards() {
    const progress = campaign.getGameProgress(gameId);
    levelCards.innerHTML = Array.from({ length: TOTAL_CAMPAIGN_LEVELS }, (_, index) => {
      const levelId = index + 1;
      const entry = levels[index];
      const result = progress.levels[levelId];
      const reserved = !entry;
      const locked = reserved || levelId > progress.unlockedLevel;
      const stateLabel = reserved
        ? "待制作"
        : result.cleared
          ? "✓ 已通关"
          : locked
            ? "未解锁"
            : "开始";
      const ariaLabel = reserved
        ? `第 ${levelId} 关尚未制作`
        : locked
          ? `第 ${levelId} 关未解锁`
          : `开始第 ${levelId} 关 ${entry.name}，${result.cleared ? "已通关" : "未通关"}`;
      return `
        <button
          class="level-card ${reserved ? "reserved" : ""} ${result?.cleared ? "cleared" : ""}"
          style="--level-accent:${entry?.accent ?? "#63706c"}"
          type="button"
          ${entry ? `data-breakout-level="${levelId}"` : ""}
          ${locked ? "disabled" : ""}
          aria-label="${ariaLabel}"
        >
          <span class="level-card-number">${levelId}</span>
          <span class="level-card-name">${entry?.name ?? "即将开放"}</span>
          <span class="level-card-state">${stateLabel}</span>
        </button>
      `;
    }).join("");
  }

  function showLevelSelect() {
    phase = "selecting";
    launched = false;
    leftHeld = false;
    rightHeld = false;
    hideStatus();
    hideSettlement();
    gameStage.hidden = true;
    levelSelectPanel.hidden = false;
    pauseButton.textContent = "暂停";
    renderLevelCards();
    window.scrollTo?.(0, 0);
  }

  function startLevel(levelId) {
    const progress = campaign.getGameProgress(gameId);
    const safeLevel = Math.min(levels.length, Math.max(1, Math.floor(Number(levelId) || 1)));
    if (safeLevel > progress.unlockedLevel) return;

    activeLevel = levels[safeLevel - 1];
    score = 0;
    best = getGameRecord(gameId).highScore;
    lives = 3;
    phase = "playing";
    launched = false;
    elapsedSeconds = 0;
    roundRecorded = false;
    splitTriggered = false;
    combo = 0;
    lastBrickHitAt = 0;
    pickupCycle = 0;
    particles = [];
    pickups = [];
    collectedPickups = [];
    paddle.width = 120;
    bricks = createLevelEntities(activeLevel, { canvasWidth: canvas.width });
    movingObstacles = (activeLevel.movingObstacles ?? []).map((obstacle) => ({
      ...obstacle,
      direction: 1,
      type: "moving-steel",
    }));
    resetBalls(false);
    hideStatus();
    hideSettlement();
    levelSelectPanel.hidden = true;
    gameStage.hidden = false;
    pauseButton.textContent = "暂停";
    updateMission();
    updateSoundButton();
    updateHud();
    lastFrame = performance.now();
    render();
    window.scrollTo?.(0, 0);
    canvas.focus();
  }

  function updateMission() {
    const total = countBreakableBricks(bricks.length ? bricks : activeLevel);
    missionKicker.textContent = `第 ${activeLevel.id} 关 · 清空 ${total} 块砖`;
    missionTitle.textContent = activeLevel.name;
    missionFeature.textContent = activeLevel.features.join(" · ");
    levelEl.textContent = String(activeLevel.id);
    targetEl.textContent = String(remainingBreakable());
    const chip = document.querySelector(".campaign-level-chip");
    if (chip) {
      chip.innerHTML = `
        <span>关卡</span><strong>${activeLevel.id}/${TOTAL_CAMPAIGN_LEVELS}</strong>
        <small>清空 ${total} 块可破坏砖</small>
      `;
    }
  }

  function remainingBreakable() {
    return bricks.filter((brick) => brick.type !== "steel" && brick.hp > 0).length;
  }

  function resetBalls(autoLaunch) {
    launched = autoLaunch;
    paddle.x = (canvas.width - paddle.width) / 2;
    const speed = (275 + activeLevel.id * 15)
      * campaign.getLevelConfig(gameId, activeLevel.id).speedMultiplier;
    balls = [{
      x: paddle.x + paddle.width / 2,
      y: paddle.y - 11,
      radius: 8,
      dx: speed * (lives % 2 ? 0.68 : -0.68),
      dy: -speed,
    }];
  }

  function launch() {
    if (phase === "playing") {
      launched = true;
      playTone(420, 0.045, "sine", 0.035);
    }
  }

  function update(delta) {
    elapsedSeconds += delta;
    updatePaddle(delta);
    updateMovingObstacles(delta);
    updateParticles(delta);
    updatePickups(delta);

    if (!launched) {
      if (balls[0]) {
        balls[0].x = paddle.x + paddle.width / 2;
        balls[0].y = paddle.y - balls[0].radius - 2;
      }
      return;
    }

    for (const ball of balls) {
      if (phase !== "playing") break;
      updateBall(ball, delta);
    }
    balls = balls.filter((ball) => ball.y - ball.radius <= canvas.height + 12);

    if (phase === "playing" && balls.length === 0) {
      lives -= 1;
      combo = 0;
      if (lives <= 0) {
        phase = "game-over";
        showSettlement("挑战失败", false);
      } else {
        resetBalls(false);
      }
    }
  }

  function updatePaddle(delta) {
    if (leftHeld) paddle.x -= paddle.speed * delta;
    if (rightHeld) paddle.x += paddle.speed * delta;
    paddle.x = clamp(paddle.x, 0, canvas.width - paddle.width);
  }

  function updateMovingObstacles(delta) {
    movingObstacles.forEach((obstacle) => {
      obstacle.x += obstacle.speed * obstacle.direction * delta;
      if (obstacle.x <= obstacle.minX || obstacle.x >= obstacle.maxX) {
        obstacle.x = clamp(obstacle.x, obstacle.minX, obstacle.maxX);
        obstacle.direction *= -1;
      }
    });
  }

  function updateParticles(delta) {
    particles.forEach((particle) => {
      particle.x += particle.dx * delta;
      particle.y += particle.dy * delta;
      particle.dy += 130 * delta;
      particle.life -= delta;
    });
    particles = particles.filter((particle) => particle.life > 0);
  }

  function updatePickups(delta) {
    pickups.forEach((pickup) => {
      pickup.y += pickup.speed * delta;
      pickup.rotation += delta * 2.5;
      if (
        pickup.x + pickup.width / 2 > paddle.x
        && pickup.x - pickup.width / 2 < paddle.x + paddle.width
        && pickup.y + pickup.height / 2 > paddle.y
        && pickup.y - pickup.height / 2 < paddle.y + paddle.height
      ) {
        pickup.collected = true;
        applyPickup(pickup.type);
      }
    });
    pickups = pickups.filter((pickup) => !pickup.collected && pickup.y < canvas.height + 24);
  }

  function updateBall(ball, delta) {
    const previousX = ball.x;
    const previousY = ball.y;
    ball.x += ball.dx * delta;
    ball.y += ball.dy * delta;

    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= canvas.width) {
      ball.dx *= -1;
      ball.x = clamp(ball.x, ball.radius, canvas.width - ball.radius);
      playTone(180, 0.025, "square", 0.012);
    }
    if (ball.y - ball.radius <= 0) {
      ball.dy = Math.abs(ball.dy);
      ball.y = ball.radius;
      playTone(180, 0.025, "square", 0.012);
    }

    if (intersectsPaddle(ball)) {
      const hit = clamp(
        (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2),
        -1,
        1,
      );
      const speed = Math.min(520, Math.hypot(ball.dx, ball.dy) + 7);
      ball.dx = speed * hit * 0.88;
      ball.dy = -Math.sqrt(Math.max(12000, speed * speed - ball.dx * ball.dx));
      ball.y = paddle.y - ball.radius - 1;
      playTone(270 + Math.abs(hit) * 130, 0.035, "triangle", 0.025);
    }

    for (const obstacle of movingObstacles) {
      if (circleIntersectsRect(ball, obstacle)) {
        resolveBallRect(ball, obstacle, previousX, previousY);
        spawnParticles(ball.x, ball.y, "#b7c3c7", 4);
        playTone(130, 0.04, "square", 0.02);
        return;
      }
    }

    for (const brick of bricks) {
      if (brick.hp <= 0 || !circleIntersectsRect(ball, brick)) continue;
      resolveBallRect(ball, brick, previousX, previousY);
      hitBrick(brick);
      return;
    }
  }

  function hitBrick(brick) {
    if (brick.type === "steel") {
      spawnParticles(
        brick.x + brick.width / 2,
        brick.y + brick.height / 2,
        "#aebbc0",
        4,
      );
      playTone(110, 0.055, "square", 0.025);
      return;
    }

    const now = performance.now();
    combo = now - lastBrickHitAt <= 2200 ? combo + 1 : 1;
    lastBrickHitAt = now;
    brick.hp -= 1;
    spawnParticles(
      brick.x + brick.width / 2,
      brick.y + brick.height / 2,
      brickColor(brick),
      brick.hp > 0 ? 6 : 12,
    );

    if (brick.hp > 0) {
      addScore(Math.round(35 * activeLevel.scoreMultiplier));
      playTone(240, 0.045, "square", 0.03);
    } else {
      const comboBonus = Math.min(8, Math.max(0, combo - 1)) * 12;
      addScore(brickPoints(brick) + comboBonus);
      playTone(330 + Math.min(combo, 8) * 28, 0.06, "triangle", 0.04);
      if (combo >= 2) showFeedback(`${combo} COMBO`);
      if (brick.type === "explosive") explodeBrick(brick);
      if (brick.type === "bonus") spawnPickup(brick);
    }

    checkSpecialBall();
    checkLevelClear();
  }

  function explodeBrick(origin) {
    let cleared = 0;
    bricks.forEach((brick) => {
      if (
        brick.hp <= 0
        || brick.type === "steel"
        || brick.id === origin.id
        || Math.abs(brick.row - origin.row) > 1
        || Math.abs(brick.col - origin.col) > 1
      ) {
        return;
      }
      brick.hp = 0;
      cleared += 1;
      addScore(Math.round(brickPoints(brick) * 0.7));
      spawnParticles(
        brick.x + brick.width / 2,
        brick.y + brick.height / 2,
        brickColor(brick),
        9,
      );
      if (brick.type === "bonus") spawnPickup(brick);
    });
    showFeedback(cleared ? `爆破 ×${cleared + 1}` : "爆破");
    playTone(92, 0.16, "sawtooth", 0.065);
  }

  function spawnPickup(brick) {
    const type = PICKUP_TYPES[pickupCycle % PICKUP_TYPES.length];
    pickupCycle += 1;
    pickups.push({
      type,
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      width: 28,
      height: 16,
      speed: 92,
      rotation: 0,
      collected: false,
    });
    showFeedback(`补给掉落：${PICKUP_LABELS[type]}`);
    playTone(720, 0.1, "sine", 0.045);
  }

  function applyPickup(type) {
    collectedPickups.push(type);
    if (type === "wide") {
      const center = paddle.x + paddle.width / 2;
      paddle.width = Math.min(184, paddle.width + 44);
      paddle.x = clamp(center - paddle.width / 2, 0, canvas.width - paddle.width);
    } else if (type === "multi" && balls.length > 0) {
      const sources = balls.slice(0, Math.min(2, balls.length));
      sources.forEach((source) => {
        if (balls.length >= 4) return;
        balls.push({
          ...source,
          x: source.x + source.radius * 2,
          dx: source.dx === 0 ? 230 : -source.dx,
          dy: -Math.abs(source.dy),
        });
      });
      launched = true;
    } else if (type === "life") {
      lives = Math.min(5, lives + 1);
    } else if (type === "slow") {
      balls.forEach((ball) => {
        ball.dx *= 0.72;
        ball.dy *= 0.72;
      });
    }
    showFeedback(`获得 ${PICKUP_LABELS[type]}`);
    spawnParticles(paddle.x + paddle.width / 2, paddle.y, PICKUP_COLORS[type], 18);
    playArpeggio([520, 660, 820]);
  }

  function brickPoints(brick) {
    const base = brick.type === "reinforced"
      ? 130
      : brick.type === "bonus"
        ? 150
        : brick.type === "explosive"
          ? 135
          : 100;
    return Math.round(base * activeLevel.scoreMultiplier);
  }

  function addScore(points) {
    score += Math.max(0, Math.round(points));
    best = Math.max(best, score);
  }

  function checkSpecialBall() {
    if (
      splitTriggered
      || !activeLevel.splitScore
      || score < activeLevel.splitScore
      || balls.length === 0
    ) {
      return;
    }
    splitTriggered = true;
    const source = balls[0];
    balls.push({
      ...source,
      x: source.x + source.radius * 2,
      dx: source.dx === 0 ? 230 : -source.dx,
      dy: -Math.abs(source.dy),
    });
    showFeedback("双球觉醒！");
    spawnParticles(source.x, source.y, "#c5a3ff", 24);
    playArpeggio([520, 660, 820]);
  }

  function checkLevelClear() {
    if (phase !== "playing" || !isLevelCleared(bricks)) return;
    phase = "level-complete";
    launched = false;
    showSettlement("全部清场", true);
    playArpeggio([440, 554, 660, 880]);
  }

  function showFeedback(message) {
    comboNotice.textContent = message;
    comboNotice.classList.remove("show");
    requestAnimationFrame(() => comboNotice.classList.add("show"));
  }

  function spawnParticles(x, y, color, count) {
    const reduceMotion = getSettings().reduceMotion;
    const amount = reduceMotion ? Math.min(3, count) : count;
    for (let index = 0; index < amount; index += 1) {
      const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.35;
      const speed = 35 + Math.random() * 110;
      particles.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 30,
        size: 2 + Math.random() * 3,
        color,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
      });
    }
  }

  function loop(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.033);
    lastFrame = now;
    if (phase === "playing") update(delta);
    if (!gameStage.hidden) render();
    requestAnimationFrame(loop);
  }

  function render() {
    drawBackground();
    bricks.forEach(drawBrick);
    movingObstacles.forEach(drawMovingObstacle);
    pickups.forEach(drawPickup);
    drawPaddle();
    balls.forEach(drawBall);
    particles.forEach(drawParticle);
    updateHud();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#111817");
    gradient.addColorStop(1, "#0b0f0e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    for (let x = 24; x < canvas.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    ctx.fillStyle = hexWithAlpha(activeLevel.accent, 0.08);
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 160, 230, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBrick(brick) {
    if (brick.hp <= 0) return;
    ctx.save();
    ctx.fillStyle = brickColor(brick);
    roundedRect(brick.x, brick.y, brick.width, brick.height, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundedRect(brick.x + 2, brick.y + 2, brick.width - 4, 3, 1.5);
    ctx.fill();

    if (brick.type === "steel") {
      ctx.fillStyle = "#d8e0e1";
      ctx.beginPath();
      ctx.arc(brick.x + 6, brick.y + 6, 1.6, 0, Math.PI * 2);
      ctx.arc(brick.x + brick.width - 6, brick.y + brick.height - 6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (brick.type === "explosive") {
      ctx.strokeStyle = "#fff2d6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(brick.x + brick.width / 2, brick.y + brick.height / 2, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (brick.type === "bonus") {
      ctx.fillStyle = "#103f32";
      ctx.font = "900 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", brick.x + brick.width / 2, brick.y + brick.height / 2 + 1);
    } else if (brick.hp > 1) {
      ctx.fillStyle = "rgba(59,35,4,0.6)";
      ctx.fillRect(brick.x + brick.width / 2 - 5, brick.y + 9, 10, 2);
    }
    ctx.restore();
  }

  function brickColor(brick) {
    if (brick.type === "steel") return "#738187";
    if (brick.type === "reinforced") return brick.hp > 1 ? "#f1b84b" : "#ffd982";
    if (brick.type === "explosive") return "#ff5f6d";
    if (brick.type === "bonus") return "#68e2ac";
    return activeLevel.accent;
  }

  function drawMovingObstacle(obstacle) {
    ctx.save();
    ctx.fillStyle = "#8d9da3";
    roundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 3, obstacle.width - 16, 2);
    ctx.fillStyle = "#dce5e7";
    ctx.font = "900 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("◀  MOVING WALL  ▶", obstacle.x + obstacle.width / 2, obstacle.y + 11);
    ctx.restore();
  }

  function drawPickup(pickup) {
    const color = PICKUP_COLORS[pickup.type];
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(Math.sin(pickup.rotation) * 0.12);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    roundedRect(-pickup.width / 2, -pickup.height / 2, pickup.width, pickup.height, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10201e";
    ctx.font = "900 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icon = pickup.type === "wide"
      ? "↔"
      : pickup.type === "multi"
        ? "×2"
        : pickup.type === "life"
          ? "+1"
          : "S";
    ctx.fillText(icon, 0, 1);
    ctx.restore();
  }

  function drawPaddle() {
    const gradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
    gradient.addColorStop(0, "#45b9ab");
    gradient.addColorStop(0.5, "#b7fff4");
    gradient.addColorStop(1, "#45b9ab");
    ctx.fillStyle = gradient;
    roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 7);
    ctx.fill();
  }

  function drawBall(ball) {
    ctx.save();
    ctx.shadowColor = activeLevel.accent;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f7fff9";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticle(particle) {
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function updateHud() {
    scoreEl.textContent = formatScore(score);
    bestEl.textContent = formatScore(best);
    livesEl.textContent = String(lives);
    levelEl.textContent = String(activeLevel.id);
    targetEl.textContent = String(remainingBreakable());
    timerEl.textContent = formatTime(elapsedSeconds);
  }

  function intersectsPaddle(ball) {
    return (
      ball.x + ball.radius > paddle.x
      && ball.x - ball.radius < paddle.x + paddle.width
      && ball.y + ball.radius > paddle.y
      && ball.y - ball.radius < paddle.y + paddle.height
      && ball.dy > 0
    );
  }

  function circleIntersectsRect(ball, rect) {
    const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
    const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  function resolveBallRect(ball, rect, previousX, previousY) {
    if (previousY + ball.radius <= rect.y && ball.dy > 0) {
      ball.dy = -Math.abs(ball.dy);
      ball.y = rect.y - ball.radius - 0.5;
    } else if (previousY - ball.radius >= rect.y + rect.height && ball.dy < 0) {
      ball.dy = Math.abs(ball.dy);
      ball.y = rect.y + rect.height + ball.radius + 0.5;
    } else if (previousX + ball.radius <= rect.x && ball.dx > 0) {
      ball.dx = -Math.abs(ball.dx);
      ball.x = rect.x - ball.radius - 0.5;
    } else if (previousX - ball.radius >= rect.x + rect.width && ball.dx < 0) {
      ball.dx = Math.abs(ball.dx);
      ball.x = rect.x + rect.width + ball.radius + 0.5;
    } else {
      ball.dy *= -1;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexWithAlpha(hex, alpha) {
    const value = hex.replace("#", "");
    const number = Number.parseInt(value, 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "球场待命", "继续");
    } else if (phase === "paused") {
      phase = "playing";
      pauseButton.textContent = "暂停";
      hideStatus();
      lastFrame = performance.now();
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
    document.getElementById("campaignSettlement")?.remove();
  }

  function recordRound(completed) {
    if (roundRecorded) {
      return { record: getGameRecord(gameId), newHighScore: false };
    }
    roundRecorded = true;
    return saveGameResult(gameId, {
      score,
      highestLevel: activeLevel.id,
      playTime: Math.round(elapsedSeconds),
      completed,
    });
  }

  function showSettlement(reason, completed) {
    const result = recordRound(completed);
    const remaining = remainingBreakable();
    finalScore.textContent = formatScore(score);
    finalBest.textContent = formatScore(result.record.highScore);
    finalTime.textContent = formatTime(elapsedSeconds);
    finalLives.textContent = String(lives);
    settlementKicker.textContent = completed
      ? `第 ${activeLevel.id} 关完成`
      : result.newHighScore
        ? "新纪录"
        : "本局结束";
    settlementTitle.textContent = reason;
    clearResult.textContent = completed ? "✓ 所有可破坏砖块已清空" : `还剩 ${remaining} 块砖`;
    clearResult.setAttribute("aria-label", completed ? "已通关" : "未通关");
    const pickupNames = [...new Set(collectedPickups.map((type) => PICKUP_LABELS[type]))];
    rewardSummary.textContent = completed
      ? pickupNames.length
        ? `本关获得：${pickupNames.join("、")}。${activeLevel.id < levels.length ? "点击进入下一关。" : "五关挑战全部完成。"}`
        : "没有星级评价；清空砖阵就是唯一的通关标准。"
      : `必须把剩余 ${remaining} 块可破坏砖清掉才算通过。`;
    playAgain.textContent = completed && activeLevel.id < levels.length ? "进入下一关" : "再试一次";
    settlementPanel.hidden = false;
    hideStatus();
    postRecordUpdate();
    renderLevelCards();
  }

  function postRecordUpdate() {
    try {
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
    } catch {
      // Standalone play does not need parent messaging.
    }
  }

  function returnToLobby() {
    if (score > 0 && !roundRecorded) recordRound(false);
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

  function playTone(frequency, duration, type, volume) {
    if (!getSettings().soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ??= new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Audio feedback is optional when Web Audio is unavailable.
    }
  }

  function playArpeggio(notes) {
    notes.forEach((note, index) => {
      window.setTimeout(() => playTone(note, 0.11, "sine", 0.045), index * 90);
    });
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      leftHeld = true;
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      rightHeld = true;
    } else if (key === " " || key === "arrowup" || key === "w") {
      event.preventDefault();
      launch();
    } else if (key === "p" || key === "escape") {
      event.preventDefault();
      togglePause();
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") leftHeld = false;
    if (key === "arrowright" || key === "d") rightHeld = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    pointerDragging = true;
    canvas.setPointerCapture?.(event.pointerId);
    movePaddleToPointer(event);
    launch();
    canvas.focus();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointerDragging) movePaddleToPointer(event);
  });
  canvas.addEventListener("pointerup", () => {
    pointerDragging = false;
  });
  canvas.addEventListener("pointercancel", () => {
    pointerDragging = false;
  });

  function movePaddleToPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    paddle.x = clamp(x - paddle.width / 2, 0, canvas.width - paddle.width);
  }

  controlButtons.forEach((button) => {
    button.addEventListener("pointerdown", () => {
      const control = button instanceof HTMLElement ? button.dataset.control : "";
      if (control === "left") leftHeld = true;
      else if (control === "right") rightHeld = true;
      else launch();
    });
    button.addEventListener("pointerup", stopHeldControls);
    button.addEventListener("pointercancel", stopHeldControls);
  });

  function stopHeldControls() {
    leftHeld = false;
    rightHeld = false;
  }

  levelCards.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-breakout-level]")
      : null;
    if (target instanceof HTMLButtonElement && !target.disabled) {
      startLevel(Number(target.dataset.breakoutLevel));
    }
  });

  pauseButton.addEventListener("click", togglePause);
  canvasPause.addEventListener("click", togglePause);
  statusButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (phase === "selecting") {
      startLevel(requestedLevel());
      return;
    }
    if (score > 0 && !roundRecorded) recordRound(false);
    startLevel(activeLevel.id);
  });
  chooseLevelButton.addEventListener("click", () => {
    if (score > 0 && !roundRecorded) recordRound(false);
    showLevelSelect();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", () => {
    const nextLevel = phase === "level-complete" && activeLevel.id < levels.length
      ? activeLevel.id + 1
      : activeLevel.id;
    startLevel(nextLevel);
  });
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 打砖块第 ${activeLevel.id} 关${phase === "level-complete" ? "完成清场" : `打到 ${formatScore(score)} 分`}，用时 ${formatTime(elapsedSeconds)}。`;
  });
  soundButton.addEventListener("click", () => {
    updateSettings({ soundEnabled: !getSettings().soundEnabled });
    updateSoundButton();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && phase === "playing") togglePause();
  });

  globalThis.CrediusBreakoutDebug = {
    getState() {
      return {
        activeLevel: activeLevel.id,
        phase,
        remainingBricks: remainingBreakable(),
        score,
        pickups: pickups.map((pickup) => pickup.type),
      };
    },
  };

  updateSoundButton();
  activeLevel = levels[requestedLevel() - 1];
  bricks = createLevelEntities(activeLevel, { canvasWidth: canvas.width });
  updateMission();
  renderLevelCards();
  showLevelSelect();
  requestAnimationFrame(loop);
})();
