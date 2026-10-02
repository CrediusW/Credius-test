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

  const gameId = "last-stand";
  const campaign = globalThis.CrediusArcadeCampaign;
  const { TOTAL_LEVELS, getLevel, levels } = globalThis.CrediusLastStandLevels;
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("standBoard"));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const hpEl = /** @type {HTMLElement} */ (document.getElementById("hp"));
  const hpFillEl = /** @type {HTMLElement} */ (document.getElementById("hpFill"));
  const timerEl = /** @type {HTMLElement} */ (document.getElementById("timer"));
  const squadEl = /** @type {HTMLElement} */ (document.getElementById("squad"));
  const arsenalEl = /** @type {HTMLElement} */ (document.getElementById("arsenal"));
  const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const levelSelectPanel = /** @type {HTMLElement} */ (document.getElementById("levelSelectPanel"));
  const levelCards = /** @type {HTMLElement} */ (document.getElementById("levelCards"));
  const gameStage = /** @type {HTMLElement} */ (document.getElementById("gameStage"));
  const chooseLevelButton = /** @type {HTMLButtonElement} */ (document.getElementById("chooseLevel"));
  const zoneNameEl = /** @type {HTMLElement} */ (document.getElementById("zoneName"));
  const levelNameEl = /** @type {HTMLElement} */ (document.getElementById("levelName"));
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
  const settlementLevels = /** @type {HTMLButtonElement} */ (document.getElementById("settlementLevels"));
  const shareResult = /** @type {HTMLButtonElement} */ (document.getElementById("shareResult"));
  const settlementLobby = /** @type {HTMLButtonElement} */ (document.getElementById("settlementLobby"));
  const shareOutput = /** @type {HTMLElement} */ (document.getElementById("shareOutput"));
  const controlButtons = Array.from(document.querySelectorAll("[data-control]"));

  const width = canvas.width;
  const height = canvas.height;
  const horizonY = 126;
  const defenseY = 616;
  const minX = 52;
  const maxX = width - 52;
  const keys = { left: false, right: false };

  let activeLevel = getLevel(requestedLevel());
  let roundSeconds = activeLevel.roundSeconds;
  let bossSecond = activeLevel.bossSecond;
  let campaignDifficulty = campaign.getLevelConfig(gameId, activeLevel.id);
  let state = createState();
  let lastFrame = performance.now();
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let dragging = false;

  function requestedLevel() {
    const progress = campaign.getGameProgress(gameId);
    return Math.min(TOTAL_LEVELS, progress.unlockedLevel, campaign.getCurrentLevel(gameId));
  }

  function createState() {
    return {
      phase: "playing",
      elapsed: 0,
      score: 0,
      best: getGameRecord(gameId).highScore,
      hp: 6,
      maxHp: 6,
      player: {
        x: width / 2,
        y: defenseY + 18,
        speed: 280,
        invincible: 0.8,
        hitFlash: 0,
      },
      allies: 2,
      weapon: {
        machineGuns: 0,
        spread: 0,
        ammoBoost: 0,
      },
      fireTimer: 0,
      spawnTimer: activeLevel.enemyGrace,
      rewardTimer: 1.15,
      targets: [],
      bullets: [],
      pickups: [],
      particles: [],
      texts: [],
      bossSpawned: false,
      bossDefeated: false,
      rewardCount: 0,
      kills: 0,
      unlocks: 0,
      nextId: 1,
      shake: 0,
      alertPulse: 0,
    };
  }

  function renderLevelCards() {
    const progress = campaign.getGameProgress(gameId);
    levelCards.innerHTML = levels.map((level) => {
      const result = progress.levels[level.id];
      const locked = level.id > progress.unlockedLevel;
      const stateLabel = result.cleared ? "✓ 已守住" : locked ? "未解锁" : "部署";
      const ariaLabel = locked
        ? `第 ${level.id} 关 ${level.name} 未解锁`
        : `开始第 ${level.id} 关 ${level.name}，${result.cleared ? "已通关" : "未通关"}`;
      return `
        <button
          class="level-card ${result.cleared ? "cleared" : ""}"
          style="--level-accent:${level.accent};--sky-top:${level.theme.skyTop};--sky-bottom:${level.theme.skyBottom};--road:${level.theme.roadBottom}"
          type="button"
          data-stand-level="${level.id}"
          ${locked ? "disabled" : ""}
          aria-label="${ariaLabel}"
        >
          <span class="level-preview" aria-hidden="true"></span>
          <span class="level-card-copy">
            <span class="level-card-number">区域 ${String(level.id).padStart(2, "0")}</span>
            <span class="level-card-name">${level.name}</span>
            <span class="level-card-feature">${level.feature}</span>
            <span class="level-card-state">${stateLabel}</span>
          </span>
        </button>
      `;
    }).join("");
  }

  function showLevelSelect() {
    state.phase = "selecting";
    keys.left = false;
    keys.right = false;
    hideStatus();
    hideSettlement();
    gameStage.hidden = true;
    levelSelectPanel.hidden = false;
    zoneNameEl.textContent = "五区战役";
    levelNameEl.textContent = "选择防线";
    pauseButton.textContent = "暂停";
    renderLevelCards();
    window.scrollTo?.(0, 0);
  }

  function startLevel(levelId) {
    const progress = campaign.getGameProgress(gameId);
    const safeLevel = Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(Number(levelId) || 1)));
    if (safeLevel > progress.unlockedLevel) return;

    activeLevel = getLevel(safeLevel);
    roundSeconds = activeLevel.roundSeconds;
    bossSecond = activeLevel.bossSecond;
    campaignDifficulty = campaign.getLevelConfig(gameId, activeLevel.id);
    document.documentElement.style.setProperty("--level-accent", activeLevel.accent);
    zoneNameEl.textContent = activeLevel.zone;
    levelNameEl.textContent = activeLevel.name;
    levelSelectPanel.hidden = true;
    gameStage.hidden = false;
    updateCampaignChip();
    newGame();
    window.scrollTo?.(0, 0);
  }

  function updateCampaignChip() {
    const chip = document.querySelector(".campaign-level-chip");
    if (!chip) return;
    const threshold = campaign.getLevelConfig(gameId, activeLevel.id).thresholds[0];
    chip.innerHTML = `<span>关卡</span><strong>${activeLevel.id}/${TOTAL_LEVELS}</strong><small>${threshold} 分过关</small>`;
  }

  function newGame() {
    state = createState();
    roundStartedAt = Date.now();
    roundRecorded = false;
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
    if (state.phase === "playing") {
      update(delta);
    } else {
      updateEffects(delta);
    }
    render();
    requestAnimationFrame(loop);
  }

  function update(delta) {
    state.elapsed += delta;
    state.player.invincible = Math.max(0, state.player.invincible - delta);
    state.player.hitFlash = Math.max(0, state.player.hitFlash - delta);
    state.shake = Math.max(0, state.shake - delta * 18);
    state.alertPulse += delta;

    if (keys.left) {
      state.player.x -= state.player.speed * delta;
    }
    if (keys.right) {
      state.player.x += state.player.speed * delta;
    }
    state.player.x = clamp(state.player.x, minX, maxX);

    state.fireTimer -= delta;
    if (state.fireTimer <= 0) {
      fireVolley();
      state.fireTimer = getFireInterval();
    }

    if (!state.bossSpawned && state.elapsed >= bossSecond) {
      spawnBoss();
    }

    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0 && !state.bossDefeated) {
      spawnEnemyWave();
      state.spawnTimer = getEnemyInterval();
    }

    const activeReward = state.targets.some((target) => target.kind === "reward" && !target.dead);
    if (!activeReward) {
      state.rewardTimer -= delta;
      if (state.rewardTimer <= 0 && !state.bossSpawned) {
        spawnReward();
        state.rewardTimer = getRewardInterval();
      }
    }

    updateBullets(delta);
    updateTargets(delta);
    updatePickups(delta);
    updateEffects(delta);
    handleCollisions();
    sweepDeadObjects();

    const timeLeft = roundSeconds - state.elapsed;
    if (timeLeft <= 0 && state.phase === "playing") {
      if (state.bossDefeated) {
        endRound("守住了最后一波", true);
      } else {
        endRound("Boss 冲破防线", false);
      }
    }
  }

  function fireVolley() {
    const shooters = getShooterPositions();
    shooters.forEach((shooter, index) => {
      const offset = (index - (shooters.length - 1) / 2) * 0.012;
      fireBullet(shooter.x, shooter.y - 12, offset, "#ffe071", 1, 0);
    });

    for (let spreadIndex = 0; spreadIndex < state.weapon.spread; spreadIndex += 1) {
      const angle = 0.11 + spreadIndex * 0.045;
      fireBullet(state.player.x - 8, state.player.y - 42, -angle, "#ff8f66", 1, 0);
      fireBullet(state.player.x + 8, state.player.y - 42, angle, "#ff8f66", 1, 0);
    }
  }

  function fireBullet(x, y, angle, color, damage, pierce) {
    const speed = 620;
    state.bullets.push({
      x,
      worldX: x,
      y,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      radius: 4,
      color,
      damage,
      pierceLeft: pierce,
      life: 1.6,
      dead: false,
    });
  }

  function getFireInterval() {
    return clamp(
      0.215 - state.weapon.machineGuns * 0.026 - state.weapon.ammoBoost * 0.013 - state.allies * 0.005,
      0.072,
      0.22,
    );
  }

  function getEnemyInterval() {
    const difficulty = clamp(campaignDifficulty.densityMultiplier * activeLevel.enemyDensity, 0.92, 1.8);
    if (state.elapsed < 13) {
      return 2.25 / difficulty;
    }
    if (state.elapsed < 22) {
      return 1.62 / difficulty;
    }
    if (state.elapsed < 31) {
      return 1.12 / difficulty;
    }
    if (!state.bossSpawned) {
      return 0.76 / difficulty;
    }
    return 1.3 / difficulty;
  }

  function getRewardInterval() {
    return state.elapsed < 18 ? randomRange(4.4, 5.1) : randomRange(5.2, 6.2);
  }

  function spawnEnemyWave() {
    if (state.elapsed < activeLevel.enemyGrace || state.unlocks === 0) {
      return;
    }
    const extraPressure = activeLevel.lateWave;
    let count = 1;
    if (state.elapsed > 22 && Math.random() < 0.34 + extraPressure) {
      count += 1;
    }
    if (state.elapsed > 32 && Math.random() < 0.38 + extraPressure) {
      count += 1;
    }
    if (state.elapsed > 35 && Math.random() < extraPressure) {
      count += 1;
    }
    if (state.elapsed > 36 && activeLevel.id === 5 && Math.random() < 0.28) {
      count += 1;
    }
    for (let index = 0; index < count; index += 1) {
      spawnEnemy(-index * randomRange(18, 34));
    }
  }

  function spawnEnemy(yOffset) {
    const pressure = clamp((state.elapsed - activeLevel.enemyGrace) / (bossSecond - activeLevel.enemyGrace), 0, 1);
    const roll = Math.random();
    const bruteGate = 0.66 - (activeLevel.id - 1) * 0.025;
    const shieldGate = 0.89 - (activeLevel.id - 1) * 0.015;
    const role = state.elapsed < 15 ? "runner" : roll < bruteGate ? "runner" : roll < shieldGate ? "brute" : "shield";
    const base = {
      runner: { hp: 5, speed: 62, radius: 25, damage: 1, score: 55, color: "#91a66f" },
      brute: { hp: 14, speed: 48, radius: 32, damage: 1, score: 120, color: "#8c9b6a" },
      shield: { hp: 22, speed: 42, radius: 33, damage: 2, score: 165, color: "#748b71" },
    }[role];
    const hp = Math.round((base.hp + pressure * (role === "runner" ? 7 : 12)) * activeLevel.enemyHp);
    addTarget({
      kind: "enemy",
      role,
      glyph: "",
      x: randomLaneX(),
      y: horizonY + 10 + yOffset,
      hp,
      maxHp: hp,
      speed: (base.speed + pressure * 10) * activeLevel.enemySpeed,
      radius: base.radius,
      damage: base.damage,
      score: base.score,
      color: base.color,
      track: role === "runner" ? 0.16 : 0.1,
    });
  }

  function spawnReward() {
    state.rewardCount += 1;
    const role = pickRewardRole();
    const definition = getRewardDefinition(role);
    const hp = state.rewardCount === 1
      ? 18
      : state.rewardCount === 2
        ? Math.round(55 * activeLevel.rewardHp)
        : Math.round((definition.hp + state.elapsed * definition.scale + definition.extra()) * activeLevel.rewardHp);
    const entersFromLeft = state.rewardCount % 2 === 1 ? true : state.rewardCount % 4 === 2 ? false : Math.random() < 0.5;
    const pathX = state.rewardCount === 1
      ? 195
      : state.rewardCount === 2
        ? width - 195
        : entersFromLeft
          ? randomRange(118, 184)
          : randomRange(width - 184, width - 118);

    addTarget({
      kind: "reward",
      role,
      glyph: definition.glyph,
      x: entersFromLeft ? -590 : width + 590,
      pathX,
      side: entersFromLeft ? -1 : 1,
      y: horizonY + 62,
      hp,
      maxHp: hp,
      speed: definition.speed,
      radius: definition.radius,
      damage: definition.damage,
      score: definition.score,
      color: definition.color,
      track: definition.track,
      hazard: definition.hazard,
    });

    floatText(width / 2, 137, definition.notice, "#fff7cc");
  }

  function pickRewardRole() {
    if (state.rewardCount === 1) {
      return "soldiers";
    }
    if (state.rewardCount === 2) {
      return "minigun";
    }
    const pool = ["soldiers", "ammo", "minigun", "shotgun", "soldiers", "ammo"];
    if (state.hp <= 2) {
      pool.push("medic", "medic");
    }
    if (state.weapon.spread >= 2) {
      pool.splice(pool.indexOf("shotgun"), 1);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getRewardDefinition(role) {
    const definitions = {
      minigun: {
        glyph: "MG",
        hp: 55,
        scale: 0.32,
        speed: 29,
        radius: 30,
        damage: 99,
        score: 260,
        color: "#58a7c8",
        track: 0.08,
        hazard: true,
        notice: "机枪桶",
        extra: () => state.weapon.machineGuns * 13,
      },
      soldiers: {
        glyph: "兵",
        hp: 24,
        scale: 0.28,
        speed: 31,
        radius: 29,
        damage: 1,
        score: 220,
        color: "#7cbc62",
        track: 0.05,
        hazard: false,
        notice: "士兵团",
        extra: () => Math.max(0, state.allies - 2) * 3,
      },
      ammo: {
        glyph: "弹",
        hp: 34,
        scale: 0.24,
        speed: 32,
        radius: 27,
        damage: 1,
        score: 175,
        color: "#f3c268",
        track: 0.06,
        hazard: false,
        notice: "弹药箱",
        extra: () => state.weapon.ammoBoost * 7,
      },
      shotgun: {
        glyph: "散",
        hp: 48,
        scale: 0.28,
        speed: 31,
        radius: 29,
        damage: 1,
        score: 230,
        color: "#e8685f",
        track: 0.05,
        hazard: false,
        notice: "散射枪",
        extra: () => state.weapon.spread * 10,
      },
      medic: {
        glyph: "+",
        hp: 28,
        scale: 0.18,
        speed: 31,
        radius: 25,
        damage: 1,
        score: 120,
        color: "#f6f0e0",
        track: 0.05,
        hazard: false,
        notice: "医疗包",
        extra: () => 0,
      },
    };
    return definitions[role] ?? definitions.ammo;
  }

  function spawnBoss() {
    const hp = Math.round(activeLevel.bossHp + state.unlocks * 9 * activeLevel.rewardHp);
    state.bossSpawned = true;
    addTarget({
      kind: "boss",
      role: "boss",
      glyph: "BOSS",
      x: width / 2,
      y: horizonY + 6,
      hp,
      maxHp: hp,
      speed: 36 * activeLevel.enemySpeed,
      radius: 66,
      damage: 99,
      score: 1600,
      color: activeLevel.theme.boss,
      track: 0.11,
      hazard: true,
    });
    state.shake = 5;
    floatText(width / 2, 104, "Boss 来了", "#ffdf6e");
  }

  function addTarget(target) {
    state.targets.push({
      id: state.nextId,
      hitFlash: 0,
      wobble: Math.random() * Math.PI * 2,
      dead: false,
      ...target,
      worldX: target.x,
    });
    state.nextId += 1;
  }

  function updateBullets(delta) {
    state.bullets.forEach((bullet) => {
      bullet.worldX += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.x = projectX(bullet.worldX, bullet.y);
      bullet.life -= delta;
      if (bullet.life <= 0 || bullet.y < horizonY - 18 || bullet.x < -40 || bullet.x > width + 40) {
        bullet.dead = true;
      }
    });
  }

  function updateTargets(delta) {
    state.targets.forEach((target) => {
      target.hitFlash = Math.max(0, target.hitFlash - delta);
      target.wobble += delta * (target.kind === "boss" ? 2.1 : 5.5);
      const depth = getDepth(target.y);
      target.y += target.speed * (0.5 + depth * 1.45) * delta;

      if (target.kind === "reward" && Number.isFinite(target.pathX)) {
        target.worldX = lerp(target.worldX, target.pathX, Math.min(1, delta * (1.35 + depth * 1.2)));
      } else if (target.track) {
        const drift = (state.player.x - target.worldX) * target.track * delta;
        target.worldX = clamp(target.worldX + drift, 28, width - 28);
      }

      if (target.kind === "enemy") {
        target.worldX += Math.sin(target.wobble) * 9 * delta;
      }
      if (target.kind === "boss") {
        target.worldX += Math.sin(state.elapsed * 1.9) * 12 * delta;
      }
      target.x = projectX(target.worldX, target.y);

      const impactLine = target.kind === "boss" ? defenseY - 54 : defenseY - target.radius * 0.65;
      if (target.y >= impactLine && !target.dead && state.phase === "playing") {
        resolveBreakthrough(target);
      }
    });
  }

  function updatePickups(delta) {
    state.pickups.forEach((pickup) => {
      pickup.life += delta;
      const t = clamp(pickup.life / pickup.duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      pickup.x = lerp(pickup.startX, state.player.x, eased);
      pickup.y = lerp(pickup.startY, state.player.y - 34, eased);
      pickup.scale = 1 - t * 0.42;
      if (t >= 1) {
        pickup.dead = true;
      }
    });
  }

  function updateEffects(delta) {
    state.particles.forEach((particle) => {
      particle.life -= delta;
      particle.x += particle.dx * delta;
      particle.y += particle.dy * delta;
      particle.radius += particle.growth * delta;
    });
    state.texts.forEach((text) => {
      text.life -= delta;
      text.y += text.dy * delta;
    });
  }

  function handleCollisions() {
    state.bullets.forEach((bullet) => {
      if (bullet.dead) {
        return;
      }
      state.targets.forEach((target) => {
        if (bullet.dead || target.dead || target.hp <= 0) {
          return;
        }
        const scale = getDepthScale(target.y);
        const hitRadius = bullet.radius * getDepthScale(bullet.y) + target.radius * scale * (target.kind === "boss" ? 0.88 : 0.78);
        if (Math.hypot(bullet.x - target.x, bullet.y - target.y) <= hitRadius) {
          damageTarget(target, bullet.damage);
          spark(bullet.x, bullet.y, target.color, 2);
          if (bullet.pierceLeft > 0) {
            bullet.pierceLeft -= 1;
          } else {
            bullet.dead = true;
          }
        }
      });
    });
  }

  function damageTarget(target, amount) {
    target.hp = Math.max(0, target.hp - amount);
    target.hitFlash = 0.08;
    if (target.hp <= 0) {
      destroyTarget(target);
    }
  }

  function destroyTarget(target) {
    if (target.dead) {
      return;
    }
    target.dead = true;
    state.score += target.score;
    state.best = Math.max(state.best, state.score);
    burst(target.x, target.y, target.color, target.kind === "boss" ? 42 : 18);

    if (target.kind === "reward") {
      state.unlocks += 1;
      applyReward(target);
      state.pickups.push({
        role: target.role,
        glyph: target.glyph,
        color: target.color,
        startX: target.x,
        startY: target.y,
        x: target.x,
        y: target.y,
        scale: 1,
        life: 0,
        duration: 0.56,
        dead: false,
      });
      return;
    }

    if (target.kind === "boss") {
      state.bossDefeated = true;
      state.score += Math.round(state.hp * 160 + Math.max(0, roundSeconds - state.elapsed) * 35);
      state.best = Math.max(state.best, state.score);
      endRound("Boss 倒下了", true);
      return;
    }

    state.kills += 1;
    if (state.kills % 8 === 0) {
      floatText(target.x, target.y - 18, "连守", "#fff7cc");
      state.score += 60;
    }
  }

  function applyReward(target) {
    if (target.role === "minigun") {
      state.weapon.machineGuns = Math.min(5, state.weapon.machineGuns + 1);
      floatText(target.x, target.y, "+机枪", "#bfefff");
      return;
    }
    if (target.role === "soldiers") {
      state.allies = Math.min(10, state.allies + 3);
      floatText(target.x, target.y, "+3 士兵", "#e6ffd1");
      return;
    }
    if (target.role === "ammo") {
      state.weapon.ammoBoost = Math.min(6, state.weapon.ammoBoost + 1);
      floatText(target.x, target.y, "+弹药", "#fff1a8");
      return;
    }
    if (target.role === "shotgun") {
      state.weapon.spread = Math.min(3, state.weapon.spread + 1);
      floatText(target.x, target.y, "+散射", "#ffd1c8");
      return;
    }
    if (target.role === "medic") {
      state.hp = Math.min(state.maxHp, state.hp + 2);
      floatText(target.x, target.y, "+生命", "#ffffff");
    }
  }

  function resolveBreakthrough(target) {
    target.dead = true;
    burst(target.x, Math.min(defenseY, target.y), target.color, target.kind === "boss" ? 36 : 16);

    if (target.kind === "reward" && target.role === "minigun") {
      state.hp = 0;
      state.shake = 9;
      endRound("机枪桶碾过防线", false);
      return;
    }

    if (target.kind === "boss") {
      state.hp = 0;
      state.shake = 10;
      endRound("Boss 冲破防线", false);
      return;
    }

    damageBase(target.damage, target.kind === "reward" ? "补给砸到防线" : "敌人突破防线");
  }

  function damageBase(amount, reason) {
    if (state.player.invincible > 0 && amount < 50) {
      return;
    }
    state.hp = Math.max(0, state.hp - amount);
    state.player.hitFlash = 0.22;
    state.player.invincible = 0.38;
    state.shake = 5;
    floatText(state.player.x, state.player.y - 74, `-${amount}`, "#ffdbd1");
    if (state.hp <= 0) {
      endRound(reason, false);
    }
  }

  function endRound(reason, won) {
    if (state.phase !== "playing") {
      return;
    }
    if (won) {
      state.score += Math.round(Math.max(0, roundSeconds - state.elapsed) * 24 + state.hp * 120);
      state.best = Math.max(state.best, state.score);
    }
    state.phase = won ? "won" : "game-over";
    showSettlement(reason, won);
  }

  function sweepDeadObjects() {
    state.bullets = state.bullets.filter((bullet) => !bullet.dead);
    state.targets = state.targets.filter((target) => !target.dead);
    state.pickups = state.pickups.filter((pickup) => !pickup.dead);
    state.particles = state.particles.filter((particle) => particle.life > 0);
    state.texts = state.texts.filter((text) => text.life > 0);
  }

  function render() {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawTerrain();
    drawAimLane();
    drawTargets();
    drawBullets();
    drawPickups();
    drawParticles();
    drawPlayer();
    drawWaveRibbon();
    ctx.restore();
    updateHud();
  }

  function drawTerrain() {
    const theme = activeLevel.theme;
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 110);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(0.58, theme.silhouette);
    sky.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizonY + 128);

    ctx.fillStyle = theme.silhouette;
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.lineTo(54, 79);
    ctx.lineTo(94, 111);
    ctx.lineTo(142, 69);
    ctx.lineTo(196, 112);
    ctx.lineTo(248, 77);
    ctx.lineTo(306, 111);
    ctx.lineTo(365, 66);
    ctx.lineTo(430, 108);
    ctx.lineTo(width, 86);
    ctx.lineTo(width, 156);
    ctx.lineTo(0, 156);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    const road = ctx.createLinearGradient(0, horizonY, 0, defenseY + 38);
    road.addColorStop(0, theme.roadTop);
    road.addColorStop(0.58, theme.roadTop);
    road.addColorStop(1, theme.roadBottom);
    ctx.fillStyle = road;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 52, horizonY);
    ctx.lineTo(width / 2 + 52, horizonY);
    ctx.lineTo(width + 76, defenseY + 46);
    ctx.lineTo(-76, defenseY + 46);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = theme.roadLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 52, horizonY);
    ctx.lineTo(-76, defenseY + 46);
    ctx.moveTo(width / 2 + 52, horizonY);
    ctx.lineTo(width + 76, defenseY + 46);
    ctx.stroke();
    ctx.restore();

    for (let marker = 0; marker < 8; marker += 1) {
      const depth = marker / 8;
      const y = horizonY + Math.pow(depth, 1.55) * (defenseY - horizonY);
      const scale = 0.2 + depth * 0.9;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = theme.roadLine;
      ctx.fillRect(width / 2 - 2.2 * scale, y, 4.4 * scale, 21 * scale);
      ctx.restore();
    }

    drawThemeLandmarks();
    drawRoadsideDebris();

    ctx.fillStyle = "#252d2a";
    ctx.fillRect(0, defenseY + 18, width, height - defenseY);
    ctx.fillStyle = theme.barricade;
    ctx.fillRect(26, defenseY - 7, width - 52, 21);
    ctx.fillStyle = "#4b392f";
    for (let post = 0; post < 9; post += 1) {
      const x = 32 + post * 52;
      drawRoundRect(x, defenseY - 26, 17, 58, 3);
      ctx.fill();
      ctx.fillStyle = theme.barricade;
      ctx.fillRect(x + 4, defenseY - 20, 8, 37);
      ctx.fillStyle = "#4b392f";
    }

    ctx.fillStyle = "rgba(14, 18, 17, 0.24)";
    ctx.fillRect(0, 0, width, 9);
    ctx.fillRect(0, height - 8, width, 8);
    drawWeather();
  }

  function drawAimLane() {
    const laneWidth = 52 + state.weapon.spread * 13;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = activeLevel.theme.roadLine;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 4, horizonY + 4);
    ctx.lineTo(width / 2 + 4, horizonY + 4);
    ctx.lineTo(state.player.x + laneWidth / 2, defenseY - 28);
    ctx.lineTo(state.player.x - laneWidth / 2, defenseY - 28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = activeLevel.theme.roadLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2, horizonY + 4);
    ctx.lineTo(state.player.x, defenseY - 30);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoadsideDebris() {
    const theme = activeLevel.theme;
    for (let index = 0; index < 12; index += 1) {
      const left = index % 2 === 0;
      const depth = (index + 1) / 13;
      const y = horizonY + Math.pow(depth, 1.5) * (defenseY - horizonY);
      const scale = 0.2 + depth * 0.8;
      const roadEdge = lerp(width / 2 + 58, width + 44, depth);
      const x = left ? width - roadEdge - 16 * scale : roadEdge + 16 * scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = index % 3 === 0 ? theme.debris : theme.silhouette;
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillStyle = "rgba(20, 25, 23, 0.3)";
      ctx.fillRect(-15, 9, 30, 5);
      ctx.restore();
    }
  }

  function drawThemeLandmarks() {
    const themeId = activeLevel.theme.id;
    ctx.save();
    if (themeId === "frost") {
      ctx.fillStyle = "rgba(224, 239, 239, 0.72)";
      ctx.fillRect(0, horizonY, width, 5);
      ctx.fillStyle = "#34535a";
      for (let index = 0; index < 6; index += 1) {
        const x = 24 + index * 87;
        ctx.beginPath();
        ctx.moveTo(x, 142);
        ctx.lineTo(x + 14, 106);
        ctx.lineTo(x + 28, 142);
        ctx.closePath();
        ctx.fill();
      }
    } else if (themeId === "oilfield") {
      ctx.fillStyle = "#315e5d";
      ctx.fillRect(28, 91, 10, 55);
      ctx.fillRect(width - 40, 84, 10, 62);
      ctx.strokeStyle = "#243f3e";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(33, 92);
      ctx.lineTo(72, 119);
      ctx.lineTo(33, 132);
      ctx.moveTo(width - 35, 86);
      ctx.lineTo(width - 76, 117);
      ctx.stroke();
    } else if (themeId === "harbor") {
      ctx.fillStyle = "#b45752";
      ctx.fillRect(18, 111, 46, 31);
      ctx.fillStyle = "#315a62";
      ctx.fillRect(width - 68, 104, 50, 38);
      ctx.strokeStyle = "#1b343b";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(80, 142);
      ctx.lineTo(80, 74);
      ctx.lineTo(139, 102);
      ctx.moveTo(width - 92, 142);
      ctx.lineTo(width - 92, 67);
      ctx.lineTo(width - 145, 96);
      ctx.stroke();
    } else if (themeId === "furnace") {
      ctx.fillStyle = "#303634";
      ctx.fillRect(38, 76, 28, 70);
      ctx.fillRect(width - 67, 64, 31, 82);
      ctx.fillStyle = "#d66242";
      ctx.fillRect(45, 118, 14, 23);
      ctx.fillRect(width - 59, 105, 15, 36);
    }
    ctx.restore();
  }

  function drawWeather() {
    const weather = activeLevel.theme.weather;
    const travel = state.elapsed * 46;
    ctx.save();
    if (weather === "snow") {
      ctx.fillStyle = "rgba(240, 249, 246, 0.7)";
      for (let index = 0; index < 32; index += 1) {
        const x = (index * 83 + travel * (0.3 + (index % 3) * 0.08)) % width;
        const y = (index * 47 + travel * (0.6 + (index % 4) * 0.08)) % defenseY;
        ctx.fillRect(x, y, 2 + (index % 2), 2 + (index % 2));
      }
    } else if (weather === "rain") {
      ctx.strokeStyle = "rgba(190, 220, 222, 0.3)";
      ctx.lineWidth = 1.2;
      for (let index = 0; index < 42; index += 1) {
        const x = (index * 71 + travel * 0.45) % (width + 40) - 20;
        const y = (index * 53 + travel * 1.5) % defenseY;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8, y + 20);
        ctx.stroke();
      }
    } else if (weather === "dust") {
      ctx.fillStyle = "rgba(221, 163, 99, 0.12)";
      for (let index = 0; index < 14; index += 1) {
        const x = (index * 109 + travel * 0.8) % (width + 90) - 45;
        const y = 160 + ((index * 67) % 370);
        ctx.fillRect(x, y, 52, 3);
      }
    } else if (weather === "embers") {
      ctx.fillStyle = "rgba(255, 178, 72, 0.76)";
      for (let index = 0; index < 25; index += 1) {
        const x = (index * 97 + travel * 0.28) % width;
        const y = defenseY - ((index * 73 + travel * 0.7) % (defenseY - 60));
        ctx.fillRect(x, y, 2, 4);
      }
    }
    ctx.restore();
  }

  function drawTargets() {
    [...state.targets]
      .sort((a, b) => a.y - b.y)
      .forEach((target) => {
        if (target.kind === "boss") {
          drawBoss(target);
        } else if (target.kind === "reward") {
          drawReward(target);
        } else {
          drawEnemy(target);
        }
        drawCounter(target);
      });
  }

  function drawEnemy(target) {
    const scale = getDepthScale(target.y) * (target.role === "brute" ? 1.08 : 1);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(scale, scale);
    ctx.rotate(Math.sin(target.wobble) * 0.055);
    const flash = target.hitFlash > 0;

    ctx.fillStyle = "rgba(15, 20, 18, 0.34)";
    ctx.beginPath();
    ctx.ellipse(0, target.radius * 0.78, target.radius * 0.78, target.radius * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    const stride = Math.sin(target.wobble) * 7;
    ctx.strokeStyle = flash ? "#ffffff" : "#39453b";
    ctx.lineWidth = target.role === "brute" ? 9 : 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, 17);
    ctx.lineTo(-10 + stride, 34);
    ctx.moveTo(7, 17);
    ctx.lineTo(10 - stride, 34);
    ctx.stroke();

    ctx.fillStyle = flash ? "#ffffff" : roleDark(target.color);
    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.lineTo(16, -15);
    ctx.lineTo(22, 20);
    ctx.lineTo(5, 25);
    ctx.lineTo(-20, 19);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = flash ? "#ffffff" : target.color;
    ctx.lineWidth = target.role === "brute" ? 10 : 7;
    ctx.beginPath();
    ctx.moveTo(-14, -7);
    ctx.lineTo(-29 - stride * 0.6, 7);
    ctx.lineTo(-34, -2);
    ctx.moveTo(14, -8);
    ctx.lineTo(29 + stride * 0.6, 4);
    ctx.lineTo(35, -6);
    ctx.stroke();

    ctx.fillStyle = flash ? "#ffffff" : target.color;
    ctx.beginPath();
    ctx.arc(0, -27, target.role === "brute" ? 17 : 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d9ca75";
    ctx.beginPath();
    ctx.arc(-5, -29, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -30, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#263129";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, -21);
    ctx.lineTo(7, -20);
    ctx.stroke();

    if (target.role === "shield") {
      ctx.fillStyle = flash ? "#ffffff" : "#5f6f69";
      ctx.beginPath();
      ctx.moveTo(-25, -5);
      ctx.lineTo(6, -2);
      ctx.lineTo(9, 29);
      ctx.lineTo(-22, 25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#a6b1a7";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawReward(target) {
    const scale = getDepthScale(target.y);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(scale, scale);
    const flash = target.hitFlash > 0;

    ctx.fillStyle = "rgba(15, 20, 18, 0.36)";
    ctx.beginPath();
    ctx.ellipse(0, target.radius * 0.88, target.radius * 0.95, target.radius * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    if (target.role === "minigun" || target.role === "shotgun") {
      ctx.rotate(target.wobble * 0.22 * (target.side || 1));
      ctx.fillStyle = flash ? "#ffffff" : "#74523a";
      ctx.beginPath();
      ctx.arc(0, 4, target.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b18a57";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 4, target.radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = target.role === "minigun" ? "#598b91" : "#a8614e";
      drawRoundRect(-25, -35, 50, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#252d2a";
      ctx.fillRect(15, -30, 34, 7);
      ctx.fillRect(-5, -18, 9, 22);
    } else if (target.role === "soldiers") {
      ctx.fillStyle = flash ? "#ffffff" : "#c0b67d";
      drawRoundRect(-34, -27, 68, 55, 5);
      ctx.fill();
      ctx.strokeStyle = "#4a5549";
      ctx.lineWidth = 4;
      ctx.strokeRect(-30, -23, 60, 47);
      for (let index = 0; index < 3; index += 1) {
        const x = -18 + index * 18;
        ctx.fillStyle = "#c9a87c";
        ctx.beginPath();
        ctx.arc(x, -6, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#405c50";
        ctx.fillRect(x - 8, -14, 16, 6);
        ctx.fillRect(x - 7, 1, 14, 18);
      }
    } else {
      ctx.fillStyle = flash ? "#ffffff" : target.color;
      drawRoundRect(-target.radius, -target.radius, target.radius * 2, target.radius * 2, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(23, 35, 28, 0.45)";
      ctx.lineWidth = 4;
      ctx.strokeRect(-target.radius + 7, -target.radius + 7, target.radius * 2 - 14, target.radius * 2 - 14);
    }

    if (target.role !== "soldiers") {
      ctx.fillStyle = "#17231c";
      ctx.font = target.glyph.length > 1 ? "900 15px system-ui, sans-serif" : "900 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(target.glyph, 0, 5);
    }
    ctx.restore();
  }

  function drawBoss(target) {
    const scale = getDepthScale(target.y);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(scale, scale);
    const flash = target.hitFlash > 0;
    ctx.fillStyle = "rgba(12, 16, 14, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 60, 65, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? "#ffffff" : activeLevel.theme.boss;
    drawRoundRect(-58, -42, 116, 94, 15);
    ctx.fill();
    ctx.fillStyle = flash ? "#ffffff" : "#344538";
    drawRoundRect(-45, -18, 90, 67, 10);
    ctx.fill();
    ctx.strokeStyle = flash ? "#ffffff" : activeLevel.theme.boss;
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-48, -12);
    ctx.lineTo(-76, 22);
    ctx.moveTo(48, -12);
    ctx.lineTo(76, 22);
    ctx.stroke();
    ctx.fillStyle = "#d8c65f";
    ctx.beginPath();
    ctx.arc(-25, -3, 7, 0, Math.PI * 2);
    ctx.arc(25, -3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17231c";
    drawRoundRect(-29, 21, 58, 9, 4);
    ctx.fill();
    ctx.fillStyle = "#efc669";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BOSS", 0, -54);
    ctx.restore();
  }

  function drawCounter(target) {
    const text = String(Math.ceil(target.hp));
    const scale = getDepthScale(target.y);
    ctx.save();
    const fontSize = Math.max(11, (target.kind === "boss" ? 24 : 18) * scale);
    ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(text).width;
    const boxWidth = Math.max((target.kind === "boss" ? 74 : 42) * scale, textWidth + 14);
    const boxHeight = Math.max(18, (target.kind === "boss" ? 34 : 26) * scale);
    const y = target.y - target.radius * scale - Math.max(14, (target.kind === "boss" ? 30 : 21) * scale);
    ctx.fillStyle = target.kind === "enemy" ? "#df5f58" : target.hazard ? activeLevel.accent : "#e8eee4";
    drawRoundRect(target.x - boxWidth / 2, y, boxWidth, boxHeight, 5);
    ctx.fill();
    ctx.fillStyle = target.kind === "enemy" ? "#ffffff" : "#17231c";
    ctx.fillText(text, target.x, y + boxHeight / 2 + 1);
    ctx.restore();
  }

  function drawBullets() {
    state.bullets.forEach((bullet) => {
      const scale = getDepthScale(bullet.y);
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, Math.max(1.3, bullet.radius * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 240, 184, 0.58)";
      ctx.lineWidth = Math.max(1, 1.7 * scale);
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y + 2);
      ctx.lineTo(projectX(bullet.worldX, bullet.y + 22), bullet.y + 16 * scale);
      ctx.stroke();
    });
  }

  function drawPickups() {
    state.pickups.forEach((pickup) => {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.scale(pickup.scale, pickup.scale);
      ctx.fillStyle = pickup.color;
      drawRoundRect(-18, -18, 36, 36, 9);
      ctx.fill();
      ctx.fillStyle = "#17231c";
      ctx.font = pickup.glyph.length > 1 ? "900 12px system-ui, sans-serif" : "900 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pickup.glyph, 0, 2);
      ctx.restore();
    });
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    state.texts.forEach((text) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
      ctx.fillStyle = text.color;
      ctx.font = "900 19px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });
  }

  function drawPlayer() {
    const player = state.player;
    const positions = getFormationPositions();
    ctx.save();
    if (player.hitFlash > 0 && Math.floor(player.hitFlash * 30) % 2 === 0) {
      ctx.globalAlpha = 0.62;
    }

    ctx.fillStyle = "rgba(7, 11, 10, 0.42)";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 24, 88, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4b5650";
    ctx.beginPath();
    ctx.moveTo(player.x - 74, player.y - 10);
    ctx.lineTo(player.x + 74, player.y - 10);
    ctx.lineTo(player.x + 62, player.y + 28);
    ctx.lineTo(player.x - 62, player.y + 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2c3834";
    drawRoundRect(player.x - 58, player.y - 23, 116, 25, 5);
    ctx.fill();

    positions.forEach((soldier, index) => {
      drawSoldier(soldier.x, soldier.y, index % 3);
    });

    for (let gun = 0; gun < state.weapon.machineGuns; gun += 1) {
      const offset = (gun - (state.weapon.machineGuns - 1) / 2) * 26;
      drawMachineGun(player.x + offset, player.y - 58);
    }

    ctx.restore();

    const hpRatio = state.hp / state.maxHp;
    ctx.fillStyle = "rgba(23, 35, 28, 0.35)";
    drawRoundRect(player.x - 64, player.y + 34, 128, 12, 6);
    ctx.fill();
    ctx.fillStyle = hpRatio > 0.45 ? "#76db6f" : "#ff6f7d";
    drawRoundRect(player.x - 64, player.y + 34, 128 * hpRatio, 12, 6);
    ctx.fill();
  }

  function drawSoldier(x, y, variant) {
    const uniform = ["#35564f", "#4c654e", "#5c5746"][variant] ?? "#35564f";
    ctx.fillStyle = "rgba(9, 13, 12, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9a87c";
    ctx.beginPath();
    ctx.arc(x, y - 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = uniform;
    drawRoundRect(x - 10, y - 6, 20, 25, 4);
    ctx.fill();
    ctx.fillStyle = "#26332f";
    ctx.beginPath();
    ctx.arc(x, y - 16, 11, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#202a27";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 5, y - 1);
    ctx.lineTo(x + 2, y - 24);
    ctx.stroke();
    ctx.strokeStyle = "#8d7655";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 24);
    ctx.lineTo(x + 2, y - 36);
    ctx.stroke();
  }

  function drawMachineGun(x, y) {
    ctx.fillStyle = "#557b78";
    drawRoundRect(x - 14, y - 7, 28, 17, 4);
    ctx.fill();
    ctx.fillStyle = "#1d2926";
    ctx.fillRect(x - 4, y - 31, 8, 29);
    ctx.fillRect(x - 6, y + 8, 12, 13);
    ctx.fillStyle = "#bcae7b";
    ctx.fillRect(x - 2, y - 36, 4, 8);
  }

  function drawWaveRibbon() {
    const timeLeft = Math.max(0, roundSeconds - state.elapsed);
    const progress = clamp(state.elapsed / roundSeconds, 0, 1);
    ctx.fillStyle = "rgba(23, 35, 28, 0.5)";
    ctx.fillRect(0, 0, width, 5);
    ctx.fillStyle = state.bossSpawned ? "#e76d67" : activeLevel.accent;
    ctx.fillRect(0, 0, width * progress, 5);

    const phaseLabel = state.bossSpawned
      ? "BOSS"
      : state.elapsed < 6
        ? "集结"
        : state.elapsed < 22
          ? "警戒"
          : state.elapsed < 32
            ? "尸潮"
            : "高危";
    ctx.font = "800 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelWidth = ctx.measureText(phaseLabel).width + 18;
    ctx.fillStyle = "rgba(15, 20, 18, 0.66)";
    drawRoundRect(width / 2 - labelWidth / 2, 84, labelWidth, 21, 4);
    ctx.fill();
    ctx.fillStyle = state.bossSpawned ? "#f08b82" : "#e9ddbc";
    ctx.fillText(phaseLabel, width / 2, 95);

    if (timeLeft <= 11 || state.bossSpawned) {
      ctx.save();
      ctx.globalAlpha = 0.42 + Math.sin(state.alertPulse * 8) * 0.16;
      ctx.strokeStyle = "#e76d67";
      ctx.lineWidth = 4;
      drawRoundRect(7, 7, width - 14, height - 14, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  function getFormationPositions() {
    const count = state.allies;
    const firstRow = Math.min(5, count);
    const secondRow = Math.max(0, count - firstRow);
    const positions = [];
    for (let index = 0; index < firstRow; index += 1) {
      positions.push({
        x: state.player.x + (index - (firstRow - 1) / 2) * 24,
        y: state.player.y - 35,
      });
    }
    for (let index = 0; index < secondRow; index += 1) {
      positions.push({
        x: state.player.x + (index - (secondRow - 1) / 2) * 22,
        y: state.player.y - 10,
      });
    }
    return positions;
  }

  function getShooterPositions() {
    const positions = getFormationPositions().map((position) => ({
      x: position.x,
      y: position.y - 8,
    }));
    for (let gun = 0; gun < state.weapon.machineGuns; gun += 1) {
      const offset = (gun - (state.weapon.machineGuns - 1) / 2) * 26;
      positions.push({ x: state.player.x + offset, y: state.player.y - 64 });
      positions.push({ x: state.player.x + offset + 7, y: state.player.y - 64 });
    }
    return positions.slice(0, 16);
  }

  function burst(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(34, 140);
      state.particles.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        radius: randomRange(2, 4),
        growth: 4,
        color,
        life: randomRange(0.28, 0.58),
        maxLife: 0.58,
      });
    }
  }

  function spark(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      state.particles.push({
        x,
        y,
        dx: randomRange(-28, 28),
        dy: randomRange(-36, 20),
        radius: randomRange(1.5, 2.8),
        growth: 2,
        color,
        life: 0.18,
        maxLife: 0.18,
      });
    }
  }

  function floatText(x, y, text, color) {
    state.texts.push({
      x,
      y,
      text,
      color,
      dy: -34,
      life: 0.86,
      maxLife: 0.86,
    });
  }

  function updateHud() {
    const timeLeft = Math.max(0, Math.ceil(roundSeconds - state.elapsed));
    hpEl.textContent = `${state.hp}/${state.maxHp}`;
    const hpRatio = clamp(state.hp / state.maxHp, 0, 1);
    hpFillEl.style.width = `${hpRatio * 100}%`;
    hpFillEl.style.background = hpRatio > 0.45 ? "#79d679" : "#e76d67";
    timerEl.textContent = String(timeLeft);
    squadEl.textContent = String(state.allies);
    arsenalEl.textContent = `${1 + state.weapon.machineGuns + state.weapon.spread}x`;
    scoreEl.textContent = formatScore(state.score);
    bestEl.textContent = formatScore(Math.max(state.best, state.score));
  }

  function togglePause() {
    if (state.phase === "playing") {
      state.phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "防线待命", "继续");
      return;
    }
    if (state.phase === "paused") {
      state.phase = "playing";
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
    document.getElementById("campaignSettlement")?.remove();
  }

  function recordRound(completed = false) {
    if (roundRecorded) {
      return { record: getGameRecord(gameId), newHighScore: false };
    }
    roundRecorded = true;
    const stars = completed
      ? 1 + (state.hp >= Math.ceil(state.maxHp * 0.66) ? 1 : 0) + (state.unlocks >= 5 ? 1 : 0)
      : 0;
    return saveGameResult(gameId, {
      score: state.score,
      highestLevel: activeLevel.id,
      playTime: Math.round((Date.now() - roundStartedAt) / 1000),
      completed,
      stars,
    });
  }

  function showSettlement(reason, completed) {
    const result = recordRound(completed);
    finalScore.textContent = formatScore(state.score);
    finalBest.textContent = formatScore(result.record.highScore);
    settlementKicker.textContent = completed
      ? `第 ${activeLevel.id} 关完成`
      : result.newHighScore
        ? "新纪录"
        : "本局结束";
    settlementTitle.textContent = reason;
    playAgain.textContent = completed && activeLevel.id < TOTAL_LEVELS ? "进入下一关" : "再玩一次";
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
    if (state.score > 0 && !roundRecorded) {
      recordRound(false);
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

  function movePlayerToPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.player.x = clamp(x, minX, maxX);
  }

  function randomLaneX() {
    const lanes = [70, 126, 184, 240, 296, 354, 410];
    return clamp(lanes[Math.floor(Math.random() * lanes.length)] + randomRange(-14, 14), minX, maxX);
  }

  function randomSideX() {
    const left = Math.random() < 0.5;
    return left ? randomRange(54, 168) : randomRange(width - 168, width - 54);
  }

  function roleDark(color) {
    const colors = {
      "#91a66f": "#56634d",
      "#8c9b6a": "#505a47",
      "#748b71": "#3f5145",
    };
    return colors[color] ?? "#415045";
  }

  function getDepth(y) {
    return clamp((y - horizonY) / (defenseY - horizonY), 0, 1);
  }

  function getDepthScale(y) {
    const depth = getDepth(y);
    return 0.28 + Math.pow(depth, 0.78) * 0.82;
  }

  function projectX(worldX, y) {
    const depth = getDepth(y);
    const perspective = 0.2 + Math.pow(depth, 0.82) * 0.8;
    return width / 2 + (worldX - width / 2) * perspective;
  }

  function drawRoundRect(x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, t) {
    return from + (to - from) * t;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      keys.left = true;
    } else if (key === "arrowright" || key === "d") {
      keys.right = true;
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      keys.left = false;
    } else if (key === "arrowright" || key === "d") {
      keys.right = false;
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    canvas.focus();
    if (typeof canvas.setPointerCapture === "function") {
      canvas.setPointerCapture(event.pointerId);
    }
    movePlayerToPointer(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (dragging) {
      movePlayerToPointer(event);
    }
  });

  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });

  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });

  controlButtons.forEach((button) => {
    button.addEventListener("pointerdown", () => {
      const control = button instanceof HTMLElement ? button.dataset.control : "";
      if (control === "left") {
        keys.left = true;
      }
      if (control === "right") {
        keys.right = true;
      }
    });
    button.addEventListener("pointerup", () => {
      keys.left = false;
      keys.right = false;
    });
    button.addEventListener("pointercancel", () => {
      keys.left = false;
      keys.right = false;
    });
  });

  levelCards.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-stand-level]")
      : null;
    if (target instanceof HTMLButtonElement && !target.disabled) {
      startLevel(Number(target.dataset.standLevel));
    }
  });

  pauseButton.addEventListener("click", togglePause);
  statusButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (state.phase === "selecting") {
      startLevel(requestedLevel());
      return;
    }
    if (state.score > 0 && state.phase !== "game-over" && state.phase !== "won") {
      recordRound(false);
    }
    startLevel(activeLevel.id);
  });
  chooseLevelButton.addEventListener("click", () => {
    if (state.score > 0 && !roundRecorded && state.phase !== "won" && state.phase !== "game-over") {
      recordRound(false);
    }
    zoneNameEl.textContent = "五区战役";
    levelNameEl.textContent = "选择防线";
    showLevelSelect();
  });
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  settlementLevels.addEventListener("click", showLevelSelect);
  playAgain.addEventListener("click", () => {
    const nextLevel = state.phase === "won" && activeLevel.id < TOTAL_LEVELS
      ? activeLevel.id + 1
      : activeLevel.id;
    startLevel(nextLevel);
  });
  shareResult.addEventListener("click", () => {
    const seconds = Math.min(roundSeconds, Math.ceil(state.elapsed));
    shareOutput.textContent = `我在 CREDIUS ARCADE 的 Last Stand 第 ${activeLevel.id} 关守了 ${seconds} 秒，拿到 ${formatScore(state.score)} 分。`;
  });
  soundButton.addEventListener("click", () => {
    updateSettings({ soundEnabled: !getSettings().soundEnabled });
    updateSoundButton();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "playing") {
      togglePause();
    }
  });

  globalThis.CrediusLastStandDebug = {
    getState() {
      return {
        activeLevel: activeLevel.id,
        allies: state.allies,
        bossSpawned: state.bossSpawned,
        elapsed: state.elapsed,
        phase: state.phase,
        score: state.score,
        targetCount: state.targets.length,
        theme: activeLevel.theme.id,
      };
    },
  };

  updateSoundButton();
  renderLevelCards();
  showLevelSelect();
  requestAnimationFrame(loop);
})();
