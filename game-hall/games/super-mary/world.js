// @ts-check

(function () {
  "use strict";

  let nextId = 1;
  const id = (prefix) => `${prefix}-${nextId++}`;

  function platform(x, y, width, height = 120, kind = "ground") {
    return { id: id("platform"), x, y, width, height, kind };
  }

  function coin(x, y, type = "normal", secret = false) {
    return { id: id("coin"), x, y, type, secret, taken: false, phase: (x + y) * 0.013, vx: 0, vy: 0 };
  }

  function lineCoins(target, x, y, count, step, rise = 0, secret = false) {
    for (let index = 0; index < count; index += 1) {
      target.push(coin(x + index * step, y + index * rise, "normal", secret));
    }
  }

  function arcCoins(target, x, y, count, width, height) {
    for (let index = 0; index < count; index += 1) {
      const progress = count <= 1 ? 0 : index / (count - 1);
      target.push(coin(x + progress * width, y - Math.sin(progress * Math.PI) * height));
    }
  }

  function buildLevel(level = 1) {
    nextId = 1;
    const worldWidth = 7480;
    const platforms = [
      platform(0, 620, 870, 150),
      platform(980, 605, 720, 165),
      platform(1780, 615, 760, 155),
      platform(2640, 620, 650, 150),
      platform(3380, 610, 900, 160),
      platform(4390, 635, 570, 135),
      platform(5070, 615, 740, 155),
      platform(5900, 620, 1580, 150),

      platform(420, 480, 190, 22, "ledge"),
      platform(1080, 452, 170, 22, "ledge"),
      platform(1330, 355, 190, 22, "ledge"),
      platform(1860, 490, 160, 22, "ledge"),
      platform(2130, 390, 200, 22, "ledge"),
      platform(2720, 455, 180, 22, "ledge"),
      platform(3060, 350, 150, 22, "ledge"),
      platform(3440, 455, 180, 22, "ledge"),
      platform(3740, 352, 220, 22, "ledge"),
      platform(4090, 265, 150, 22, "ledge"),
      platform(4480, 490, 180, 22, "ledge"),
      platform(5170, 455, 170, 22, "ledge"),
      platform(5480, 350, 190, 22, "ledge"),
      platform(5980, 465, 180, 22, "ledge"),

      platform(2290, 690, 620, 28, "secret-floor"),
      platform(2290, 515, 36, 205, "secret-wall"),
      platform(2865, 515, 36, 205, "secret-wall"),
      platform(4040, 515, 260, 24, "secret-ledge"),
    ];

    const movingPlatforms = [
      { id: id("moving"), x: 835, y: 510, width: 120, height: 20, axis: "x", distance: 105, speed: 0.85, phase: 0, baseX: 835, baseY: 510, dx: 0, dy: 0 },
      { id: id("moving"), x: 1620, y: 470, width: 115, height: 20, axis: "y", distance: 115, speed: 0.8, phase: 1.3, baseX: 1620, baseY: 470, dx: 0, dy: 0 },
      { id: id("moving"), x: 3280, y: 470, width: 105, height: 20, axis: "y", distance: 135, speed: 0.95, phase: 2, baseX: 3280, baseY: 470, dx: 0, dy: 0 },
      { id: id("moving"), x: 4930, y: 485, width: 120, height: 20, axis: "x", distance: 95, speed: 1.05, phase: 0.6, baseX: 4930, baseY: 485, dx: 0, dy: 0 },
      { id: id("moving"), x: 5750, y: 445, width: 130, height: 20, axis: "y", distance: 120, speed: 0.9, phase: 2.6, baseX: 5750, baseY: 445, dx: 0, dy: 0 },
    ];

    const fallingPlatforms = [
      { id: id("falling"), x: 1710, y: 540, width: 90, height: 20, baseY: 540, state: "idle", timer: 0, shake: 0 },
      { id: id("falling"), x: 2525, y: 540, width: 95, height: 20, baseY: 540, state: "idle", timer: 0, shake: 0 },
      { id: id("falling"), x: 4285, y: 520, width: 90, height: 20, baseY: 520, state: "idle", timer: 0, shake: 0 },
    ];

    const springs = [
      { id: id("spring"), x: 1470, y: 581, width: 48, height: 24, compression: 0 },
      { id: id("spring"), x: 3150, y: 596, width: 48, height: 24, compression: 0 },
      { id: id("spring"), x: 5560, y: 591, width: 48, height: 24, compression: 0 },
    ];

    const spikes = [
      { id: id("spike"), x: 710, y: 592, width: 95, height: 28 },
      { id: id("spike"), x: 1940, y: 587, width: 82, height: 28 },
      { id: id("spike"), x: 3600, y: 582, width: 96, height: 28 },
      { id: id("spike"), x: 5250, y: 587, width: 94, height: 28 },
    ];

    const hazards = [
      { id: id("hammer"), type: "hammer", x: 1200, y: 330, anchorX: 1200, anchorY: 300, length: 150, phase: 0, width: 48, height: 48 },
      { id: id("roller"), type: "roller", x: 2770, y: 574, baseX: 2770, baseY: 574, range: 150, phase: 0, width: 46, height: 46 },
      { id: id("crusher"), type: "crusher", x: 4670, y: 400, baseX: 4670, baseY: 400, phase: 1.5, width: 56, height: 68 },
    ];

    const coins = [];
    lineCoins(coins, 160, 560, 5, 62);
    arcCoins(coins, 775, 510, 6, 250, 95);
    lineCoins(coins, 1090, 405, 3, 56);
    arcCoins(coins, 1270, 315, 6, 310, 115);
    lineCoins(coins, 1835, 555, 6, 72);
    arcCoins(coins, 2170, 350, 6, 360, 110);
    lineCoins(coins, 2340, 640, 8, 62, 0, true);
    lineCoins(coins, 2740, 410, 4, 48);
    arcCoins(coins, 3020, 320, 7, 410, 145);
    lineCoins(coins, 3470, 555, 5, 65);
    lineCoins(coins, 3770, 310, 4, 56);
    arcCoins(coins, 4180, 225, 7, 460, 125);
    lineCoins(coins, 4490, 445, 3, 58);
    arcCoins(coins, 4890, 430, 7, 360, 100);
    lineCoins(coins, 5200, 405, 3, 55);
    arcCoins(coins, 5500, 310, 7, 390, 120);
    lineCoins(coins, 6000, 560, 6, 65);
    lineCoins(coins, 6250, 430, 5, 58);
    lineCoins(coins, 6730, 560, 5, 62);
    coins.push(coin(1510, 270, "big", true));
    coins.push(coin(2690, 642, "big", true));
    coins.push(coin(4145, 205, "big", true));

    const enemyScale = 1 + Math.max(0, level - 1) * 0.025;
    const enemies = [
      { type: "patrol", x: 540, y: 570, minX: 500, maxX: 680, speed: 62 * enemyScale },
      { type: "jump", x: 1110, y: 403, minX: 1080, maxX: 1250, speed: 0 },
      { type: "flying", x: 1560, y: 330, minX: 1460, maxX: 1650, speed: 68 * enemyScale, axis: "y" },
      { type: "shooter", x: 2050, y: 559, minX: 2050, maxX: 2050, speed: 0 },
      { type: "patrol", x: 2800, y: 570, minX: 2700, maxX: 3020, speed: 70 * enemyScale },
      { type: "flying", x: 3330, y: 320, minX: 3220, maxX: 3440, speed: 72 * enemyScale, axis: "x" },
      { type: "jump", x: 3880, y: 562, minX: 3820, maxX: 4060, speed: 0 },
      { type: "elite", x: 4140, y: 548, minX: 3970, maxX: 4240, speed: 54 * enemyScale },
      { type: "shooter", x: 4600, y: 444, minX: 4600, maxX: 4600, speed: 0 },
      { type: "flying", x: 5010, y: 345, minX: 4890, maxX: 5130, speed: 76 * enemyScale, axis: "y" },
      { type: "patrol", x: 5380, y: 567, minX: 5350, maxX: 5510, speed: 76 * enemyScale },
      { type: "elite", x: 6040, y: 558, minX: 5940, maxX: 6280, speed: 58 * enemyScale },
    ];

    const items = [
      { id: id("item"), type: "shield", x: 580, y: 430, taken: false },
      { id: id("item"), type: "speed", x: 2380, y: 635, taken: false, secret: true },
      { id: id("item"), type: "doubleJump", x: 3180, y: 300, taken: false },
      { id: id("item"), type: "magnet", x: 4550, y: 440, taken: false },
      { id: id("item"), type: "star", x: 5630, y: 300, taken: false },
    ];

    const hiddenBlocks = [
      { id: id("hidden"), x: 880, y: 430, width: 52, height: 52, revealed: false, hit: false, reward: "coin" },
      { id: id("hidden"), x: 2420, y: 515, width: 52, height: 52, revealed: false, hit: false, reward: "shield" },
      { id: id("hidden"), x: 3970, y: 395, width: 52, height: 52, revealed: false, hit: false, reward: "platform" },
    ];

    const checkpoints = [
      { id: id("checkpoint"), x: 2180, y: 505, width: 38, height: 110, active: false },
      { id: id("checkpoint"), x: 4770, y: 525, width: 38, height: 110, active: false },
    ];

    const secretZones = [
      { id: id("secret"), x: 2280, y: 510, width: 650, height: 210, name: "萤石地窖", found: false },
      { id: id("secret"), x: 3960, y: 150, width: 380, height: 250, name: "云端遗迹", found: false },
      { id: id("secret"), x: 5700, y: 230, width: 320, height: 220, name: "风之夹层", found: false },
    ];

    return {
      worldWidth,
      platforms,
      movingPlatforms,
      fallingPlatforms,
      springs,
      spikes,
      hazards,
      coins,
      enemies,
      items,
      hiddenBlocks,
      checkpoints,
      secretZones,
      boss: { x: 6740, y: 496, width: 142, height: 124, hp: 3 },
      goal: { x: 7280, y: 450, width: 92, height: 170 },
    };
  }

  globalThis.CrediusPrinceWorld = { buildLevel };
})();
