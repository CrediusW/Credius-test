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
  const { getNextJump } = globalThis.CrediusMaryJumpRules;
  const { buildLevel } = globalThis.CrediusPrinceWorld;
  const { BossEnemy, createEnemy, roundedRect } = globalThis.CrediusPrinceEntities;

  const gameId = "super-mary";
  const params = new URLSearchParams(window.location.search);
  const qaEnabled = params.has("qa");
  const qaScene = params.get("scene") ?? "";
  const campaignLevel = campaign.getCurrentLevel(gameId);
  const difficulty = campaign.getLevelConfig(gameId, campaignLevel);
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("maryBoard"));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

  const el = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const button = (id) => /** @type {HTMLButtonElement} */ (document.getElementById(id));
  const scoreEl = el("score");
  const livesEl = el("lives");
  const coinsEl = el("coins");
  const bigCoinsEl = el("bigCoins");
  const progressEl = el("progress");
  const abilityBar = el("abilityBar");
  const backLobby = button("backLobby");
  const pauseButton = button("pauseGame");
  const newGameButton = button("newGame");
  const soundButton = button("soundGame");
  const statusPanel = el("statusPanel");
  const statusKicker = el("statusKicker");
  const statusTitle = el("statusTitle");
  const statusButton = button("statusButton");
  const settlementPanel = el("settlementPanel");
  const settlementKicker = el("settlementKicker");
  const settlementTitle = el("settlementTitle");
  const finalScore = el("finalScore");
  const finalCoins = el("finalCoins");
  const finalBigCoins = el("finalBigCoins");
  const finalTime = el("finalTime");
  const playAgain = button("playAgain");
  const shareResult = button("shareResult");
  const settlementLobby = button("settlementLobby");
  const shareOutput = el("shareOutput");
  const controlButtons = Array.from(document.querySelectorAll("[data-control]"));

  const background = typeof Image === "function" ? new Image() : null;
  if (background) background.src = "assets/mountain-valley.jpg";

  const keys = { left: false, right: false };
  const gravity = 1680;
  let level = buildLevel(campaignLevel);
  let worldWidth = level.worldWidth;
  let platforms = [];
  let movingPlatforms = [];
  let fallingPlatforms = [];
  let springs = [];
  let spikes = [];
  let hazards = [];
  let coins = [];
  let enemies = [];
  let items = [];
  let hiddenBlocks = [];
  let checkpoints = [];
  let secretZones = [];
  let boss = new BossEnemy(level.boss);
  let goal = level.goal;
  let projectiles = [];
  let particles = [];
  let floaters = [];
  let player = createPlayer();
  let phase = "playing";
  let lives = campaignLevel >= 10 ? 2 : 3;
  let collected = 0;
  let bigCollected = 0;
  let enemiesDefeated = 0;
  let secretsFound = 0;
  let elapsed = 0;
  let cameraX = 0;
  let respawnPoint = { x: 92, y: 500 };
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let lastFrame = performance.now();
  let statusAction = "resume";
  let shake = 0;
  let toast = { text: "", subtext: "", timer: 0, color: "#ffe272" };
  let combo = 0;
  let comboTimer = 0;
  let bossIntroPlayed = false;
  let bossDefeated = false;
  let victoryTimer = 0;
  let seed = campaignLevel * 997 + 73;

  function createPlayer() {
    return {
      x: 92,
      y: 500,
      width: 44,
      height: 76,
      vx: 0,
      vy: 0,
      grounded: false,
      jumpCount: 0,
      facing: 1,
      invincible: 1,
      hurt: 0,
      landing: 0,
      abilities: { shield: false, speed: 0, doubleJump: 0, magnet: 0, star: 0 },
    };
  }

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function loadLevelState() {
    level = buildLevel(campaignLevel);
    worldWidth = level.worldWidth;
    platforms = level.platforms.map((entry) => ({ ...entry }));
    movingPlatforms = level.movingPlatforms.map((entry) => ({ ...entry }));
    fallingPlatforms = level.fallingPlatforms.map((entry) => ({ ...entry }));
    springs = level.springs.map((entry) => ({ ...entry }));
    spikes = level.spikes.map((entry) => ({ ...entry }));
    hazards = level.hazards.map((entry) => ({ ...entry }));
    coins = level.coins.map((entry) => ({ ...entry }));
    enemies = level.enemies.map(createEnemy);
    items = level.items.map((entry) => ({ ...entry }));
    hiddenBlocks = level.hiddenBlocks.map((entry) => ({ ...entry }));
    checkpoints = level.checkpoints.map((entry) => ({ ...entry }));
    secretZones = level.secretZones.map((entry) => ({ ...entry }));
    boss = new BossEnemy({ ...level.boss });
    goal = { ...level.goal };
  }

  function newGame() {
    seed = campaignLevel * 997 + 73;
    loadLevelState();
    player = createPlayer();
    phase = "playing";
    lives = campaignLevel >= 10 ? 2 : 3;
    collected = 0;
    bigCollected = 0;
    enemiesDefeated = 0;
    secretsFound = 0;
    elapsed = 0;
    cameraX = 0;
    respawnPoint = { x: 92, y: 500 };
    roundStartedAt = Date.now();
    roundRecorded = false;
    projectiles = [];
    particles = [];
    floaters = [];
    shake = 0;
    combo = 0;
    comboTimer = 0;
    bossIntroPlayed = false;
    bossDefeated = false;
    victoryTimer = 0;
    toast = { text: "王子历险记", subtext: "寻找三枚太阳金币，击败雷霆巨兽", timer: 3.4, color: "#ffe272" };
    pauseButton.textContent = "暂停";
    shareOutput.textContent = "";
    hideStatus();
    settlementPanel.hidden = true;
    if (qaScene === "mechanisms") setQaStart(1480, 420);
    if (qaScene === "secrets") setQaStart(2260, 500);
    if (qaScene === "items") setQaStart(3000, 330);
    if (qaScene === "boss") setQaStart(6240, 500);
    updateSoundButton();
    updateHud();
    canvas.focus();
  }

  function setQaStart(x, y) {
    player.x = x;
    player.y = y;
    player.invincible = 2;
    respawnPoint = { x, y };
    cameraX = clamp(x - canvas.width * 0.34, 0, worldWidth - canvas.width);
  }

  function loop(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.033);
    lastFrame = now;
    if (phase === "playing") update(delta);
    else updateEffects(delta);
    render();
    requestAnimationFrame(loop);
  }

  function update(delta) {
    elapsed += delta;
    victoryTimer = Math.max(0, victoryTimer - delta);
    shake = Math.max(0, shake - delta * 18);
    toast.timer = Math.max(0, toast.timer - delta);
    comboTimer = Math.max(0, comboTimer - delta);
    if (comboTimer <= 0) combo = 0;
    player.invincible = Math.max(0, player.invincible - delta);
    player.hurt = Math.max(0, player.hurt - delta);
    player.landing = Math.max(0, player.landing - delta);
    for (const key of ["speed", "doubleJump", "magnet", "star"]) {
      player.abilities[key] = Math.max(0, player.abilities[key] - delta);
    }

    updatePlatforms(delta);
    updatePlayer(delta);
    updateMechanisms(delta);
    updateCoins(delta);
    updateItems();
    updateEnemies(delta);
    updateProjectiles(delta);
    updateCheckpointsAndSecrets();
    updateEffects(delta);

    if (player.x > 6200 && !bossIntroPlayed) {
      bossIntroPlayed = true;
      boss.active = true;
      showToast("Boss：雷霆巨兽", "踩中头顶三次，注意砸地冲击波", "#ff9ad5", 3.2);
      playSequence([140, 175, 130], 0.11);
      shake = 8;
    }
    if (player.x > 6200) boss.active = true;

    cameraX += (clamp(player.x - canvas.width * 0.34, 0, worldWidth - canvas.width) - cameraX) * Math.min(1, delta * 6.2);
    if (player.y > canvas.height + 170) fallFromWorld();
    if (player.x + player.width >= goal.x && bossDefeated) beginVictory();
    else if (player.x + player.width >= goal.x && !bossDefeated) {
      player.x = goal.x - player.width - 6;
      player.vx = -120;
      showToast("传送门尚未开启", "先击败雷霆巨兽", "#ffaf66", 1.5);
    }
    updateHud();
  }

  function updatePlatforms(delta) {
    for (const platform of movingPlatforms) {
      const previousX = platform.x;
      const previousY = platform.y;
      const wave = Math.sin(elapsed * platform.speed + platform.phase);
      platform.x = platform.baseX + (platform.axis === "x" ? wave * platform.distance : 0);
      platform.y = platform.baseY + (platform.axis === "y" ? wave * platform.distance : 0);
      platform.dx = platform.x - previousX;
      platform.dy = platform.y - previousY;
    }
    for (const platform of fallingPlatforms) {
      if (platform.state === "shaking") {
        platform.timer -= delta;
        platform.shake = Math.sin(platform.timer * 55) * 4;
        if (platform.timer <= 0) {
          platform.state = "falling";
          platform.timer = 2.4;
        }
      } else if (platform.state === "falling") {
        platform.y += 520 * delta;
        platform.timer -= delta;
        if (platform.timer <= 0) {
          platform.state = "recovering";
          platform.timer = 1.3;
        }
      } else if (platform.state === "recovering") {
        platform.timer -= delta;
        if (platform.timer <= 0) {
          platform.state = "idle";
          platform.y = platform.baseY;
          platform.shake = 0;
        }
      }
    }
    for (const spring of springs) spring.compression = Math.max(0, spring.compression - delta * 4.5);
  }

  function updatePlayer(delta) {
    const acceleration = player.grounded ? 1850 : 1050;
    const speedBoost = player.abilities.speed > 0 ? 1.42 : 1;
    const maxSpeed = (270 + campaignLevel * 2.4) * speedBoost;
    if (keys.left) {
      player.vx -= acceleration * delta;
      player.facing = -1;
    }
    if (keys.right) {
      player.vx += acceleration * delta;
      player.facing = 1;
    }
    if (!keys.left && !keys.right) player.vx *= Math.pow(player.grounded ? 0.001 : 0.1, delta);
    player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
    if (player.abilities.speed > 0 && Math.abs(player.vx) > 120 && random() < delta * 18) {
      particles.push(makeParticle(player.x + player.width / 2 - player.facing * 18, player.y + 48, "#70e7ff", 0.35, -player.facing * 70, 0, 5));
    }

    player.x = clamp(player.x + player.vx * delta, 0, worldWidth - player.width);
    const previousY = player.y;
    const previousBottom = previousY + player.height;
    const wasGrounded = player.grounded;
    player.vy += gravity * delta;
    player.y += player.vy * delta;
    player.grounded = false;

    const collisions = getCollisionPlatforms();
    for (const platform of collisions) {
      if (
        player.vy >= 0 &&
        player.x + player.width - 7 > platform.x &&
        player.x + 7 < platform.x + platform.width &&
        previousBottom <= platform.y + 12 &&
        player.y + player.height >= platform.y
      ) {
        player.y = platform.y - player.height;
        player.vy = 0;
        player.grounded = true;
        player.jumpCount = 0;
        if (!wasGrounded) {
          player.landing = 0.14;
          dust(player.x + player.width / 2, player.y + player.height, 5);
        }
        if (platform.axis) {
          player.x += platform.dx;
          player.y += Math.min(0, platform.dy);
        }
        if (platform.state === "idle") {
          platform.state = "shaking";
          platform.timer = 0.72;
          playTone(165, 0.045);
        }
      }
    }

    if (wasGrounded && !player.grounded && player.vy >= 0) player.jumpCount = Math.max(1, player.jumpCount);
    if (player.vy < 0) checkHiddenBlockHits(previousY);
  }

  function getCollisionPlatforms() {
    const revealed = hiddenBlocks.filter((block) => block.revealed).map((block) => ({ ...block, kind: "hidden" }));
    return [
      ...platforms,
      ...movingPlatforms,
      ...fallingPlatforms.filter((entry) => entry.state === "idle" || entry.state === "shaking"),
      ...revealed,
    ];
  }

  function checkHiddenBlockHits(previousY) {
    for (const block of hiddenBlocks) {
      if (block.hit) continue;
      const blockBottom = block.y + block.height;
      if (
        player.x + player.width > block.x &&
        player.x < block.x + block.width &&
        previousY >= blockBottom - 8 &&
        player.y <= blockBottom
      ) {
        block.hit = true;
        block.revealed = true;
        player.y = blockBottom;
        player.vy = 90;
        shake = 3;
        burst(block.x + block.width / 2, block.y, "#ffe075", 12);
        floater(block.x + block.width / 2, block.y - 10, "发现隐藏砖块！", "#fff0a4");
        if (block.reward === "coin") coins.push({ id: `bonus-${Date.now()}`, x: block.x + 26, y: block.y - 35, type: "normal", secret: true, taken: false, phase: 0, vx: 0, vy: -80 });
        if (block.reward === "shield") items.push({ id: `bonus-${Date.now()}`, type: "shield", x: block.x + 26, y: block.y - 35, taken: false, secret: true });
        if (block.reward === "platform") platforms.push({ id: `bonus-platform-${Date.now()}`, x: block.x - 80, y: block.y - 115, width: 215, height: 22, kind: "hidden-ledge" });
        playSequence([280, 430, 620], 0.045);
      }
    }
  }

  function updateMechanisms(delta) {
    for (const spring of springs) {
      if (
        player.vy >= 0 &&
        player.x + player.width > spring.x &&
        player.x < spring.x + spring.width &&
        player.y + player.height >= spring.y &&
        player.y + player.height <= spring.y + spring.height + 22
      ) {
        player.y = spring.y - player.height;
        player.vy = -820;
        player.grounded = false;
        player.jumpCount = 1;
        spring.compression = 1;
        burst(spring.x + spring.width / 2, spring.y, "#6af0c6", 18);
        floater(spring.x + 24, spring.y - 20, "高高弹起！", "#9ffff0");
        playSequence([260, 420, 690], 0.055);
      }
    }
    for (const spike of spikes) if (intersects(player, spike)) damagePlayer("碰到尖刺", spike.x + spike.width / 2);
    for (const hazard of hazards) {
      if (hazard.type === "hammer") {
        const angle = Math.sin(elapsed * 1.8 + hazard.phase) * 0.9;
        hazard.x = hazard.anchorX + Math.sin(angle) * hazard.length - hazard.width / 2;
        hazard.y = hazard.anchorY + Math.cos(angle) * hazard.length - hazard.height / 2;
      } else if (hazard.type === "roller") {
        hazard.x = hazard.baseX + (Math.sin(elapsed * 1.4 + hazard.phase) + 1) * 0.5 * hazard.range;
        hazard.y = hazard.baseY;
      } else {
        hazard.x = hazard.baseX;
        hazard.y = hazard.baseY + (Math.sin(elapsed * 2.1 + hazard.phase) + 1) * 68;
      }
      if (intersects(player, hazard)) damagePlayer("被机关击中", hazard.x + hazard.width / 2);
    }
  }

  function updateCoins(delta) {
    for (const coin of coins) {
      if (coin.taken) continue;
      const dx = player.x + player.width / 2 - coin.x;
      const dy = player.y + player.height / 2 - coin.y;
      const distance = Math.hypot(dx, dy);
      if (player.abilities.magnet > 0 && coin.type === "normal" && distance < 235) {
        coin.vx += (dx / Math.max(1, distance)) * 980 * delta;
        coin.vy += (dy / Math.max(1, distance)) * 980 * delta;
        coin.vx *= Math.pow(0.06, delta);
        coin.vy *= Math.pow(0.06, delta);
        coin.x += coin.vx * delta;
        coin.y += coin.vy * delta;
      } else if (coin.vy < 0) {
        coin.vy += 300 * delta;
        coin.y += coin.vy * delta;
      }
      const collectRadius = coin.type === "big" ? 50 : 38;
      if (distance < collectRadius) collectCoin(coin);
    }
  }

  function collectCoin(coin) {
    coin.taken = true;
    const big = coin.type === "big";
    if (big) {
      bigCollected += 1;
      collected += 5;
      burst(coin.x, coin.y, "#fff27a", 28);
      floater(coin.x, coin.y - 20, `太阳金币 ${bigCollected}/3`, "#fff7a6");
      showToast("找到太阳金币！", `${bigCollected} / 3`, "#fff070", 1.8);
      playSequence([520, 660, 820, 1040], 0.07);
      shake = 4;
      return;
    }
    collected += 1;
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 1.05;
    burst(coin.x, coin.y, "#ffd75e", 9);
    floater(coin.x, coin.y - 12, combo >= 4 ? `+1  连击 x${combo}` : "+1", "#fff1a3");
    playTone(650 + Math.min(7, combo) * 52, 0.045);
  }

  function updateItems() {
    for (const item of items) {
      if (item.taken) continue;
      const box = { x: item.x - 22, y: item.y - 22, width: 44, height: 44 };
      if (!intersects(player, box)) continue;
      item.taken = true;
      const labels = {
        shield: ["星辉护盾", "抵挡一次伤害", "#6fd9ff"],
        speed: ["疾风靴", "移动加速 8 秒", "#70f0ff"],
        doubleJump: ["云羽徽章", "二段跳 10 秒", "#d9a8ff"],
        magnet: ["金币磁铁", "自动吸取 9 秒", "#ff8fbc"],
        star: ["无敌星", "无敌 6 秒", "#fff36d"],
      };
      if (item.type === "shield") player.abilities.shield = true;
      if (item.type === "speed") player.abilities.speed = 8;
      if (item.type === "doubleJump") player.abilities.doubleJump = 10;
      if (item.type === "magnet") player.abilities.magnet = 9;
      if (item.type === "star") player.abilities.star = 5.8;
      const [name, detail, color] = labels[item.type];
      showToast(name, detail, color, 2);
      burst(item.x, item.y, color, 22);
      floater(item.x, item.y - 25, name, color);
      playSequence([390, 560, 760], 0.065);
    }
  }

  function updateEnemies(delta) {
    for (const enemy of [...enemies, boss]) {
      if (!enemy.alive) continue;
      enemy.update(delta, player, projectiles, elapsed);
      if (!intersects(player, enemy) || player.invincible > 0) continue;
      if (player.abilities.star > 0 && enemy.type !== "boss") {
        defeatEnemy(enemy, true);
        continue;
      }
      const previousBottom = player.y + player.height - player.vy * delta;
      const stomped = enemy.stompable && player.vy > 125 && previousBottom <= enemy.y + Math.min(24, enemy.height * 0.3);
      if (stomped) {
        player.y = enemy.y - player.height + 3;
        player.vy = enemy.type === "boss" ? -520 : -410;
        const defeated = enemy.hit();
        shake = enemy.type === "boss" ? 10 : 4;
        burst(enemy.x + enemy.width / 2, enemy.y + 12, enemy.type === "boss" ? "#63dfff" : "#ffd56a", enemy.type === "boss" ? 30 : 16);
        playSequence(enemy.type === "boss" ? [115, 95, 180] : [180, 250], 0.075);
        if (enemy.type === "boss") {
          floater(enemy.x + enemy.width / 2, enemy.y - 18, defeated ? "雷霆巨兽被击败！" : `Boss -1  剩余 ${enemy.hp}`, "#9ef4ff");
          if (defeated) defeatBoss();
          else showToast("有效攻击！", `还需踩中 ${enemy.hp} 次`, "#7ff2ff", 1.25);
        } else if (defeated) defeatEnemy(enemy, false);
      } else {
        damagePlayer(enemy.type === "boss" ? "被雷霆巨兽撞到" : "被怪物撞到", enemy.x + enemy.width / 2);
      }
    }
  }

  function defeatEnemy(enemy, starHit) {
    if (enemy.alive) enemy.alive = false;
    enemiesDefeated += 1;
    enemy.squash = 0.3;
    burst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, starHit ? "#fff76d" : "#ffc05c", 18);
    floater(enemy.x + enemy.width / 2, enemy.y - 12, starHit ? "星光击破！" : "+150", "#ffe493");
    playTone(starHit ? 760 : 190, 0.075);
  }

  function defeatBoss() {
    bossDefeated = true;
    boss.active = false;
    projectiles = projectiles.filter((entry) => !entry.hostile);
    shake = 14;
    victoryTimer = 2;
    burst(boss.x + boss.width / 2, boss.y + boss.height / 2, "#6ee9ff", 55);
    showToast("雷霆巨兽已败！", "终点传送门已开启", "#8ff7ff", 3);
    playSequence([180, 260, 390, 520, 760], 0.095);
  }

  function updateProjectiles(delta) {
    for (const projectile of projectiles) {
      projectile.life -= delta;
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      if (projectile.type === "seed") projectile.vy += 65 * delta;
      if (projectile.hostile && projectile.life > 0 && intersects(player, projectile)) {
        projectile.life = 0;
        damagePlayer("被种子弹击中", projectile.x);
      }
    }
    projectiles = projectiles.filter((entry) => entry.life > 0 && entry.x > -100 && entry.x < worldWidth + 100);
  }

  function updateCheckpointsAndSecrets() {
    for (const checkpoint of checkpoints) {
      if (!checkpoint.active && intersects(player, checkpoint)) {
        checkpoints.forEach((entry) => { entry.active = false; });
        checkpoint.active = true;
        respawnPoint = { x: checkpoint.x + 48, y: checkpoint.y - player.height };
        lives = Math.max(lives, 2);
        burst(checkpoint.x + 18, checkpoint.y + 15, "#6fffc6", 30);
        showToast("检查点点亮！", "跌落后将从这里继续", "#78ffd2", 2.2);
        playSequence([360, 520, 720], 0.07);
      }
    }
    for (const zone of secretZones) {
      if (!zone.found && intersects(player, zone)) {
        zone.found = true;
        secretsFound += 1;
        showToast(`发现秘密区域：${zone.name}`, "探索奖励已计入完成度", "#d8b2ff", 2.4);
        burst(player.x + player.width / 2, player.y + player.height / 2, "#c99cff", 20);
        playSequence([450, 590, 780], 0.065);
      }
    }
  }

  function jump() {
    if (phase !== "playing") return;
    const jumpState = getNextJump(player.grounded, player.jumpCount, campaignLevel, player.abilities.doubleJump > 0);
    if (!jumpState) return;
    player.jumpCount = jumpState.jumpCount;
    player.vy = jumpState.velocity;
    player.grounded = false;
    burst(player.x + player.width / 2, player.y + player.height, jumpState.isAirJump ? "#d79cff" : "#d9d2b4", jumpState.isAirJump ? 14 : 7);
    if (jumpState.isAirJump) floater(player.x + player.width / 2, player.y + 30, "二段跳", "#e4bdff");
    playTone(jumpState.isAirJump ? 510 : 330, jumpState.isAirJump ? 0.085 : 0.06);
  }

  function damagePlayer(reason, sourceX) {
    if (phase !== "playing" || player.invincible > 0 || player.abilities.star > 0) return;
    if (player.abilities.shield) {
      player.abilities.shield = false;
      player.invincible = 0.65;
      shake = 5;
      burst(player.x + player.width / 2, player.y + player.height / 2, "#70ddff", 25);
      showToast("护盾挡住了伤害", "星辉护盾已消耗", "#70ddff", 1.45);
      playSequence([620, 360], 0.075);
      return;
    }
    lives -= 1;
    player.invincible = 1.55;
    player.hurt = 0.38;
    player.vx = player.x < sourceX ? -285 : 285;
    player.vy = -310;
    shake = 8;
    burst(player.x + player.width / 2, player.y + player.height / 2, "#ff756f", 22);
    floater(player.x + player.width / 2, player.y - 10, "生命 -1", "#ff9b94");
    playSequence([155, 105], 0.095);
    if (lives <= 0) endRun(reason);
  }

  function fallFromWorld() {
    if (phase !== "playing") return;
    lives -= 1;
    playTone(105, 0.16);
    if (lives <= 0) {
      endRun("跌入山谷");
      return;
    }
    respawn();
  }

  function respawn() {
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    player.vx = 0;
    player.vy = 0;
    player.jumpCount = 0;
    player.invincible = 2;
    showToast("从检查点继续", "小心前方机关", "#8fffd6", 1.6);
  }

  function endRun(reason) {
    if (phase !== "playing") return;
    phase = "down";
    keys.left = false;
    keys.right = false;
    const reviveCards = campaign.getSummary().inventory["revive-card"] ?? 0;
    if (reviveCards > 0) {
      statusAction = "revive";
      showStatus("历险中断", `${reason} · 可使用复活卡`, "使用复活卡");
    } else showSettlement(reason, false);
  }

  function beginVictory() {
    if (phase !== "playing") return;
    phase = "celebrating";
    keys.left = false;
    keys.right = false;
    player.vx = 0;
    burst(goal.x + goal.width / 2, goal.y + goal.height / 2, "#fff575", 60);
    showToast("关卡完成！", "王子找回了星辉核心", "#fff57b", 2.4);
    playSequence([440, 554, 659, 880], 0.12);
    setTimeout(() => showSettlement("关卡完成！", true), 900);
  }

  function currentScore(completed = phase === "celebrating" || phase === "complete") {
    const progressScore = Math.round(clamp(player.x / goal.x, 0, 1) * 500);
    const finishBonus = completed ? 1200 + campaignLevel * 60 : 0;
    const timeBonus = completed ? Math.max(0, Math.round((240 - elapsed) * 7)) : 0;
    return Math.max(0, collected * 55 + bigCollected * 650 + enemiesDefeated * 150 + secretsFound * 300 + progressScore + finishBonus + timeBonus);
  }

  function recordRound(completed) {
    if (roundRecorded) return { record: getGameRecord(gameId), newHighScore: false };
    roundRecorded = true;
    return saveGameResult(gameId, {
      score: currentScore(completed),
      highestLevel: campaignLevel,
      playTime: Math.round((Date.now() - roundStartedAt) / 1000),
      completed,
    });
  }

  function showSettlement(reason, completed) {
    phase = completed ? "complete" : "down";
    const result = recordRound(completed);
    finalScore.textContent = formatScore(currentScore(completed));
    finalCoins.textContent = String(collected);
    finalBigCoins.textContent = `${bigCollected} / 3`;
    finalTime.textContent = formatTime(elapsed);
    settlementKicker.textContent = result.newHighScore ? "新纪录" : completed ? "历险完成" : "历险中断";
    settlementTitle.textContent = reason;
    hideStatus();
    settlementPanel.hidden = false;
    postRecordUpdate();
  }

  function showStatus(kicker, title, label) {
    statusKicker.textContent = kicker;
    statusTitle.textContent = title;
    statusButton.textContent = label;
    statusPanel.hidden = false;
  }

  function hideStatus() {
    statusPanel.hidden = true;
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      statusAction = "resume";
      pauseButton.textContent = "继续";
      showStatus("历险暂停", "王子正在整备", "继续");
    } else if (phase === "paused") {
      phase = "playing";
      pauseButton.textContent = "暂停";
      hideStatus();
      canvas.focus();
    }
  }

  function handleStatusAction() {
    if (statusAction === "revive") {
      if (campaign.consumeItem("revive-card")) {
        lives = 2;
        phase = "playing";
        respawn();
        hideStatus();
        updateHud();
      } else showSettlement("复活卡不足", false);
      return;
    }
    togglePause();
  }

  function updateHud() {
    scoreEl.textContent = formatScore(currentScore());
    livesEl.textContent = "♥".repeat(Math.max(0, lives));
    coinsEl.textContent = String(collected);
    bigCoinsEl.textContent = `${bigCollected}/3`;
    progressEl.textContent = `${Math.round(clamp(player.x / goal.x, 0, 1) * 100)}%`;
    const chips = [];
    if (player.abilities.shield) chips.push(["◉", "护盾", "1 次"]);
    if (player.abilities.speed > 0) chips.push(["➜", "疾风", `${Math.ceil(player.abilities.speed)}s`]);
    if (player.abilities.doubleJump > 0) chips.push(["↟", "二段跳", `${Math.ceil(player.abilities.doubleJump)}s`]);
    if (player.abilities.magnet > 0) chips.push(["∪", "磁铁", `${Math.ceil(player.abilities.magnet)}s`]);
    if (player.abilities.star > 0) chips.push(["★", "无敌", `${Math.ceil(player.abilities.star)}s`]);
    abilityBar.innerHTML = chips.map(([icon, name, value]) => `<span class="ability-chip">${icon} ${name} <strong>${value}</strong></span>`).join("");
    if (qaEnabled) {
      canvas.dataset.playerX = player.x.toFixed(2);
      canvas.dataset.playerY = player.y.toFixed(2);
      canvas.dataset.playerVy = player.vy.toFixed(2);
      canvas.dataset.grounded = String(player.grounded);
      canvas.dataset.jumpCount = String(player.jumpCount);
      canvas.dataset.enemyTypes = [...new Set(enemies.map((enemy) => enemy.type))].join(",");
      canvas.dataset.bossHp = String(boss.hp);
      canvas.dataset.checkpoint = String(respawnPoint.x);
      canvas.dataset.bigCoins = String(bigCollected);
      canvas.dataset.phase = phase;
    }
  }

  function render() {
    drawBackground();
    ctx.save();
    if (shake > 0) ctx.translate((random() - 0.5) * shake, (random() - 0.5) * shake * 0.55);
    ctx.translate(-cameraX, 0);
    drawWorld();
    drawSecrets();
    drawMovingPlatforms();
    drawFallingPlatforms();
    drawSprings();
    drawSpikesAndHazards();
    drawCheckpoints();
    drawHiddenBlocks();
    drawGoal();
    drawCoins();
    drawItems();
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawEffects();
    ctx.restore();
    drawAtmosphere();
    drawToast();
    drawBossHud();
  }

  function drawBackground() {
    ctx.fillStyle = "#75b8d7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (background?.complete && background.naturalWidth) {
      const scale = Math.max(canvas.width / background.naturalWidth, canvas.height / background.naturalHeight);
      const width = background.naturalWidth * scale;
      const height = background.naturalHeight * scale;
      const offset = (cameraX * 0.04) % Math.max(1, width);
      for (let x = -offset - width; x < canvas.width + width; x += width) ctx.drawImage(background, x, (canvas.height - height) / 2, width, height);
    }
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "rgba(90, 186, 230, 0.08)");
    sky.addColorStop(0.58, "rgba(220, 242, 211, 0.08)");
    sky.addColorStop(1, "rgba(18, 32, 34, 0.46)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawWorld() {
    for (const platform of platforms) {
      if (!visible(platform.x, platform.width)) continue;
      const secret = String(platform.kind).includes("secret") || String(platform.kind).includes("hidden");
      const gradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + Math.min(150, platform.height));
      gradient.addColorStop(0, secret ? "#755ca0" : platform.kind === "ledge" ? "#8f8b72" : "#617253");
      gradient.addColorStop(0.12, secret ? "#403461" : "#39483a");
      gradient.addColorStop(1, "#17231d");
      ctx.fillStyle = gradient;
      roundedRect(ctx, platform.x, platform.y, platform.width, platform.height, Math.min(10, platform.height / 2));
      ctx.fill();
      ctx.fillStyle = secret ? "#c0a2ff" : "#b9b982";
      ctx.fillRect(platform.x + 3, platform.y, platform.width - 6, 5);
      ctx.fillStyle = secret ? "rgba(198,161,255,.3)" : "rgba(22, 41, 28, .65)";
      for (let x = platform.x + 18; x < platform.x + platform.width - 8; x += 42) ctx.fillRect(x, platform.y + 14, 3, 8 + ((x / 7) % 13));
    }
  }

  function drawSecrets() {
    for (const zone of secretZones) {
      if (!visible(zone.x, zone.width)) continue;
      ctx.fillStyle = zone.found ? "rgba(199,153,255,.08)" : "rgba(19,14,36,.16)";
      roundedRect(ctx, zone.x, zone.y, zone.width, zone.height, 24);
      ctx.fill();
      if (zone.found) {
        ctx.fillStyle = "rgba(225,199,255,.75)";
        ctx.font = "800 13px system-ui";
        ctx.fillText(`秘密区域 · ${zone.name}`, zone.x + 18, zone.y + 25);
      }
    }
  }

  function drawMovingPlatforms() {
    for (const platform of movingPlatforms) {
      if (!visible(platform.x, platform.width)) continue;
      ctx.fillStyle = "#4d6f80";
      roundedRect(ctx, platform.x, platform.y, platform.width, platform.height, 9);
      ctx.fill();
      ctx.fillStyle = "#7de0df";
      ctx.fillRect(platform.x + 8, platform.y + 3, platform.width - 16, 4);
      ctx.fillStyle = "rgba(111,238,226,.45)";
      ctx.beginPath();
      ctx.arc(platform.x + 14, platform.y + 11, 4, 0, Math.PI * 2);
      ctx.arc(platform.x + platform.width - 14, platform.y + 11, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFallingPlatforms() {
    for (const platform of fallingPlatforms) {
      if (platform.state === "recovering" || !visible(platform.x, platform.width)) continue;
      ctx.save();
      ctx.translate(platform.shake, 0);
      ctx.fillStyle = platform.state === "shaking" ? "#d88358" : "#876a58";
      roundedRect(ctx, platform.x, platform.y, platform.width, platform.height, 7);
      ctx.fill();
      ctx.strokeStyle = "#e6c19c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(platform.x + 28, platform.y + 3);
      ctx.lineTo(platform.x + 40, platform.y + 16);
      ctx.lineTo(platform.x + 55, platform.y + 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSprings() {
    for (const spring of springs) {
      if (!visible(spring.x, spring.width)) continue;
      const compression = spring.compression;
      ctx.fillStyle = "#e95775";
      roundedRect(ctx, spring.x, spring.y + compression * 10, spring.width, spring.height - compression * 8, 8);
      ctx.fill();
      ctx.fillStyle = "#fff091";
      ctx.fillRect(spring.x + 4, spring.y + compression * 10, spring.width - 8, 7);
      ctx.strokeStyle = "#bdebd7";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(spring.x + 12, spring.y + 10);
      ctx.lineTo(spring.x + 20, spring.y + 19);
      ctx.lineTo(spring.x + 28, spring.y + 10);
      ctx.lineTo(spring.x + 36, spring.y + 19);
      ctx.stroke();
    }
  }

  function drawSpikesAndHazards() {
    for (const spike of spikes) {
      if (!visible(spike.x, spike.width)) continue;
      ctx.fillStyle = "#d9e2e5";
      for (let x = spike.x; x < spike.x + spike.width; x += 23) {
        ctx.beginPath();
        ctx.moveTo(x, spike.y + spike.height);
        ctx.lineTo(x + 11, spike.y);
        ctx.lineTo(x + 22, spike.y + spike.height);
        ctx.fill();
      }
      ctx.fillStyle = "#f56d68";
      ctx.fillRect(spike.x, spike.y + spike.height - 5, spike.width, 5);
    }
    for (const hazard of hazards) {
      if (!visible(hazard.x, hazard.width)) continue;
      if (hazard.type === "hammer") {
        ctx.strokeStyle = "#49515d";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hazard.anchorX, hazard.anchorY);
        ctx.lineTo(hazard.x + hazard.width / 2, hazard.y + hazard.height / 2);
        ctx.stroke();
      }
      ctx.fillStyle = hazard.type === "roller" ? "#e4a54b" : "#6d6575";
      ctx.beginPath();
      ctx.arc(hazard.x + hazard.width / 2, hazard.y + hazard.height / 2, hazard.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5d16a";
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8 + elapsed;
        ctx.beginPath();
        ctx.moveTo(hazard.x + hazard.width / 2 + Math.cos(angle) * hazard.width * 0.42, hazard.y + hazard.height / 2 + Math.sin(angle) * hazard.width * 0.42);
        ctx.lineTo(hazard.x + hazard.width / 2 + Math.cos(angle - 0.16) * hazard.width * 0.68, hazard.y + hazard.height / 2 + Math.sin(angle - 0.16) * hazard.width * 0.68);
        ctx.lineTo(hazard.x + hazard.width / 2 + Math.cos(angle + 0.16) * hazard.width * 0.68, hazard.y + hazard.height / 2 + Math.sin(angle + 0.16) * hazard.width * 0.68);
        ctx.fill();
      }
    }
  }

  function drawCheckpoints() {
    for (const checkpoint of checkpoints) {
      if (!visible(checkpoint.x, checkpoint.width)) continue;
      ctx.fillStyle = "#5d5251";
      ctx.fillRect(checkpoint.x + 14, checkpoint.y, 9, checkpoint.height);
      ctx.fillStyle = checkpoint.active ? "#62f4bd" : "#88939a";
      ctx.beginPath();
      ctx.moveTo(checkpoint.x + 23, checkpoint.y + 8);
      ctx.lineTo(checkpoint.x + 68, checkpoint.y + 24);
      ctx.lineTo(checkpoint.x + 23, checkpoint.y + 42);
      ctx.closePath();
      ctx.fill();
      if (checkpoint.active) {
        ctx.strokeStyle = "rgba(103,255,204,.45)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(checkpoint.x + 20, checkpoint.y + 26, 32 + Math.sin(elapsed * 4) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawHiddenBlocks() {
    for (const block of hiddenBlocks) {
      if (!block.revealed || !visible(block.x, block.width)) continue;
      ctx.fillStyle = block.hit ? "#7b5f93" : "#aa88c5";
      roundedRect(ctx, block.x, block.y, block.width, block.height, 8);
      ctx.fill();
      ctx.strokeStyle = "#e0c4ff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#f5e8ff";
      ctx.font = "900 24px system-ui";
      ctx.fillText(block.hit ? "✦" : "?", block.x + 17, block.y + 34);
    }
  }

  function drawGoal() {
    const open = bossDefeated;
    ctx.fillStyle = "#3e4352";
    roundedRect(ctx, goal.x, goal.y, goal.width, goal.height, 42);
    ctx.fill();
    const glow = ctx.createRadialGradient(goal.x + goal.width / 2, goal.y + goal.height / 2, 5, goal.x + goal.width / 2, goal.y + goal.height / 2, 70);
    glow.addColorStop(0, open ? "rgba(255,247,115,.95)" : "rgba(119,132,152,.65)");
    glow.addColorStop(1, open ? "rgba(101,238,255,.08)" : "rgba(60,68,78,.05)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(goal.x + goal.width / 2, goal.y + goal.height / 2, 34 + Math.sin(elapsed * 4) * 3, 66, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = open ? "#83f5ff" : "#7f8995";
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  function drawCoins() {
    for (const coin of coins) {
      if (coin.taken || !visible(coin.x - 25, 50)) continue;
      const big = coin.type === "big";
      const bob = Math.sin(elapsed * 4 + coin.phase) * 5;
      const radius = big ? 24 : 14;
      const shine = ctx.createRadialGradient(coin.x - 5, coin.y + bob - 6, 2, coin.x, coin.y + bob, radius);
      shine.addColorStop(0, "#fffbd1");
      shine.addColorStop(0.35, big ? "#fff052" : "#f0c65c");
      shine.addColorStop(1, big ? "#d27817" : "#956522");
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + bob, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(75,45,8,.7)";
      ctx.lineWidth = big ? 3 : 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(120,65,8,.72)";
      if (big) {
        ctx.beginPath();
        for (let index = 0; index < 10; index += 1) {
          const angle = -Math.PI / 2 + (Math.PI * index) / 5;
          const length = index % 2 === 0 ? 12 : 5;
          const x = coin.x + Math.cos(angle) * length;
          const y = coin.y + bob + Math.sin(angle) * length;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      } else ctx.fillRect(coin.x - 2, coin.y + bob - 7, 4, 14);
    }
  }

  function drawItems() {
    for (const item of items) {
      if (item.taken || !visible(item.x - 28, 56)) continue;
      const bob = Math.sin(elapsed * 3.8 + item.x * 0.01) * 5;
      const colors = { shield: "#6ddcff", speed: "#68e7f1", doubleJump: "#c895ff", magnet: "#ff77ac", star: "#ffed58" };
      ctx.fillStyle = "rgba(18,25,40,.65)";
      ctx.beginPath();
      ctx.arc(item.x, item.y + bob, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors[item.type];
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = colors[item.type];
      ctx.font = "900 24px system-ui";
      const icons = { shield: "◉", speed: "➜", doubleJump: "↟", magnet: "∪", star: "★" };
      ctx.fillText(icons[item.type], item.x - 12, item.y + bob + 8);
    }
  }

  function drawProjectiles() {
    for (const projectile of projectiles) {
      if (!visible(projectile.x, projectile.width)) continue;
      ctx.fillStyle = projectile.type === "seed" ? "#9acb48" : "#5fd8ff";
      ctx.beginPath();
      ctx.ellipse(projectile.x + projectile.width / 2, projectile.y + projectile.height / 2, projectile.width / 2, projectile.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = projectile.type === "seed" ? "#476c25" : "#d8f8ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawEnemies() {
    for (const enemy of enemies) if (enemy.alive && visible(enemy.x, enemy.width)) enemy.draw(ctx, elapsed);
    if (boss.alive && visible(boss.x, boss.width)) boss.draw(ctx, elapsed);
  }

  function drawPlayer() {
    const flicker = player.invincible > 0 && Math.floor(elapsed * 15) % 2 === 0;
    if (flicker) return;
    const x = player.x;
    const y = player.y;
    const run = player.grounded ? Math.sin(elapsed * 14) * Math.min(1, Math.abs(player.vx) / 120) : 0;
    const squashY = player.landing > 0 ? 0.9 : 1;
    if (player.abilities.speed > 0) {
      ctx.strokeStyle = "rgba(102,236,255,.42)";
      ctx.lineWidth = 5;
      for (let index = 0; index < 3; index += 1) {
        ctx.beginPath();
        ctx.moveTo(x - player.facing * (8 + index * 9), y + 28 + index * 12);
        ctx.lineTo(x - player.facing * (36 + index * 14), y + 28 + index * 12);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(x + player.width / 2, y + player.height);
    ctx.scale(player.facing, squashY);
    ctx.translate(0, -player.height);
    ctx.fillStyle = "rgba(15,22,31,.28)";
    ctx.beginPath();
    ctx.ellipse(0, player.height + 4, player.grounded ? 24 : 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4b2f1d";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, 50);
    ctx.lineTo(-9 + run * 6, player.grounded ? 70 : 64);
    ctx.moveTo(8, 50);
    ctx.lineTo(9 - run * 6, player.grounded ? 70 : 62);
    ctx.stroke();
    ctx.fillStyle = "#6b4328";
    roundedRect(ctx, -17 + run * 3, 66, 17, 10, 5);
    ctx.fill();
    roundedRect(ctx, 1 - run * 3, 66, 17, 10, 5);
    ctx.fill();
    ctx.fillStyle = player.hurt > 0 ? "#ed6767" : "#1497a8";
    roundedRect(ctx, -17, 25, 34, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#ffd04e";
    ctx.font = "900 15px system-ui";
    ctx.fillText("★", -8, 48);
    ctx.fillStyle = "#d9473f";
    ctx.beginPath();
    ctx.moveTo(-16, 28);
    ctx.lineTo(-34, 35 + run * 3);
    ctx.lineTo(-18, 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e1a33c";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-16, 31);
    ctx.lineTo(-24, 44 - run * 4);
    ctx.moveTo(16, 31);
    ctx.lineTo(23, 42 + run * 4);
    ctx.stroke();
    ctx.fillStyle = "#e6a845";
    ctx.beginPath();
    ctx.arc(-25, 45 - run * 4, 5, 0, Math.PI * 2);
    ctx.arc(24, 43 + run * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4b98d";
    ctx.beginPath();
    ctx.ellipse(0, 16, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5b2d17";
    ctx.beginPath();
    ctx.moveTo(-15, 11);
    ctx.lineTo(-18, -3);
    ctx.lineTo(-9, 2);
    ctx.lineTo(-5, -9);
    ctx.lineTo(1, 1);
    ctx.lineTo(10, -7);
    ctx.lineTo(16, 9);
    ctx.quadraticCurveTo(0, 0, -15, 11);
    ctx.fill();
    ctx.fillStyle = "#24242b";
    ctx.beginPath();
    ctx.arc(-5, 16, 2, 0, Math.PI * 2);
    ctx.arc(6, 16, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9b4933";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1, 21, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.restore();

    if (player.abilities.shield) {
      ctx.strokeStyle = "rgba(102,224,255,.85)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x + player.width / 2, y + player.height / 2, 35 + Math.sin(elapsed * 5) * 2, 48, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (player.abilities.star > 0) {
      ctx.strokeStyle = `hsla(${(elapsed * 180) % 360}, 95%, 70%, .9)`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(x + player.width / 2, y + player.height / 2, 39, 52, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (random() < 0.55) particles.push(makeParticle(x + random() * player.width, y + random() * player.height, `hsl(${random() * 360} 90% 70%)`, 0.45, (random() - 0.5) * 60, -80, 4));
    }
  }

  function drawEffects() {
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life * 2, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const entry of floaters) {
      ctx.globalAlpha = clamp(entry.life * 1.8, 0, 1);
      ctx.fillStyle = entry.color;
      ctx.font = "900 16px system-ui";
      ctx.fillText(entry.text, entry.x - entry.text.length * 4, entry.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawAtmosphere() {
    ctx.fillStyle = "rgba(237,248,224,.055)";
    for (let index = 0; index < 5; index += 1) {
      const x = ((index * 287 + elapsed * 5 - cameraX * 0.08) % (canvas.width + 260)) - 130;
      ctx.beginPath();
      ctx.ellipse(x, 150 + index * 77, 150, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(15,24,31,.76)";
    roundedRect(ctx, 18, 18, 222, 38, 8);
    ctx.fill();
    ctx.fillStyle = "#ffe487";
    ctx.font = "850 15px system-ui";
    ctx.fillText(`第 ${campaignLevel} 关 · 星辉山谷  ${formatTime(elapsed)}`, 31, 42);
  }

  function drawToast() {
    if (toast.timer <= 0) return;
    const alpha = clamp(Math.min(toast.timer, 0.6) / 0.6, 0, 1);
    const width = 390;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(17,24,37,.9)";
    roundedRect(ctx, canvas.width / 2 - width / 2, 74, width, 72, 16);
    ctx.fill();
    ctx.strokeStyle = toast.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = toast.color;
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(toast.text, canvas.width / 2, 103);
    ctx.fillStyle = "#edf2f5";
    ctx.font = "700 13px system-ui";
    ctx.fillText(toast.subtext, canvas.width / 2, 128);
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }

  function drawBossHud() {
    if (!boss.active || bossDefeated || !boss.alive) return;
    const width = 420;
    const x = canvas.width / 2 - width / 2;
    ctx.fillStyle = "rgba(20,17,30,.88)";
    roundedRect(ctx, x, 660, width, 42, 14);
    ctx.fill();
    ctx.fillStyle = "#f0e9ff";
    ctx.font = "850 13px system-ui";
    ctx.fillText("雷霆巨兽", x + 15, 678);
    ctx.fillStyle = "#3c314c";
    roundedRect(ctx, x + 105, 670, 295, 13, 6);
    ctx.fill();
    ctx.fillStyle = "#e66bad";
    roundedRect(ctx, x + 105, 670, 295 * (boss.hp / boss.maxHp), 13, 6);
    ctx.fill();
  }

  function showToast(text, subtext, color = "#ffe272", duration = 2) {
    toast = { text, subtext, color, timer: duration };
  }

  function makeParticle(x, y, color, life, vx, vy, radius) {
    return { x, y, color, life, vx, vy, radius };
  }

  function burst(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 45 + random() * 175;
      particles.push(makeParticle(x, y, color, 0.35 + random() * 0.55, Math.cos(angle) * speed, Math.sin(angle) * speed - 45, 2 + random() * 3.5));
    }
  }

  function dust(x, y, count) {
    for (let index = 0; index < count; index += 1) particles.push(makeParticle(x + (random() - 0.5) * 28, y, "#d8cfad", 0.32, (random() - 0.5) * 80, -40 - random() * 40, 3 + random() * 3));
  }

  function floater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 0.9 });
  }

  function updateEffects(delta) {
    for (const particle of particles) {
      particle.life -= delta;
      particle.vy += 250 * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }
    particles = particles.filter((entry) => entry.life > 0);
    for (const entry of floaters) {
      entry.life -= delta;
      entry.y -= 36 * delta;
    }
    floaters = floaters.filter((entry) => entry.life > 0);
  }

  function playTone(frequency, duration) {
    if (!getSettings().soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.032, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
      oscillator.addEventListener("ended", () => audio.close());
    } catch {
      // Sound feedback is best effort.
    }
  }

  function playSequence(frequencies, duration) {
    frequencies.forEach((frequency, index) => setTimeout(() => playTone(frequency, duration), index * duration * 720));
  }

  function updateSoundButton() {
    soundButton.textContent = getSettings().soundEnabled ? "♪" : "♪̸";
  }

  function postRecordUpdate() {
    try {
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
    } catch {
      // Standalone play does not need parent messaging.
    }
  }

  function returnToLobby() {
    if (!roundRecorded && currentScore() > 0) recordRound(false);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "credius:close-game" }, "*");
      postRecordUpdate();
      return;
    }
    window.location.href = "../../index.html";
  }

  function visible(x, width) {
    return x + width >= cameraX - 90 && x <= cameraX + canvas.width + 90;
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      keys.left = true;
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      keys.right = true;
    } else if (key === " " || key === "arrowup" || key === "w") {
      event.preventDefault();
      jump();
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") keys.left = false;
    if (key === "arrowright" || key === "d") keys.right = false;
  });

  controlButtons.forEach((controlButton) => {
    controlButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const control = controlButton instanceof HTMLElement ? controlButton.dataset.control : "";
      if (control === "left") keys.left = true;
      if (control === "right") keys.right = true;
      if (control === "jump") jump();
      if (controlButton instanceof HTMLElement && controlButton.setPointerCapture && "pointerId" in event) controlButton.setPointerCapture(event.pointerId);
    });
    const release = () => {
      const control = controlButton instanceof HTMLElement ? controlButton.dataset.control : "";
      if (control === "left") keys.left = false;
      if (control === "right") keys.right = false;
    };
    controlButton.addEventListener("pointerup", release);
    controlButton.addEventListener("pointercancel", release);
    controlButton.addEventListener("pointerleave", release);
  });

  pauseButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", newGame);
  statusButton.addEventListener("click", handleStatusAction);
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  soundButton.addEventListener("click", () => {
    const settings = getSettings();
    updateSettings({ soundEnabled: !settings.soundEnabled });
    updateSoundButton();
  });
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的《王子历险记》第 ${campaignLevel} 关获得 ${formatScore(currentScore())} 分，收集金币 ${collected} 枚、太阳金币 ${bigCollected}/3，用时 ${formatTime(elapsed)}。`;
  });

  newGame();
  requestAnimationFrame(loop);
})();
