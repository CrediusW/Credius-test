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

  const gameId = "tank-battle";
  const campaignLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(gameId);
  const canvas = document.getElementById("battlefield");
  const ctx = canvas.getContext("2d");
  const backLobby = document.getElementById("backLobby");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const enemyCountEl = document.getElementById("enemyCount");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const pauseButton = document.getElementById("pauseGame");
  const newGameButton = document.getElementById("newGame");
  const soundButton = document.getElementById("soundGame");
  const statusPanel = document.getElementById("statusPanel");
  const statusKicker = document.getElementById("statusKicker");
  const statusTitle = document.getElementById("statusTitle");
  const statusButton = document.getElementById("statusButton");
  const settlementPanel = document.getElementById("settlementPanel");
  const settlementKicker = document.getElementById("settlementKicker");
  const settlementTitle = document.getElementById("settlementTitle");
  const finalScore = document.getElementById("finalScore");
  const finalBest = document.getElementById("finalBest");
  const playAgain = document.getElementById("playAgain");
  const shareResult = document.getElementById("shareResult");
  const settlementLobby = document.getElementById("settlementLobby");
  const shareOutput = document.getElementById("shareOutput");
  const controlButtons = Array.from(document.querySelectorAll("[data-control]"));

  const cols = 18;
  const rows = 18;
  const tile = 32;
  const width = cols * tile;
  const height = rows * tile;
  const tankSize = 28;
  const playerMaxHp = 5;
  const enemyMaxHp = 3;
  const empty = 0;
  const brick = 1;
  const steel = 2;
  const water = 3;
  const directions = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  const movementKeys = {
    arrowup: "up",
    w: "up",
    arrowright: "right",
    d: "right",
    arrowdown: "down",
    s: "down",
    arrowleft: "left",
    a: "left",
  };
  const spawnPoints = [
    { col: 1, row: 1 },
    { col: 8, row: 1 },
    { col: 15, row: 1 },
  ];

  let state = null;
  let lastFrame = performance.now();
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  const heldDirections = [];
  const pressedControls = new Set();

  function createState() {
    return {
      phase: "playing",
      level: 1,
      score: 0,
      best: getGameRecord(gameId).highScore,
      player: createPlayer(),
      enemies: [],
      bullets: [],
      particles: [],
      map: [],
      enemiesRemaining: 0,
      spawnTimer: 0,
      nextEnemyId: 1,
      levelSeed: 1,
    };
  }

  function saveBestScore() {
    if (state.score > state.best) {
      state.best = state.score;
    }
  }

  function createPlayer() {
    return {
      id: "player",
      kind: "player",
      x: tile * 8 + 2,
      y: tile * 15 + 2,
      size: tankSize,
      dir: "up",
      speed: 142,
      cooldown: 0,
      invincible: 1.6,
      maxHp: playerMaxHp,
      hp: playerMaxHp,
      hitFlash: 0,
    };
  }

  function newGame() {
    state = createState();
    roundStartedAt = Date.now();
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    hideSettlement();
    updateSoundButton();
    startLevel(campaignLevel);
    canvas.focus();
  }

  function startLevel(levelNumber) {
    state.phase = "playing";
    state.level = levelNumber;
    state.player = createPlayer();
    state.player.invincible = levelNumber === 1 ? 1.6 : 1.2;
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.map = buildMap(levelNumber);
    state.enemiesRemaining = 7 + levelNumber * 2;
    state.spawnTimer = 0.2;
    state.nextEnemyId = 1;
    state.levelSeed = levelNumber * 97;
    hideStatus();
    updateHud();
  }

  function buildMap(levelNumber) {
    const map = Array.from({ length: rows }, () => Array(cols).fill(empty));

    placeRows(map, brick, [
      [3, 3, 4],
      [14, 3, 4],
      [6, 5, 3],
      [11, 5, 3],
      [3, 10, 4],
      [14, 10, 4],
      [6, 12, 3],
      [11, 12, 3],
    ]);
    placeRows(map, steel, [
      [8, 7, 2],
      [8, 8, 2],
      [5, 9, 1],
      [12, 9, 1],
    ]);
    placeRows(map, water, [
      [4, 13, 2],
      [12, 13, 2],
      [7, 3, 1],
      [10, 3, 1],
    ]);

    if (levelNumber % 2 === 0) {
      placeRows(map, steel, [
        [1, 8, 2],
        [15, 8, 2],
      ]);
      placeRows(map, brick, [
        [7, 10, 4],
        [7, 11, 4],
      ]);
    } else {
      placeRows(map, brick, [
        [1, 6, 2],
        [15, 6, 2],
        [8, 10, 2],
      ]);
    }

    for (let row = 2; row < 14; row += 1) {
      for (let col = 1; col < 17; col += 1) {
        const inLane = col >= 7 && col <= 10;
        const protectedSpot = isProtectedSpawn(col, row) || isBaseZone(col, row);
        const pattern = (col * 19 + row * 11 + levelNumber * 7) % 31;

        if (!map[row][col] && !inLane && !protectedSpot && pattern === 0) {
          map[row][col] = brick;
        }
      }
    }

    protectBase(map);
    clearSpawnZones(map);
    return map;
  }

  function placeRows(map, type, blocks) {
    blocks.forEach(([col, row, length]) => {
      for (let offset = 0; offset < length; offset += 1) {
        if (row >= 0 && row < rows && col + offset >= 0 && col + offset < cols) {
          map[row][col + offset] = type;
        }
      }
    });
  }

  function protectBase(map) {
    for (let col = 7; col <= 10; col += 1) {
      map[15][col] = brick;
    }

    for (let row = 16; row <= 17; row += 1) {
      map[row][7] = brick;
      map[row][10] = brick;
    }

    map[16][8] = empty;
    map[16][9] = empty;
    map[17][8] = empty;
    map[17][9] = empty;
  }

  function clearSpawnZones(map) {
    spawnPoints.forEach((point) => {
      for (let row = point.row - 1; row <= point.row + 1; row += 1) {
        for (let col = point.col - 1; col <= point.col + 1; col += 1) {
          if (row >= 0 && row < rows && col >= 0 && col < cols) {
            map[row][col] = empty;
          }
        }
      }
    });

    for (let row = 14; row < 18; row += 1) {
      for (let col = 8; col <= 9; col += 1) {
        map[row][col] = empty;
      }
    }
  }

  function isProtectedSpawn(col, row) {
    return spawnPoints.some(
      (point) => Math.abs(point.col - col) <= 1 && Math.abs(point.row - row) <= 1,
    );
  }

  function isBaseZone(col, row) {
    return col >= 7 && col <= 10 && row >= 15;
  }

  function baseRect() {
    return {
      x: tile * 8,
      y: tile * 16,
      width: tile * 2,
      height: tile * 2,
    };
  }

  function update(delta) {
    updatePlayer(delta);
    updateEnemies(delta);
    updateBullets(delta);
    updateParticles(delta);
    spawnEnemies(delta);
    checkLevelClear();
    updateHud();
  }

  function updatePlayer(delta) {
    const player = state.player;
    player.cooldown = Math.max(0, player.cooldown - delta);
    player.invincible = Math.max(0, player.invincible - delta);
    player.hitFlash = Math.max(0, player.hitFlash - delta);

    const directionName = currentDirection();
    if (directionName) {
      player.dir = directionName;
      const direction = directions[directionName];
      tryMove(player, direction.x * player.speed * delta, direction.y * player.speed * delta);
    }

    if (pressedControls.has("fire")) {
      fire(player);
    }
  }

  function currentDirection() {
    for (let index = heldDirections.length - 1; index >= 0; index -= 1) {
      if (heldDirections[index]) {
        return heldDirections[index];
      }
    }

    return null;
  }

  function tryMove(tank, dx, dy) {
    if (!dx && !dy) {
      return true;
    }

    const candidate = {
      x: tank.x + dx,
      y: tank.y + dy,
      width: tank.size,
      height: tank.size,
    };

    if (!isAreaClear(candidate, tank)) {
      return false;
    }

    tank.x = clamp(candidate.x, 0, width - tank.size);
    tank.y = clamp(candidate.y, 0, height - tank.size);
    return true;
  }

  function isAreaClear(area, movingTank) {
    if (area.x < 0 || area.y < 0 || area.x + area.width > width || area.y + area.height > height) {
      return false;
    }

    if (collidesWithMap(area) || intersects(area, baseRect())) {
      return false;
    }

    const tanks = [state.player, ...state.enemies].filter((tank) => tank !== movingTank);
    return !tanks.some((tank) =>
      intersects(area, {
        x: tank.x,
        y: tank.y,
        width: tank.size,
        height: tank.size,
      }),
    );
  }

  function collidesWithMap(area) {
    const startCol = Math.floor(area.x / tile);
    const endCol = Math.floor((area.x + area.width - 1) / tile);
    const startRow = Math.floor(area.y / tile);
    const endRow = Math.floor((area.y + area.height - 1) / tile);

    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
          return true;
        }

        const terrain = state.map[row][col];
        if (terrain === brick || terrain === steel || terrain === water) {
          return true;
        }
      }
    }

    return false;
  }

  function updateEnemies(delta) {
    state.enemies.forEach((enemy) => {
      enemy.cooldown = Math.max(0, enemy.cooldown - delta);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      enemy.turnTimer -= delta;

      if (enemy.turnTimer <= 0) {
        enemy.dir = chooseEnemyDirection(enemy);
        enemy.turnTimer = 0.55 + seededRandom(enemy.id + state.levelSeed) * 0.95;
      }

      const direction = directions[enemy.dir];
      const moved = tryMove(enemy, direction.x * enemy.speed * delta, direction.y * enemy.speed * delta);

      if (!moved) {
        enemy.dir = chooseEnemyDirection(enemy, true);
        enemy.turnTimer = 0.25;
      }

      if (enemy.cooldown <= 0 && shouldEnemyFire(enemy)) {
        fire(enemy);
      }
    });
  }

  function chooseEnemyDirection(enemy, avoidCurrent = false) {
    const choices = Object.keys(directions).filter((name) => !avoidCurrent || name !== enemy.dir);
    const target = enemyTarget(enemy);

    choices.sort((a, b) => {
      const dirA = directions[a];
      const dirB = directions[b];
      const distA = distanceToTarget(enemy.x + dirA.x * tile, enemy.y + dirA.y * tile, target);
      const distB = distanceToTarget(enemy.x + dirB.x * tile, enemy.y + dirB.y * tile, target);
      return distA - distB;
    });

    if (Math.random() < 0.56) {
      return choices[0];
    }

    return choices[Math.floor(Math.random() * choices.length)];
  }

  function enemyTarget(enemy) {
    const playerCenter = centerOf(state.player);
    const baseCenter = {
      x: baseRect().x + baseRect().width / 2,
      y: baseRect().y + baseRect().height / 2,
    };

    return enemy.id % 3 === 0 ? playerCenter : baseCenter;
  }

  function distanceToTarget(x, y, target) {
    return Math.abs(x - target.x) + Math.abs(y - target.y);
  }

  function shouldEnemyFire(enemy) {
    if (isAligned(enemy, state.player)) {
      aimAt(enemy, centerOf(state.player));
      return true;
    }

    const base = baseRect();
    if (isAligned(enemy, base)) {
      aimAt(enemy, {
        x: base.x + base.width / 2,
        y: base.y + base.height / 2,
      });
      return true;
    }

    return Math.random() < 0.018;
  }

  function isAligned(tank, target) {
    const tankCenter = centerOf(tank);
    const targetCenter = "width" in target ? {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2,
    } : centerOf(target);
    const sameColumn = Math.abs(tankCenter.x - targetCenter.x) < tile * 0.45;
    const sameRow = Math.abs(tankCenter.y - targetCenter.y) < tile * 0.45;
    return sameColumn || sameRow;
  }

  function aimAt(tank, target) {
    const tankCenter = centerOf(tank);
    const xGap = target.x - tankCenter.x;
    const yGap = target.y - tankCenter.y;

    if (Math.abs(xGap) > Math.abs(yGap)) {
      tank.dir = xGap > 0 ? "right" : "left";
    } else {
      tank.dir = yGap > 0 ? "down" : "up";
    }
  }

  function fire(tank) {
    if (tank.cooldown > 0) {
      return;
    }

    const direction = directions[tank.dir];
    const center = centerOf(tank);
    const bulletSize = tank.kind === "player" ? 7 : 6;
    const bullet = {
      owner: tank.kind,
      x: center.x + direction.x * 16 - bulletSize / 2,
      y: center.y + direction.y * 16 - bulletSize / 2,
      width: bulletSize,
      height: bulletSize,
      dir: tank.dir,
      speed: tank.kind === "player" ? 355 : 265,
      ttl: 1.8,
    };

    state.bullets.push(bullet);
    tank.cooldown = tank.kind === "player" ? 0.28 : 0.95 + Math.random() * 0.5;
  }

  function updateBullets(delta) {
    const bulletsToRemove = new Set();

    state.bullets.forEach((bullet, index) => {
      const direction = directions[bullet.dir];
      bullet.x += direction.x * bullet.speed * delta;
      bullet.y += direction.y * bullet.speed * delta;
      bullet.ttl -= delta;

      if (
        bullet.ttl <= 0 ||
        bullet.x + bullet.width < 0 ||
        bullet.y + bullet.height < 0 ||
        bullet.x > width ||
        bullet.y > height
      ) {
        bulletsToRemove.add(index);
        return;
      }

      if (hitTerrain(bullet)) {
        bulletsToRemove.add(index);
        return;
      }

      if (intersects(bullet, baseRect())) {
        bulletsToRemove.add(index);
        destroyBase();
        return;
      }

      if (bullet.owner === "player") {
        const enemy = state.enemies.find((item) => intersects(bullet, rectFor(item)));
        if (enemy) {
          bulletsToRemove.add(index);
          hitEnemy(enemy);
        }
      } else if (state.player.invincible <= 0 && intersects(bullet, rectFor(state.player))) {
        bulletsToRemove.add(index);
        hitPlayer();
      }
    });

    for (let i = 0; i < state.bullets.length; i += 1) {
      for (let j = i + 1; j < state.bullets.length; j += 1) {
        if (!bulletsToRemove.has(i) && !bulletsToRemove.has(j) && intersects(state.bullets[i], state.bullets[j])) {
          bulletsToRemove.add(i);
          bulletsToRemove.add(j);
          burst(state.bullets[i].x, state.bullets[i].y, "#ffd166", 5);
        }
      }
    }

    state.bullets = state.bullets.filter((_, index) => !bulletsToRemove.has(index));
  }

  function hitTerrain(bullet) {
    const centerX = bullet.x + bullet.width / 2;
    const centerY = bullet.y + bullet.height / 2;
    const col = Math.floor(centerX / tile);
    const row = Math.floor(centerY / tile);

    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      return true;
    }

    const terrain = state.map[row][col];
    if (!terrain || terrain === water) {
      return false;
    }

    if (terrain === brick) {
      state.map[row][col] = empty;
      burst(col * tile + tile / 2, row * tile + tile / 2, "#c86f3a", 10);
    } else {
      burst(centerX, centerY, "#b9c5c2", 6);
    }

    return true;
  }

  function hitEnemy(enemy) {
    enemy.hp -= 1;
    enemy.hitFlash = 0.16;

    if (enemy.hp <= 0) {
      destroyEnemy(enemy);
      return;
    }

    burst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#ffcf70", 8);
  }

  function destroyEnemy(enemy) {
    state.enemies = state.enemies.filter((item) => item !== enemy);
    state.score += enemy.heavy ? 180 : 100;
    saveBestScore();
    burst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.heavy ? "#ffd166" : "#ef476f", 18);
  }

  function hitPlayer() {
    state.player.hp -= 1;
    state.player.hitFlash = 0.18;
    state.player.invincible = 0.72;
    burst(state.player.x + state.player.size / 2, state.player.y + state.player.size / 2, "#66d9c8", 14);

    if (state.player.hp <= 0) {
      burst(state.player.x + state.player.size / 2, state.player.y + state.player.size / 2, "#2ec4b6", 24);
      endGame("战车损毁");
    }
  }

  function destroyBase() {
    burst(baseRect().x + tile, baseRect().y + tile, "#ffd166", 28);
    endGame("基地失守");
  }

  function endGame(reason) {
    state.phase = "game-over";
    saveBestScore();
    showSettlement(reason);
    pauseButton.textContent = "暂停";
  }

  function spawnEnemies(delta) {
    if (state.enemiesRemaining <= 0 || state.enemies.length >= 4) {
      return;
    }

    state.spawnTimer -= delta;
    if (state.spawnTimer > 0) {
      return;
    }

    const point = spawnPoints[(state.nextEnemyId - 1) % spawnPoints.length];
    const enemy = createEnemy(point, state.nextEnemyId);
    const occupied = [state.player, ...state.enemies].some((tank) =>
      intersects(rectFor(enemy), rectFor(tank)),
    );

    if (!occupied) {
      state.enemies.push(enemy);
      state.enemiesRemaining -= 1;
      state.nextEnemyId += 1;
      burst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#bde0fe", 8);
    }

    state.spawnTimer = 1.35;
  }

  function createEnemy(point, id) {
    const heavy = state.level >= 3 && id % 4 === 0;
    return {
      id,
      kind: "enemy",
      heavy,
      x: point.col * tile + 2,
      y: point.row * tile + 2,
      size: tankSize,
      dir: "down",
      speed: heavy ? 58 + state.level * 2 : 76 + state.level * 3,
      cooldown: 0.65 + Math.random() * 0.65,
      turnTimer: 0.35,
      maxHp: enemyMaxHp,
      hp: enemyMaxHp,
      hitFlash: 0,
    };
  }

  function checkLevelClear() {
    if (state.enemiesRemaining === 0 && state.enemies.length === 0 && state.phase === "playing") {
      state.phase = "level-clear";
      state.score += 300 + state.level * 100;
      saveBestScore();
      showStatus("清场", `第 ${state.level} 关`, "下一关");
    }
  }

  function updateParticles(delta) {
    state.particles.forEach((particle) => {
      particle.life -= delta;
      particle.x += particle.dx * delta;
      particle.y += particle.dy * delta;
      particle.radius += particle.growth * delta;
    });

    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 110;
      state.particles.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        growth: 14 + Math.random() * 16,
        color,
        life: 0.32 + Math.random() * 0.36,
        maxLife: 0.68,
      });
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    drawField();
    drawTerrain();
    drawBase();
    state.enemies.forEach(drawTank);
    drawTank(state.player);
    state.bullets.forEach(drawBullet);
    drawParticles();
  }

  function drawField() {
    const ground = ctx.createLinearGradient(0, 0, width, height);
    ground.addColorStop(0, "#1d2924");
    ground.addColorStop(0.48, "#283a31");
    ground.addColorStop(1, "#16211d");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * tile;
        const y = row * tile;
        const shade = (row * 11 + col * 17) % 5 === 0 ? "rgba(255, 255, 255, 0.018)" : "rgba(0, 0, 0, 0.035)";
        ctx.fillStyle = shade;
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);

        if ((row * 7 + col * 13) % 9 === 0) {
          ctx.fillStyle = "rgba(206, 214, 187, 0.12)";
          ctx.fillRect(x + 7, y + 10, 2, 2);
          ctx.fillRect(x + 20, y + 22, 3, 1);
        }
      }
    }

    ctx.strokeStyle = "rgba(234, 241, 223, 0.045)";
    ctx.lineWidth = 1;

    for (let line = tile; line < width; line += tile) {
      ctx.beginPath();
      ctx.moveTo(line + 0.5, 0);
      ctx.lineTo(line + 0.5, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, line + 0.5);
      ctx.lineTo(width, line + 0.5);
      ctx.stroke();
    }

    const edgeShade = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.72);
    edgeShade.addColorStop(0, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(1, "rgba(0, 0, 0, 0.18)");
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTerrain() {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const terrain = state.map[row][col];
        if (!terrain) {
          continue;
        }

        const x = col * tile;
        const y = row * tile;
        if (terrain === brick) {
          drawBrick(x, y);
        } else if (terrain === steel) {
          drawSteel(x, y);
        } else if (terrain === water) {
          drawWater(x, y);
        }
      }
    }
  }

  function drawBrick(x, y) {
    const mortar = "#643724";
    const brickFace = ctx.createLinearGradient(x, y, x, y + tile);
    brickFace.addColorStop(0, "#d98a4e");
    brickFace.addColorStop(1, "#9c4e30");

    ctx.fillStyle = mortar;
    fillRoundedRect(x + 1, y + 1, tile - 2, tile - 2, 3);
    ctx.fillStyle = brickFace;

    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const offset = row % 2 === 0 ? 0 : 8;
        fillRoundedRect(x + 3 + col * 16 + offset, y + 3 + row * 7, 11, 5, 1.5);
      }
    }

    ctx.fillStyle = "rgba(255, 232, 179, 0.18)";
    ctx.fillRect(x + 3, y + 3, tile - 6, 2);
  }

  function drawSteel(x, y) {
    const plate = ctx.createLinearGradient(x, y, x + tile, y + tile);
    plate.addColorStop(0, "#aeb9b5");
    plate.addColorStop(0.5, "#6e7c78");
    plate.addColorStop(1, "#3f4b49");
    ctx.fillStyle = plate;
    fillRoundedRect(x + 1, y + 1, tile - 2, tile - 2, 4);

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(x + 5, y + 5, 21, 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(x + 6, y + 25, 20, 2);

    ctx.fillStyle = "#d8e0dc";
    fillRoundedRect(x + 6, y + 7, 8, 8, 2);
    fillRoundedRect(x + 18, y + 18, 8, 8, 2);
    ctx.fillStyle = "#4c5956";
    fillRoundedRect(x + 18, y + 7, 8, 8, 2);
    fillRoundedRect(x + 6, y + 18, 8, 8, 2);
  }

  function drawWater(x, y) {
    const waterGradient = ctx.createLinearGradient(x, y, x, y + tile);
    waterGradient.addColorStop(0, "#1d8fb8");
    waterGradient.addColorStop(1, "#0a577b");
    ctx.fillStyle = waterGradient;
    fillRoundedRect(x + 1, y + 1, tile - 2, tile - 2, 4);

    const waveOffset = Math.sin(performance.now() / 360 + x * 0.08 + y * 0.05) * 2;
    ctx.strokeStyle = "rgba(236, 252, 255, 0.58)";
    ctx.lineWidth = 2;

    for (let wave = 0; wave < 3; wave += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 9 + wave * 7 + waveOffset);
      ctx.quadraticCurveTo(x + 11, y + 5 + wave * 7 - waveOffset, x + 18, y + 9 + wave * 7 + waveOffset);
      ctx.quadraticCurveTo(x + 24, y + 13 + wave * 7 - waveOffset, x + 29, y + 9 + wave * 7 + waveOffset);
      ctx.stroke();
    }
  }

  function drawBase() {
    const base = baseRect();
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    fillRoundedRect(base.x + 5, base.y + 12, base.width - 10, base.height - 12, 5);
    ctx.fillStyle = "#f0c45a";
    fillRoundedRect(base.x + 6, base.y + 8, base.width - 12, base.height - 14, 4);
    ctx.fillStyle = "#fff4cb";
    fillRoundedRect(base.x + 20, base.y + 18, 24, 12, 2);
    ctx.fillStyle = "#203027";
    ctx.beginPath();
    ctx.moveTo(base.x + 32, base.y + 13);
    ctx.lineTo(base.x + 46, base.y + 42);
    ctx.lineTo(base.x + 18, base.y + 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e95852";
    fillRoundedRect(base.x + 29, base.y + 28, 6, 20, 2);
  }

  function drawTank(tank) {
    const center = centerOf(tank);
    const isPlayer = tank.kind === "player";
    const palette = isPlayer
      ? {
          track: "#16221d",
          tread: "#314236",
          body: "#526f3e",
          bodyDark: "#203321",
          bodyLight: "#a9c27b",
          turret: "#66814b",
          barrel: "#15231d",
          mark: "#efe4aa",
        }
      : tank.heavy
        ? {
            track: "#1f1f1d",
            tread: "#514937",
            skirt: "#5c4a2e",
            body: "#d8a64a",
            bodyDark: "#5d3d1f",
            bodyLight: "#ffdea1",
            turret: "#c29144",
            barrel: "#24211c",
            mark: "#432414",
          }
        : {
            track: "#20211f",
            tread: "#59523f",
            skirt: "#6c6045",
            body: "#c49a5d",
            bodyDark: "#5a4329",
            bodyLight: "#f2d7a3",
            turret: "#d0aa70",
            barrel: "#27231f",
            mark: "#2b2218",
          };

    drawTankShadow(center.x, center.y, tank.size);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotationFor(tank.dir));

    if (tank.kind === "player" && tank.invincible > 0 && Math.floor(tank.invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    if (tank.hitFlash > 0) {
      ctx.shadowColor = "#fff0b0";
      ctx.shadowBlur = 13;
    }

    if (isPlayer) {
      drawPlayerTank(palette);
    } else {
      drawEnemyTank(palette);
    }

    if (tank.hitFlash > 0) {
      drawTankHitFlash();
    }

    ctx.restore();
    drawHealthBar(tank);
  }

  function drawTankShadow(x, y, size) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#050807";
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.35, size * 0.55, size * 0.23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayerTank(palette) {
    ctx.fillStyle = palette.track;
    fillRoundedRect(-14, -14, 7, 28, 3);
    fillRoundedRect(7, -14, 7, 28, 3);
    drawTrackTreads(-13, -12, 5, 24, palette.tread);
    drawTrackTreads(8, -12, 5, 24, palette.tread);

    ctx.fillStyle = palette.bodyDark;
    fillRoundedRect(-10, -12, 20, 25, 3);
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.moveTo(-8, -14);
    ctx.lineTo(8, -14);
    ctx.lineTo(11, 7);
    ctx.lineTo(7, 13);
    ctx.lineTo(-7, 13);
    ctx.lineTo(-11, 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(-5, -11, 10, 3);
    ctx.fillStyle = palette.bodyDark;
    fillRoundedRect(-6, 7, 12, 4, 1.5);

    ctx.fillStyle = palette.barrel;
    fillRoundedRect(-2, -27, 4, 19, 2);
    fillRoundedRect(-3, -29, 6, 4, 2);

    ctx.fillStyle = palette.turret;
    ctx.beginPath();
    ctx.ellipse(0, -3, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.bodyDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = palette.bodyLight;
    ctx.beginPath();
    ctx.arc(-3, -5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.mark;
    fillRoundedRect(3, 1, 4, 2, 1);
  }

  function drawEnemyTank(palette) {
    ctx.fillStyle = palette.track;
    fillRoundedRect(-14, -14, 7, 28, 2.5);
    fillRoundedRect(7, -14, 7, 28, 2.5);
    drawTrackTreads(-13, -12, 5, 24, palette.tread);
    drawTrackTreads(8, -12, 5, 24, palette.tread);

    ctx.fillStyle = palette.skirt;
    fillRoundedRect(-12, -12, 24, 25, 2.5);
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.moveTo(-11, -13);
    ctx.lineTo(11, -13);
    ctx.lineTo(13, 8);
    ctx.lineTo(9, 13);
    ctx.lineTo(-9, 13);
    ctx.lineTo(-13, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(-7, -10, 14, 3);
    ctx.fillStyle = palette.bodyDark;
    fillRoundedRect(-8, 7, 16, 4, 1.5);
    fillRoundedRect(-10, 11, 20, 2, 1);

    ctx.fillStyle = palette.barrel;
    fillRoundedRect(-2.5, -30, 5, 22, 2);
    fillRoundedRect(-3.5, -32, 7, 4, 1.5);

    ctx.fillStyle = palette.turret;
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(8, -12);
    ctx.lineTo(12, -6);
    ctx.lineTo(13, 4);
    ctx.lineTo(9, 10);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-13, 4);
    ctx.lineTo(-12, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.bodyDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = palette.bodyLight;
    fillRoundedRect(-5, -8, 5, 3, 1);
    ctx.fillStyle = palette.mark;
    fillRoundedRect(4, -4, 4, 4, 1);
  }

  function drawTrackTreads(x, y, treadWidth, treadHeight, color) {
    ctx.fillStyle = color;
    for (let offset = 0; offset < treadHeight; offset += 5) {
      fillRoundedRect(x, y + offset, treadWidth, 3, 1);
    }
  }

  function drawTankHitFlash() {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "#fff4c2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHealthBar(tank) {
    const maxHp = Math.max(1, tank.maxHp);
    const hp = clamp(tank.hp, 0, maxHp);
    const barWidth = tank.kind === "player" ? 36 : 31;
    const barHeight = 5;
    const segmentGap = 2;
    const segmentWidth = (barWidth - segmentGap * (maxHp - 1)) / maxHp;
    const x = clamp(tank.x + tank.size / 2 - barWidth / 2, 3, width - barWidth - 3);
    const y = clamp(tank.y - 9, 3, height - barHeight - 3);
    const fillColor = tank.kind === "player" ? "#66d9c8" : "#f1b75b";

    ctx.save();
    ctx.fillStyle = "rgba(5, 8, 7, 0.82)";
    fillRoundedRect(x - 2, y - 2, barWidth + 4, barHeight + 4, 4);

    for (let index = 0; index < maxHp; index += 1) {
      const segmentX = x + index * (segmentWidth + segmentGap);
      ctx.fillStyle = index < hp ? fillColor : "rgba(255, 255, 255, 0.16)";
      fillRoundedRect(segmentX, y, segmentWidth, barHeight, 2);
    }

    ctx.restore();
  }

  function drawBullet(bullet) {
    ctx.fillStyle = bullet.owner === "player" ? "#ffd166" : "#f4f6f1";
    ctx.beginPath();
    ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2);
    ctx.fill();
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
  }

  function fillRoundedRect(x, y, rectWidth, rectHeight, radius) {
    const safeRadius = Math.min(radius, rectWidth / 2, rectHeight / 2);

    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + rectWidth - safeRadius, y);
    ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + safeRadius);
    ctx.lineTo(x + rectWidth, y + rectHeight - safeRadius);
    ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - safeRadius, y + rectHeight);
    ctx.lineTo(x + safeRadius, y + rectHeight);
    ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
    ctx.fill();
  }

  function rotationFor(directionName) {
    if (directionName === "right") {
      return Math.PI / 2;
    }

    if (directionName === "down") {
      return Math.PI;
    }

    if (directionName === "left") {
      return -Math.PI / 2;
    }

    return 0;
  }

  function updateHud() {
    livesEl.textContent = `${Math.max(0, state.player.hp)}/${state.player.maxHp}`;
    levelEl.textContent = String(state.level);
    enemyCountEl.textContent = String(state.enemiesRemaining + state.enemies.length);
    scoreEl.textContent = formatScore(state.score);
    bestEl.textContent = formatScore(state.best);
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
    if (roundRecorded || !state) {
      return { record: getGameRecord(gameId), newHighScore: false };
    }

    roundRecorded = true;
    return saveGameResult(gameId, {
      score: state.score,
      highestLevel: state.level,
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
    updateHud();

    try {
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
    } catch {
      // Standalone play does not need parent messaging.
    }
  }

  function togglePause() {
    if (state.phase === "playing") {
      state.phase = "paused";
      pauseButton.textContent = "继续";
      showStatus("暂停", "战场待命", "继续");
      return;
    }

    if (state.phase === "paused") {
      resumeGame();
    }
  }

  function resumeGame() {
    state.phase = "playing";
    pauseButton.textContent = "暂停";
    hideStatus();
    canvas.focus();
  }

  function handleStatusAction() {
    if (state.phase === "game-over") {
      newGame();
      return;
    }

    if (state.phase === "level-clear") {
      startLevel(state.level + 1);
      canvas.focus();
      return;
    }

    if (state.phase === "paused") {
      resumeGame();
    }
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    const direction = movementKeys[key];

    if (direction) {
      event.preventDefault();
      addHeldDirection(direction);
      return;
    }

    if (key === " " || key === "j") {
      event.preventDefault();
      pressedControls.add("fire");
      if (state.phase === "playing") {
        fire(state.player);
      }
      return;
    }

    if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    const direction = movementKeys[key];

    if (direction) {
      event.preventDefault();
      removeHeldDirection(direction);
      return;
    }

    if (key === " " || key === "j") {
      event.preventDefault();
      pressedControls.delete("fire");
    }
  }

  function addHeldDirection(direction) {
    const existingIndex = heldDirections.indexOf(direction);
    if (existingIndex >= 0) {
      heldDirections.splice(existingIndex, 1);
    }

    heldDirections.push(direction);
    pressedControls.add(direction);
    syncControlButtons();
  }

  function removeHeldDirection(direction) {
    const existingIndex = heldDirections.indexOf(direction);
    if (existingIndex >= 0) {
      heldDirections.splice(existingIndex, 1);
    }

    pressedControls.delete(direction);
    syncControlButtons();
  }

  function bindTouchControls() {
    controlButtons.forEach((button) => {
      const control = button.dataset.control;

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        pressedControls.add(control);

        if (directions[control]) {
          addHeldDirection(control);
        }

        if (control === "fire" && state.phase === "playing") {
          fire(state.player);
        }

        syncControlButtons();
        canvas.focus();
      });

      ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
        button.addEventListener(eventName, () => {
          pressedControls.delete(control);

          if (directions[control]) {
            removeHeldDirection(control);
          }

          syncControlButtons();
        });
      });
    });
  }

  function syncControlButtons() {
    controlButtons.forEach((button) => {
      button.classList.toggle("active", pressedControls.has(button.dataset.control));
    });
  }

  function loop(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.033);
    lastFrame = now;

    if (state.phase === "playing") {
      update(delta);
    } else {
      updateParticles(delta);
      updateHud();
    }

    render();
    window.requestAnimationFrame(loop);
  }

  function rectFor(tank) {
    return {
      x: tank.x,
      y: tank.y,
      width: tank.size,
      height: tank.size,
    };
  }

  function centerOf(item) {
    return {
      x: item.x + item.size / 2,
      y: item.y + item.size / 2,
    };
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function seededRandom(seed) {
    const x = Math.sin(seed * 999) * 10000;
    return x - Math.floor(x);
  }

  function updateSoundButton() {
    soundButton.textContent = getSettings().soundEnabled ? "♪" : "♪̸";
  }

  function returnToLobby() {
    if (state && state.score > 0 && !roundRecorded) {
      recordRound();
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "credius:close-game" }, "*");
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
      return;
    }
    window.location.href = "../../index.html";
  }

  pauseButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (state && state.score > 0 && state.phase !== "game-over") {
      recordRound();
    }
    newGame();
  });
  statusButton.addEventListener("click", handleStatusAction);
  backLobby.addEventListener("click", returnToLobby);
  settlementLobby.addEventListener("click", returnToLobby);
  playAgain.addEventListener("click", newGame);
  shareResult.addEventListener("click", () => {
    shareOutput.textContent = `我在 CREDIUS ARCADE 的坦克大战拿到 ${formatScore(state.score)} 分，打到第 ${state.level} 关。`;
  });
  soundButton.addEventListener("click", () => {
    updateSettings({ soundEnabled: !getSettings().soundEnabled });
    updateSoundButton();
  });
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state?.phase === "playing") {
      togglePause();
    }
  });
  window.addEventListener("blur", () => {
    heldDirections.length = 0;
    pressedControls.clear();
    syncControlButtons();
  });

  bindTouchControls();
  newGame();
  window.requestAnimationFrame(loop);
})();
