// @ts-check

(function () {
  "use strict";

  const STORAGE_KEY = "crediusArcade.campaign.v1";
  const MAX_LEVEL = 12;
  const STAR_REWARDS = [0, 12, 26, 44];
  const SHOP_ITEMS = [
    {
      id: "revive-card",
      name: "复活卡",
      description: "支持复活的游戏中，失败后原地恢复一次。",
      price: 80,
      icon: "续",
    },
    {
      id: "pass-card",
      name: "通关卡",
      description: "将当前已解锁关卡结算为 1 星并开启下一关。",
      price: 160,
      icon: "通",
    },
    {
      id: "star-booster",
      name: "星光徽章",
      description: "下一次成功结算额外获得 12 枚街机币。",
      price: 120,
      icon: "星",
    },
  ];

  const GAME_CONFIGS = {
    "2048": { baseTarget: 128, growth: 1.15, label: "合并目标" },
    "happy-match": { baseTarget: 4200, growth: 1.18, label: "消除目标", maxLevel: 10 },
    "tank-battle": { baseTarget: 650, growth: 1.16, label: "战斗目标" },
    "last-stand": {
      baseTarget: 600,
      growth: 1.18,
      label: "防守目标",
      maxLevel: 5,
      implementedLevels: 5,
      levelThresholds: [
        [600, 1050, 1550],
        [760, 1280, 1840],
        [920, 1510, 2140],
        [1100, 1760, 2480],
        [1300, 2050, 2860],
      ],
    },
    "tetris": { baseTarget: 300, growth: 1.16, label: "消行目标" },
    "snake": { baseTarget: 24, growth: 1.13, label: "成长目标" },
    "minesweeper": { baseTarget: 520, growth: 1.14, label: "排雷目标" },
    "breakout": {
      baseTarget: 1,
      growth: 1.15,
      label: "清场目标",
      implementedLevels: 5,
      ratingMode: "clear",
      clearReward: 16,
    },
    "sudoku": { baseTarget: 520, growth: 1.14, label: "推理目标" },
    "sokoban": { baseTarget: 480, growth: 1.14, label: "搬运目标" },
    "space-shooter": { baseTarget: 420, growth: 1.16, label: "波次目标" },
    "super-mary": { baseTarget: 2200, growth: 1.09, label: "历险目标" },
  };

  function createDefaultState() {
    return {
      version: 1,
      coins: 0,
      inventory: {
        "revive-card": 0,
        "pass-card": 0,
        "star-booster": 0,
      },
      games: {},
      transactions: [],
    };
  }

  function getStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  function readState() {
    const storage = getStorage();
    if (!storage) return createDefaultState();
    try {
      const raw = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
      const state = createDefaultState();
      state.coins = Math.max(0, Math.floor(Number(raw.coins) || 0));
      state.inventory = {
        ...state.inventory,
        ...(raw.inventory && typeof raw.inventory === "object" ? raw.inventory : {}),
      };
      for (const item of SHOP_ITEMS) {
        state.inventory[item.id] = Math.max(0, Math.floor(Number(state.inventory[item.id]) || 0));
      }
      state.games = raw.games && typeof raw.games === "object" ? raw.games : {};
      state.transactions = Array.isArray(raw.transactions) ? raw.transactions.slice(-80) : [];
      return state;
    } catch {
      return createDefaultState();
    }
  }

  function writeState(state) {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      globalThis.dispatchEvent?.(new CustomEvent("credius-campaign-changed"));
    } catch {
      // Campaign progress is best effort when storage is unavailable.
    }
  }

  function getMaxLevel(gameId) {
    return Math.max(1, Math.floor(Number(GAME_CONFIGS[gameId]?.maxLevel) || MAX_LEVEL));
  }

  function normalizeLevel(level, maxLevel = MAX_LEVEL) {
    return Math.min(maxLevel, Math.max(1, Math.floor(Number(level) || 1)));
  }

  function getGameState(state, gameId) {
    const maxLevel = getMaxLevel(gameId);
    const existing = state.games[gameId];
    if (existing && typeof existing === "object") {
      existing.unlockedLevel = normalizeLevel(existing.unlockedLevel, maxLevel);
      existing.levels = existing.levels && typeof existing.levels === "object" ? existing.levels : {};
      return existing;
    }
    const gameState = { unlockedLevel: 1, levels: {} };
    state.games[gameId] = gameState;
    return gameState;
  }

  function getLevelConfig(gameId, level = 1) {
    const config = GAME_CONFIGS[gameId] ?? { baseTarget: 300, growth: 1.15, label: "关卡目标" };
    const maxLevel = getMaxLevel(gameId);
    const safeLevel = normalizeLevel(level, maxLevel);
    const customThresholds = config.levelThresholds?.[safeLevel - 1];
    const oneStar = Math.max(1, Math.round(
      customThresholds?.[0] ?? config.baseTarget * config.growth ** (safeLevel - 1),
    ));
    return {
      gameId,
      level: safeLevel,
      maxLevel,
      label: config.label,
      ratingMode: config.ratingMode ?? "stars",
      thresholds: customThresholds
        ? customThresholds.slice()
        : [oneStar, Math.round(oneStar * 1.45), Math.round(oneStar * 1.95)],
      speedMultiplier: Number((1 + (safeLevel - 1) * 0.065).toFixed(3)),
      densityMultiplier: Number((1 + (safeLevel - 1) * 0.055).toFixed(3)),
      graceMultiplier: Number(Math.max(0.58, 1 - (safeLevel - 1) * 0.035).toFixed(3)),
    };
  }

  function getCurrentGameId() {
    const match = globalThis.location?.pathname?.match(/\/games\/([^/]+)\//);
    return match?.[1] ?? "";
  }

  function getCurrentLevel(gameId = getCurrentGameId()) {
    const requested = new URLSearchParams(globalThis.location?.search ?? "").get("level");
    if (requested) return normalizeLevel(requested, getMaxLevel(gameId));
    return getGameProgress(gameId).unlockedLevel;
  }

  function getGameProgress(gameId) {
    const state = readState();
    const game = getGameState(state, gameId);
    const levels = {};
    for (let level = 1; level <= getMaxLevel(gameId); level += 1) {
      const saved = game.levels[level] ?? {};
      levels[level] = {
        stars: Math.min(3, Math.max(0, Math.floor(Number(saved.stars) || 0))),
        bestScore: Math.max(0, Math.floor(Number(saved.bestScore) || 0)),
        cleared: Boolean(saved.cleared),
      };
    }
    return { unlockedLevel: game.unlockedLevel, levels };
  }

  function getStars(score, thresholds) {
    if (score >= thresholds[2]) return 3;
    if (score >= thresholds[1]) return 2;
    if (score >= thresholds[0]) return 1;
    return 0;
  }

  function addTransaction(state, type, amount, detail) {
    state.transactions.push({
      id: `${type}-${Date.now()}-${state.transactions.length}`,
      type,
      amount,
      detail,
      createdAt: new Date().toISOString(),
    });
    state.transactions = state.transactions.slice(-80);
  }

  function settleResult(gameId, result) {
    const state = readState();
    const level = getCurrentLevel(gameId);
    const config = getLevelConfig(gameId, level);
    const score = Math.max(0, Math.round(Number(result?.score) || 0));
    const clearOnly = config.ratingMode === "clear";
    const reportedStars = Number(result?.stars);
    const stars = clearOnly || result?.completed === false
      ? 0
      : Number.isFinite(reportedStars)
        ? Math.min(3, Math.max(0, Math.floor(reportedStars)))
        : getStars(score, config.thresholds);
    const game = getGameState(state, gameId);
    const previous = game.levels[level] ?? { stars: 0, bestScore: 0, cleared: false };
    const previousStars = Math.min(3, Math.max(0, Number(previous.stars) || 0));
    const passed = clearOnly ? result?.completed === true : stars > 0;
    let coins = 0;

    if (passed) {
      if (clearOnly) {
        coins = previous.cleared
          ? 3
          : Math.max(1, Math.floor(Number(GAME_CONFIGS[gameId]?.clearReward) || 12));
      } else {
        const starUpgrade = Math.max(0, stars - previousStars);
        coins = starUpgrade > 0
          ? STAR_REWARDS[stars] - STAR_REWARDS[previousStars]
          : 3 + stars * 2;
        if ((state.inventory["star-booster"] ?? 0) > 0) {
          state.inventory["star-booster"] -= 1;
          coins += 12;
        }
      }
      state.coins += coins;
      const implementedLevels = Math.max(
        1,
        Math.floor(Number(GAME_CONFIGS[gameId]?.implementedLevels) || getMaxLevel(gameId)),
      );
      game.unlockedLevel = Math.max(
        game.unlockedLevel,
        Math.min(getMaxLevel(gameId), implementedLevels, level + 1),
      );
      addTransaction(
        state,
        "level-reward",
        coins,
        clearOnly ? `${gameId} 第 ${level} 关清场` : `${gameId} 第 ${level} 关 ${stars} 星`,
      );
    }

    game.levels[level] = {
      stars: clearOnly ? 0 : Math.max(previousStars, stars),
      bestScore: Math.max(Number(previous.bestScore) || 0, score),
      cleared: Boolean(previous.cleared || passed),
      updatedAt: new Date().toISOString(),
    };
    writeState(state);

    const settlement = {
      gameId,
      level,
      score,
      stars,
      coins,
      passed,
      ratingMode: config.ratingMode,
      thresholds: config.thresholds,
      nextLevel: game.unlockedLevel,
    };
    renderSettlement(settlement);
    try {
      globalThis.parent?.postMessage?.({ type: "credius:campaign-result", settlement }, "*");
    } catch {
      // Standalone games do not need parent feedback.
    }
    return settlement;
  }

  function buyItem(itemId) {
    const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
    const state = readState();
    if (!item) return { ok: false, message: "没有找到这件道具。", state };
    if (state.coins < item.price) return { ok: false, message: "街机币不足。", state };
    state.coins -= item.price;
    state.inventory[itemId] = Math.max(0, Number(state.inventory[itemId]) || 0) + 1;
    addTransaction(state, "shop", -item.price, item.name);
    writeState(state);
    return { ok: true, message: `已兑换 ${item.name}。`, state };
  }

  function consumeItem(itemId) {
    const state = readState();
    const quantity = Math.max(0, Number(state.inventory[itemId]) || 0);
    if (!quantity) return false;
    state.inventory[itemId] = quantity - 1;
    addTransaction(state, "consume", 0, itemId);
    writeState(state);
    return true;
  }

  function usePassCard(gameId, level) {
    const maxLevel = getMaxLevel(gameId);
    const safeLevel = normalizeLevel(level, maxLevel);
    const state = readState();
    if ((state.inventory["pass-card"] ?? 0) <= 0) {
      return { ok: false, message: "背包里没有通关卡。", state };
    }
    const game = getGameState(state, gameId);
    if (safeLevel > game.unlockedLevel) {
      return { ok: false, message: "只能跳过当前已解锁关卡。", state };
    }
    const previous = game.levels[safeLevel] ?? {};
    const clearOnly = GAME_CONFIGS[gameId]?.ratingMode === "clear";
    state.inventory["pass-card"] -= 1;
    game.levels[safeLevel] = {
      ...previous,
      stars: clearOnly ? 0 : Math.max(1, Number(previous.stars) || 0),
      bestScore: Math.max(0, Number(previous.bestScore) || 0),
      cleared: true,
      updatedAt: new Date().toISOString(),
    };
    const implementedLevels = Math.max(
      1,
      Math.floor(Number(GAME_CONFIGS[gameId]?.implementedLevels) || maxLevel),
    );
    game.unlockedLevel = Math.max(
      game.unlockedLevel,
      Math.min(maxLevel, implementedLevels, safeLevel + 1),
    );
    addTransaction(state, "pass-card", 0, `${gameId} 第 ${safeLevel} 关`);
    writeState(state);
    return {
      ok: true,
      message: clearOnly
        ? `第 ${safeLevel} 关已通过并开启下一关。`
        : `第 ${safeLevel} 关已按 1 星通过。`,
      state,
    };
  }

  function getSummary() {
    const state = readState();
    let stars = 0;
    let clearedLevels = 0;
    for (const game of Object.values(state.games)) {
      for (const level of Object.values(game?.levels ?? {})) {
        stars += Math.max(0, Number(level?.stars) || 0);
        if (level?.cleared) clearedLevels += 1;
      }
    }
    return {
      coins: state.coins,
      inventory: { ...state.inventory },
      stars,
      clearedLevels,
    };
  }

  function renderSettlement(settlement) {
    const card = globalThis.document?.querySelector?.(".settlement-card");
    if (!card) return;
    let panel = globalThis.document.getElementById("campaignSettlement");
    if (!panel) {
      panel = globalThis.document.createElement("div");
      panel.id = "campaignSettlement";
      panel.className = "campaign-settlement";
      const actions = card.querySelector(".settlement-actions");
      card.insertBefore(panel, actions ?? null);
    }
    panel.innerHTML = settlement.ratingMode === "clear"
      ? `
        <span>第 ${settlement.level} 关</span>
        <strong class="campaign-stars" aria-label="${settlement.passed ? "已通关" : "未通关"}">${settlement.passed ? "✓ 已清场" : "尚未清场"}</strong>
        <small>${settlement.passed ? `获得 ${settlement.coins} 街机币` : "清空所有可破坏砖块即可过关"}</small>
      `
      : `
        <span>第 ${settlement.level} 关</span>
        <strong class="campaign-stars" aria-label="${settlement.stars} 星">${"★".repeat(settlement.stars)}${"☆".repeat(3 - settlement.stars)}</strong>
        <small>${settlement.passed ? `获得 ${settlement.coins} 街机币` : `达到 ${settlement.thresholds[0]} 分即可过关`}</small>
      `;
  }

  function injectLevelHud() {
    const gameId = getCurrentGameId();
    const topbar = globalThis.document?.querySelector?.(".game-topbar");
    if (!gameId || !topbar || topbar.querySelector(".campaign-level-chip")) return;
    const level = getCurrentLevel(gameId);
    const config = getLevelConfig(gameId, level);
    const chip = globalThis.document.createElement("div");
    chip.className = "campaign-level-chip";
    chip.innerHTML = config.ratingMode === "clear"
      ? `<span>关卡</span><strong>${level}/${config.maxLevel}</strong><small>清空可破坏砖块</small>`
      : `<span>关卡</span><strong>${level}/${config.maxLevel}</strong><small>${config.thresholds[0]} 分过关</small>`;
    const stats = topbar.querySelector(".game-stats");
    if (stats) {
      stats.prepend(chip);
    } else {
      topbar.append(chip);
    }
  }

  const storageApi = globalThis.CrediusArcadeStorage;
  if (storageApi?.saveGameResult) {
    const originalSaveGameResult = storageApi.saveGameResult.bind(storageApi);
    storageApi.saveGameResult = function (gameId, result, now) {
      const baseResult = originalSaveGameResult(gameId, result, now);
      return { ...baseResult, campaign: settleResult(gameId, result) };
    };
  }

  globalThis.CrediusArcadeCampaign = {
    GAME_CONFIGS,
    MAX_LEVEL,
    SHOP_ITEMS,
    STORAGE_KEY,
    buyItem,
    consumeItem,
    getCurrentLevel,
    getGameProgress,
    getLevelConfig,
    getMaxLevel,
    getSummary,
    readState,
    settleResult,
    usePassCard,
  };

  injectLevelHud();
})();
