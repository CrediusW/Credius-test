// @ts-check

/**
 * @typedef {import("./types").GameRecord} GameRecord
 * @typedef {import("./types").PlayerSettings} PlayerSettings
 */

(function () {
  "use strict";

const RECORDS_KEY = "crediusArcade.records.v1";
const SETTINGS_KEY = "crediusArcade.settings.v1";
const HAMSTER_KEY = "crediusArcade.hamster.v1";

const RECENT_SCORE_LIMIT = 10;
const HAMSTER_SAVE_VERSION = 2;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** @type {Record<string, string>} */
const legacyBestKeys = {
  "2048": "click-select-2048-best",
  "tank-battle": "tank-battle-best",
};

/**
 * @returns {Storage | null}
 */
function getStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    const probeKey = "__credius_arcade_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {unknown} fallback
 * @returns {unknown}
 */
function readJson(key, fallback) {
  const storage = getStorage();
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function writeJson(key, value) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    emitStorageChange();
  } catch {
    // Local records are best effort; the app keeps running with safe defaults.
  }
}

function emitStorageChange() {
  try {
    globalThis.dispatchEvent(new CustomEvent("credius-records-changed"));
  } catch {
    // Tests and older browsers may not expose CustomEvent on globalThis.
  }
}

/**
 * @param {string} gameId
 * @returns {GameRecord}
 */
function createDefaultRecord(gameId) {
  return {
    gameId,
    highScore: 0,
    totalPlays: 0,
    totalPlayTime: 0,
    lastPlayedAt: "",
    recentScores: [],
    favorite: false,
  };
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function safeAnyNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

/**
 * @param {string} isoDate
 * @returns {number}
 */
function parseTime(isoDate) {
  const time = new Date(isoDate).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * @param {Date} date
 * @returns {string}
 */
function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @returns {typeof globalThis.CrediusHamsterBalance | null}
 */
function getHamsterBalance() {
  return globalThis.CrediusHamsterBalance ?? null;
}

/**
 * @param {string} gameId
 * @param {unknown} value
 * @returns {GameRecord}
 */
function normalizeRecord(gameId, value) {
  const source = value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
  const recentScores = Array.isArray(source.recentScores)
    ? source.recentScores.map(safeNumber).filter((score) => score >= 0).slice(0, RECENT_SCORE_LIMIT)
    : [];
  const record = createDefaultRecord(gameId);

  record.highScore = safeNumber(source.highScore);
  record.totalPlays = safeNumber(source.totalPlays);
  record.totalPlayTime = safeNumber(source.totalPlayTime);
  record.lastPlayedAt = typeof source.lastPlayedAt === "string" ? source.lastPlayedAt : "";
  record.recentScores = recentScores;
  record.favorite = Boolean(source.favorite);

  if (safeNumber(source.bestTime)) {
    record.bestTime = safeNumber(source.bestTime);
  }
  if (safeNumber(source.highestLevel)) {
    record.highestLevel = safeNumber(source.highestLevel);
  }

  return record;
}

/**
 * @returns {Record<string, GameRecord>}
 */
function readRecordMap() {
  const raw = readJson(RECORDS_KEY, {});
  const source = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  /** @type {Record<string, GameRecord>} */
  const records = {};

  for (const gameId of Object.keys(source)) {
    records[gameId] = normalizeRecord(gameId, source[gameId]);
  }

  migrateLegacyBestScores(records);
  return records;
}

/**
 * @param {Record<string, GameRecord>} records
 */
function migrateLegacyBestScores(records) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  for (const [gameId, legacyKey] of Object.entries(legacyBestKeys)) {
    const legacyScore = safeNumber(storage.getItem(legacyKey));
    if (!legacyScore) {
      continue;
    }
    const record = records[gameId] ?? createDefaultRecord(gameId);
    record.highScore = Math.max(record.highScore, legacyScore);
    records[gameId] = record;
  }
}

/**
 * @param {Record<string, GameRecord>} records
 */
function writeRecordMap(records) {
  writeJson(RECORDS_KEY, records);
}

/**
 * @param {string} [gameId]
 */
function removeLegacyBestScores(gameId) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const entries = gameId ? [[gameId, legacyBestKeys[gameId]]] : Object.entries(legacyBestKeys);
  for (const [, key] of entries) {
    if (key) {
      storage.removeItem(key);
    }
  }
}

/**
 * @param {string} gameId
 * @returns {GameRecord}
 */
function getGameRecord(gameId) {
  return readRecordMap()[gameId] ?? createDefaultRecord(gameId);
}

/**
 * @param {string[]} gameIds
 * @returns {Record<string, GameRecord>}
 */
function getAllRecords(gameIds) {
  const records = readRecordMap();
  for (const gameId of gameIds) {
    records[gameId] = normalizeRecord(gameId, records[gameId]);
  }
  return records;
}

/**
 * @param {string} gameId
 * @param {{score?: number; playTime?: number; bestTime?: number; highestLevel?: number; roundId?: string}} result
 * @param {Date} [now]
 * @returns {{record: GameRecord; newHighScore: boolean; hamsterReward?: import("./types").HamsterMiniGameReward | null}}
 */
function saveGameResult(gameId, result, now = new Date()) {
  const records = readRecordMap();
  const record = normalizeRecord(gameId, records[gameId]);
  const score = safeNumber(result.score);
  const playTime = safeNumber(result.playTime);
  const bestTime = safeNumber(result.bestTime);
  const highestLevel = safeNumber(result.highestLevel);
  const newHighScore = score > record.highScore;

  record.highScore = Math.max(record.highScore, score);
  record.totalPlays += 1;
  record.totalPlayTime += playTime;
  record.lastPlayedAt = now.toISOString();
  record.recentScores = [score, ...record.recentScores].slice(0, RECENT_SCORE_LIMIT);

  if (bestTime && (!record.bestTime || bestTime < record.bestTime)) {
    record.bestTime = bestTime;
  }
  if (highestLevel) {
    record.highestLevel = Math.max(record.highestLevel ?? 0, highestLevel);
  }

  records[gameId] = record;
  writeRecordMap(records);
  const hamsterReward = applyHamsterMiniGameReward(gameId, result, newHighScore, now);
  postHamsterRewardToParent(hamsterReward);
  return { record, newHighScore, hamsterReward };
}

/**
 * @param {import("./types").HamsterMiniGameReward | null} reward
 */
function postHamsterRewardToParent(reward) {
  if (!reward?.message) {
    return;
  }
  try {
    if (globalThis.parent && globalThis.parent !== globalThis && typeof globalThis.parent.postMessage === "function") {
      globalThis.parent.postMessage({ type: "credius:hamster-reward", reward }, "*");
    }
  } catch {
    // Standalone games do not need parent feedback.
  }
}

/**
 * @param {string} gameId
 * @param {boolean} favorite
 * @returns {GameRecord}
 */
function setFavorite(gameId, favorite) {
  const records = readRecordMap();
  const record = normalizeRecord(gameId, records[gameId]);
  record.favorite = favorite;
  records[gameId] = record;
  writeRecordMap(records);
  return record;
}

/**
 * @param {string} gameId
 */
function clearGameRecord(gameId) {
  const records = readRecordMap();
  const favorite = Boolean(records[gameId]?.favorite);
  records[gameId] = { ...createDefaultRecord(gameId), favorite };
  removeLegacyBestScores(gameId);
  writeRecordMap(records);
}

function clearAllRecords() {
  removeLegacyBestScores();
  writeRecordMap({});
}

function clearAllLocalData() {
  const storage = getStorage();
  removeLegacyBestScores();
  if (storage) {
    storage.removeItem(SETTINGS_KEY);
  }
  writeRecordMap({});
}

/**
 * @returns {PlayerSettings}
 */
function getSettings() {
  const raw = readJson(SETTINGS_KEY, {});
  const source = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};

  return {
    nickname: typeof source.nickname === "string" && source.nickname.trim() ? source.nickname : "Player One",
    soundEnabled: source.soundEnabled !== false,
    vibrationEnabled: source.vibrationEnabled !== false,
    reduceMotion: Boolean(source.reduceMotion),
    showHamsterInGames: source.showHamsterInGames !== false,
    hamsterAnimationMode:
      source.hamsterAnimationMode === "simple" || source.hamsterAnimationMode === "off"
        ? source.hamsterAnimationMode
        : "full",
    hamsterSoundEnabled: source.hamsterSoundEnabled !== false,
    hamsterVibrationEnabled: source.hamsterVibrationEnabled !== false,
    hamsterBubbleFrequency:
      source.hamsterBubbleFrequency === "low" || source.hamsterBubbleFrequency === "quiet"
        ? source.hamsterBubbleFrequency
        : "normal",
    hamsterAutoClaimRewards: Boolean(source.hamsterAutoClaimRewards),
    hamsterShowNumbers: Boolean(source.hamsterShowNumbers),
    hamsterLobbyCollapsed: Boolean(source.hamsterLobbyCollapsed),
    hamsterCompanionX:
      typeof source.hamsterCompanionX === "number" && Number.isFinite(source.hamsterCompanionX)
        ? clamp(source.hamsterCompanionX, 0, 1)
        : null,
    hamsterCompanionY:
      typeof source.hamsterCompanionY === "number" && Number.isFinite(source.hamsterCompanionY)
        ? clamp(source.hamsterCompanionY, 0, 1)
        : null,
  };
}

/**
 * @param {Partial<PlayerSettings>} patch
 * @returns {PlayerSettings}
 */
function updateSettings(patch) {
  const settings = { ...getSettings(), ...patch };
  writeJson(SETTINGS_KEY, settings);
  return settings;
}

/**
 * @returns {import("./types").HamsterStatistics}
 */
function createDefaultHamsterStatistics() {
  return {
    totalFeedings: 0,
    totalBaths: 0,
    totalPettings: 0,
    totalPlaySessions: 0,
    totalSleepTime: 0,
    totalWorkSessions: 0,
    totalOutings: 0,
    totalCoinsEarned: 0,
    totalCoinsSpent: 0,
    miniGamesCompleted: 0,
    recordsWitnessed: 0,
  };
}

/**
 * @param {Date} now
 * @param {string} name
 * @returns {import("./types").HamsterProfile}
 */
function createHamsterProfile(now, name = "团团") {
  const balance = getHamsterBalance();
  const starter = balance?.starter ?? {};
  const iso = now.toISOString();
  return {
    id: `hamster-${Math.random().toString(36).slice(2, 10)}-${now.getTime().toString(36)}`,
    name: name.trim().slice(0, 12) || "团团",
    createdAt: iso,
    birthday: iso,
    level: 1,
    experience: 0,
    coins: safeNumber(starter.coins) || 80,
    affection: clamp(safeAnyNumber(starter.affection, 8)),
    hunger: clamp(safeAnyNumber(starter.hunger, 78)),
    cleanliness: clamp(safeAnyNumber(starter.cleanliness, 76)),
    energy: clamp(safeAnyNumber(starter.energy, 78)),
    happiness: clamp(safeAnyNumber(starter.happiness, 72)),
    health: clamp(safeAnyNumber(starter.health, 96)),
    currentState: "idle",
    activeOutfitId: "",
    activeRoomThemeId: "room.default",
    ownedItems: normalizeInventory(starter.inventory),
    achievements: ["hamster.created"],
    statistics: createDefaultHamsterStatistics(),
    lastUpdatedAt: iso,
    lastInteractionAt: iso,
  };
}

/**
 * @param {Date} now
 * @returns {import("./types").HamsterSaveData}
 */
function createDefaultHamsterSaveData(now = new Date()) {
  const dateKey = getLocalDateKey(now);
  const profile = createHamsterProfile(now, "团团");
  profile.createdAt = "";
  profile.birthday = "";
  profile.coins = 0;
  profile.affection = 0;
  profile.ownedItems = [];
  profile.achievements = [];
  return {
    version: HAMSTER_SAVE_VERSION,
    adopted: false,
    profile,
    dailyTasks: createDailyTasksForDate(dateKey),
    shopState: createShopState(dateKey),
    eventHistory: [],
    unlockedContent: ["room.default"],
    lastDailyResetDate: dateKey,
    cooldowns: {},
    gameRewardState: createGameRewardState(dateKey),
  };
}

/**
 * @param {unknown} value
 * @returns {import("./types").InventoryItem[]}
 */
function normalizeInventory(value) {
  const source = Array.isArray(value) ? value : [];
  /** @type {Record<string, import("./types").InventoryItem>} */
  const merged = {};
  for (const entry of source) {
    const item = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
    const itemId = safeString(item.itemId).trim();
    if (!itemId) {
      continue;
    }
    const quantity = Math.max(0, Math.floor(safeAnyNumber(item.quantity, 0)));
    if (!quantity) {
      continue;
    }
    merged[itemId] = {
      itemId,
      quantity: (merged[itemId]?.quantity ?? 0) + quantity,
      acquiredAt: safeString(item.acquiredAt) || undefined,
    };
  }
  return Object.values(merged);
}

/**
 * @param {unknown} value
 * @returns {import("./types").HamsterActivity | undefined}
 */
function normalizeActivity(value) {
  const source = value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
  const type =
    source.type === "work" || source.type === "outing" || source.type === "sleep" || source.type === "study"
      ? source.type
      : "";
  const activityId = safeString(source.activityId).trim();
  const startedAt = safeString(source.startedAt);
  const endsAt = safeString(source.endsAt);
  if (!type || !activityId || !parseTime(startedAt) || !parseTime(endsAt)) {
    return undefined;
  }
  return {
    type,
    activityId,
    startedAt,
    endsAt,
    energyCost: safeNumber(source.energyCost) || undefined,
    hungerCost: safeNumber(source.hungerCost) || undefined,
    cleanlinessCost: safeNumber(source.cleanlinessCost) || undefined,
    rewardClaimed: Boolean(source.rewardClaimed),
    resultSeed: safeString(source.resultSeed) || undefined,
  };
}

/**
 * @param {string} dateKey
 * @returns {import("./types").DailyTaskState[]}
 */
function createDailyTasksForDate(dateKey) {
  const pool = getHamsterBalance()?.dailyTaskPool ?? [];
  if (!pool.length) {
    return [];
  }
  const start = hashString(dateKey) % pool.length;
  return [0, 1, 2].map((offset) => {
    const task = pool[(start + offset) % pool.length];
    return {
      taskId: task.id,
      type: task.type,
      title: task.title,
      target: task.target,
      progress: 0,
      claimed: false,
      date: dateKey,
    };
  });
}

/**
 * @param {string} dateKey
 * @returns {import("./types").ShopState}
 */
function createShopState(dateKey) {
  const items = getHamsterBalance()?.shopItems ?? [];
  const discountCandidates = items.filter((item) => item.price > 20);
  const chosen = discountCandidates.length ? discountCandidates[hashString(dateKey) % discountCandidates.length] : null;
  return {
    date: dateKey,
    discountItemId: chosen?.id ?? "",
    discountRate: chosen ? 0.85 : 1,
    purchases: [],
  };
}

/**
 * @param {string} dateKey
 * @returns {import("./types").HamsterGameRewardState}
 */
function createGameRewardState(dateKey) {
  return {
    date: dateKey,
    normalCoinsEarned: 0,
    extraCoinsEarned: 0,
    rewardedRoundIds: [],
    firstPlayGameIds: [],
    completedGameIds: [],
  };
}

/**
 * @param {unknown} value
 * @param {Date} now
 * @returns {import("./types").HamsterSaveData}
 */
function normalizeHamsterSaveData(value, now = new Date()) {
  const fallback = createDefaultHamsterSaveData(now);
  const source = value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
  const profileSource =
    source.profile && typeof source.profile === "object"
      ? /** @type {Record<string, unknown>} */ (source.profile)
      : {};
  const profile = createHamsterProfile(now, safeString(profileSource.name, "团团"));
  const statsSource =
    profileSource.statistics && typeof profileSource.statistics === "object"
      ? /** @type {Record<string, unknown>} */ (profileSource.statistics)
      : {};
  const stats = createDefaultHamsterStatistics();

  for (const key of Object.keys(stats)) {
    stats[key] = Math.max(0, Math.floor(safeAnyNumber(statsSource[key], stats[key])));
  }

  profile.id = safeString(profileSource.id, profile.id);
  profile.createdAt = safeString(profileSource.createdAt, profile.createdAt);
  profile.birthday = safeString(profileSource.birthday, profile.createdAt);
  profile.level = Math.min(getHamsterBalance()?.levelCap ?? 20, Math.max(1, Math.floor(safeAnyNumber(profileSource.level, 1))));
  profile.experience = Math.max(0, Math.floor(safeAnyNumber(profileSource.experience, 0)));
  profile.coins = Math.max(0, Math.floor(safeAnyNumber(profileSource.coins, profile.coins)));
  profile.affection = clamp(safeAnyNumber(profileSource.affection, profile.affection));
  profile.hunger = clamp(safeAnyNumber(profileSource.hunger, profile.hunger));
  profile.cleanliness = clamp(safeAnyNumber(profileSource.cleanliness, profile.cleanliness));
  profile.energy = clamp(safeAnyNumber(profileSource.energy, profile.energy));
  profile.happiness = clamp(safeAnyNumber(profileSource.happiness, profile.happiness));
  profile.health = clamp(safeAnyNumber(profileSource.health, profile.health));
  profile.currentState = normalizeHamsterState(profileSource.currentState);
  profile.currentActivity = normalizeActivity(profileSource.currentActivity);
  profile.activeOutfitId = safeString(profileSource.activeOutfitId);
  profile.activeRoomThemeId = safeString(profileSource.activeRoomThemeId, "room.default") || "room.default";
  profile.ownedItems = normalizeInventory(profileSource.ownedItems);
  profile.achievements = uniqueStrings(profileSource.achievements);
  profile.statistics = stats;
  profile.lastUpdatedAt = safeString(profileSource.lastUpdatedAt, profile.createdAt);
  profile.lastInteractionAt = safeString(profileSource.lastInteractionAt, profile.createdAt);

  const dateKey = getLocalDateKey(now);
  const save = {
    version: HAMSTER_SAVE_VERSION,
    adopted: Boolean(source.adopted && parseTime(profile.createdAt)),
    profile,
    dailyTasks: normalizeDailyTasks(source.dailyTasks, safeString(source.lastDailyResetDate, dateKey) || dateKey),
    shopState: normalizeShopState(source.shopState, dateKey),
    eventHistory: normalizeEventHistory(source.eventHistory),
    unlockedContent: uniqueStrings(source.unlockedContent),
    lastDailyResetDate: safeString(source.lastDailyResetDate, dateKey) || dateKey,
    cooldowns: normalizeCooldowns(source.cooldowns),
    gameRewardState: normalizeGameRewardState(source.gameRewardState, dateKey),
  };

  if (!save.unlockedContent.includes("room.default")) {
    save.unlockedContent.push("room.default");
  }
  if (!save.profile.achievements.includes("hamster.created") && save.adopted) {
    save.profile.achievements.push("hamster.created");
  }
  unlockHamsterContent(save);
  refreshHamsterAchievements(save);
  return save.adopted ? save : fallback;
}

/**
 * @param {unknown} value
 * @returns {import("./types").HamsterProfile["currentState"]}
 */
function normalizeHamsterState(value) {
  const allowed = new Set(["idle", "eating", "bathing", "playing", "sleeping", "working", "outing", "studying", "resting"]);
  return allowed.has(String(value)) ? /** @type {import("./types").HamsterProfile["currentState"]} */ (value) : "idle";
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function uniqueStrings(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.filter((item) => typeof item === "string" && item.trim()))];
}

/**
 * @param {unknown} value
 * @param {string} dateKey
 * @returns {import("./types").DailyTaskState[]}
 */
function normalizeDailyTasks(value, dateKey) {
  const tasks = Array.isArray(value) ? value : createDailyTasksForDate(dateKey);
  const normalized = tasks
    .map((entry) => {
      const source = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
      const taskId = safeString(source.taskId);
      const type = safeString(source.type);
      const target = Math.max(1, Math.floor(safeAnyNumber(source.target, 1)));
      if (!taskId || !type) {
        return null;
      }
      return {
        taskId,
        type,
        title: safeString(source.title, taskId),
        target,
        progress: Math.min(target, Math.max(0, Math.floor(safeAnyNumber(source.progress, 0)))),
        claimed: Boolean(source.claimed),
        date: safeString(source.date, dateKey) || dateKey,
      };
    })
    .filter(Boolean);
  return normalized.length ? /** @type {import("./types").DailyTaskState[]} */ (normalized) : createDailyTasksForDate(dateKey);
}

/**
 * @param {unknown} value
 * @param {string} dateKey
 * @returns {import("./types").ShopState}
 */
function normalizeShopState(value, dateKey) {
  const fallback = createShopState(dateKey);
  const source = value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
  if (safeString(source.date) !== dateKey) {
    return fallback;
  }
  return {
    date: dateKey,
    discountItemId: safeString(source.discountItemId, fallback.discountItemId),
    discountRate: Math.min(1, Math.max(0.5, safeAnyNumber(source.discountRate, fallback.discountRate))),
    purchases: uniqueStrings(source.purchases),
  };
}

/**
 * @param {unknown} value
 * @returns {import("./types").HamsterEvent[]}
 */
function normalizeEventHistory(value) {
  const events = Array.isArray(value) ? value : [];
  return events
    .map((entry) => {
      const source = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
      const id = safeString(source.id);
      const type = safeString(source.type);
      const message = safeString(source.message);
      const createdAt = safeString(source.createdAt);
      if (!id || !type || !message || !parseTime(createdAt)) {
        return null;
      }
      return { id, type, message, createdAt, data: source.data };
    })
    .filter(Boolean)
    .slice(-30);
}

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
function normalizeCooldowns(value) {
  const source = value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
  /** @type {Record<string, string>} */
  const cooldowns = {};
  for (const [key, item] of Object.entries(source)) {
    if (typeof item === "string" && parseTime(item)) {
      cooldowns[key] = item;
    }
  }
  return cooldowns;
}

/**
 * @param {unknown} value
 * @param {string} dateKey
 * @returns {import("./types").HamsterGameRewardState}
 */
function normalizeGameRewardState(value, dateKey) {
  const fallback = createGameRewardState(dateKey);
  const source = value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
  if (safeString(source.date) !== dateKey) {
    return {
      ...fallback,
      firstPlayGameIds: uniqueStrings(source.firstPlayGameIds),
      completedGameIds: uniqueStrings(source.completedGameIds),
    };
  }
  return {
    date: dateKey,
    normalCoinsEarned: Math.max(0, Math.floor(safeAnyNumber(source.normalCoinsEarned, 0))),
    extraCoinsEarned: Math.max(0, Math.floor(safeAnyNumber(source.extraCoinsEarned, 0))),
    rewardedRoundIds: uniqueStrings(source.rewardedRoundIds).slice(-80),
    firstPlayGameIds: uniqueStrings(source.firstPlayGameIds),
    completedGameIds: uniqueStrings(source.completedGameIds),
  };
}

/**
 * @param {string} input
 * @returns {number}
 */
function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/**
 * @param {string} seed
 * @returns {number}
 */
function seededUnit(seed) {
  return (hashString(seed) % 10000) / 10000;
}

/**
 * @param {string} itemId
 * @returns {Record<string, unknown> | undefined}
 */
function findHamsterItem(itemId) {
  const balance = getHamsterBalance();
  const shopItem = balance?.shopItems?.find((item) => item.id === itemId);
  if (shopItem) {
    return shopItem;
  }
  const themed = balance?.themedMiniGameItems ? Object.values(balance.themedMiniGameItems).find((item) => item.itemId === itemId) : null;
  if (themed) {
    return {
      id: themed.itemId,
      itemId: themed.itemId,
      icon: themed.icon,
      name: themed.name,
      category: "collection",
      price: 0,
      maxOwned: 1,
      description: "小游戏联动纪念物。",
    };
  }
  if (itemId === "room.default") {
    return { id: "room.default", icon: "屋", name: "默认温暖小屋", category: "room", price: 0, maxOwned: 1 };
  }
  return undefined;
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {string} itemId
 * @returns {number}
 */
function getInventoryQuantity(save, itemId) {
  return save.profile.ownedItems.find((item) => item.itemId === itemId)?.quantity ?? 0;
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {string} itemId
 * @param {number} quantity
 * @param {Date} now
 */
function addInventoryItem(save, itemId, quantity, now) {
  const safeQuantity = Math.max(0, Math.floor(quantity));
  if (!itemId || !safeQuantity) {
    return;
  }
  const existing = save.profile.ownedItems.find((item) => item.itemId === itemId);
  if (existing) {
    existing.quantity += safeQuantity;
  } else {
    save.profile.ownedItems.push({ itemId, quantity: safeQuantity, acquiredAt: now.toISOString() });
  }
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {string} itemId
 * @param {number} quantity
 * @returns {boolean}
 */
function removeInventoryItem(save, itemId, quantity) {
  const index = save.profile.ownedItems.findIndex((item) => item.itemId === itemId);
  if (index < 0 || save.profile.ownedItems[index].quantity < quantity) {
    return false;
  }
  save.profile.ownedItems[index].quantity -= quantity;
  if (save.profile.ownedItems[index].quantity <= 0) {
    save.profile.ownedItems.splice(index, 1);
  }
  return true;
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {string} type
 * @param {string} message
 * @param {Date} now
 * @param {unknown} [data]
 */
function addHamsterEvent(save, type, message, now, data) {
  save.eventHistory.push({
    id: `${type}-${now.getTime()}-${save.eventHistory.length}`,
    type,
    message,
    createdAt: now.toISOString(),
    data,
  });
  save.eventHistory = save.eventHistory.slice(-30);
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {string} type
 * @param {number} [amount]
 */
function incrementDailyTask(save, type, amount = 1) {
  for (const task of save.dailyTasks) {
    if (task.type === type && !task.claimed) {
      task.progress = Math.min(task.target, task.progress + amount);
    }
  }
}

/**
 * @param {import("./types").HamsterSaveData} save
 */
function refreshHamsterLevel(save) {
  const balance = getHamsterBalance();
  const levels = balance?.levelExperience ?? {};
  const cap = balance?.levelCap ?? 20;
  let level = 1;
  for (let candidate = 1; candidate <= cap; candidate += 1) {
    if (save.profile.experience >= safeAnyNumber(levels[candidate], 0)) {
      level = candidate;
    }
  }
  save.profile.level = level;
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {number} experience
 * @param {Date} now
 */
function addHamsterExperience(save, experience, now) {
  const before = save.profile.level;
  save.profile.experience = Math.max(0, Math.floor(save.profile.experience + Math.max(0, experience)));
  refreshHamsterLevel(save);
  if (save.profile.level > before) {
    addHamsterEvent(save, "level", `团团升到 ${save.profile.level} 级啦。`, now, { level: save.profile.level });
  }
}

/**
 * @param {import("./types").HamsterSaveData} save
 */
function unlockHamsterContent(save) {
  const balance = getHamsterBalance();
  if (!balance) {
    return;
  }
  const contentIds = new Set(save.unlockedContent);
  contentIds.add("room.default");
  for (const job of balance.jobs) {
    if (save.profile.level >= job.unlockLevel) {
      contentIds.add(job.id);
    }
  }
  for (const outing of balance.outings) {
    if (save.profile.level >= outing.unlockLevel) {
      contentIds.add(outing.id);
    }
  }
  for (const item of balance.shopItems) {
    if (!item.unlockLevel || save.profile.level >= item.unlockLevel) {
      contentIds.add(item.id);
    }
  }
  save.unlockedContent = [...contentIds];
}

/**
 * @param {import("./types").HamsterSaveData} save
 */
function refreshHamsterAchievements(save) {
  const balance = getHamsterBalance();
  if (!balance || !save.adopted) {
    return;
  }
  const achieved = new Set(save.profile.achievements);
  const collectionCount = save.profile.ownedItems.filter((item) => {
    const info = findHamsterItem(item.itemId);
    return info?.category === "outfit" || info?.category === "furniture";
  }).length;

  if (save.profile.statistics.totalFeedings > 0) achieved.add("hamster.first_feed");
  if (save.profile.statistics.totalBaths > 0) achieved.add("hamster.first_bath");
  if (save.profile.affection >= 60) achieved.add("hamster.affection_60");
  if (save.profile.statistics.totalWorkSessions > 0) achieved.add("hamster.first_work");
  if (save.profile.statistics.totalCoinsEarned >= 500) achieved.add("hamster.coins_500");
  if (save.gameRewardState.completedGameIds.length >= 5) achieved.add("hamster.games_5");
  if (save.profile.statistics.recordsWitnessed > 0) achieved.add("hamster.record");
  if ((balance.outings ?? []).every((outing) => save.unlockedContent.includes(outing.id))) achieved.add("hamster.all_outings");
  if (collectionCount >= 8) achieved.add("hamster.collector");
  if (save.profile.level >= 10) achieved.add("hamster.level_10");
  if (save.profile.level >= 20) achieved.add("hamster.level_20");
  save.profile.achievements = [...achieved];
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} now
 */
function resetHamsterDailyState(save, now) {
  const dateKey = getLocalDateKey(now);
  if (save.lastDailyResetDate === dateKey) {
    return;
  }
  save.dailyTasks = createDailyTasksForDate(dateKey);
  save.shopState = createShopState(dateKey);
  save.gameRewardState = {
    ...createGameRewardState(dateKey),
    firstPlayGameIds: save.gameRewardState.firstPlayGameIds,
    completedGameIds: save.gameRewardState.completedGameIds,
  };
  save.lastDailyResetDate = dateKey;
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} now
 * @returns {import("./types").HamsterSaveData}
 */
function applyHamsterTime(save, now) {
  if (!save.adopted) {
    return save;
  }
  const balance = getHamsterBalance();
  if (!balance) {
    return save;
  }
  const profile = save.profile;
  const last = parseTime(profile.lastUpdatedAt);
  const nowTime = now.getTime();

  if (!last || nowTime <= last) {
    if (nowTime + MS_PER_MINUTE < last) {
      addHamsterEvent(save, "time-warning", "检测到本地时间回退，本次离线变化已安全忽略。", new Date(last));
    }
    return save;
  }

  const elapsedMs = Math.min(nowTime - last, balance.offline.maxHours * MS_PER_HOUR);
  const elapsedHours = elapsedMs / MS_PER_HOUR;
  const activity = profile.currentActivity;
  let sleepHours = 0;
  let workHours = 0;
  let outingHours = 0;
  let studyHours = 0;
  let idleHours = elapsedHours;

  if (activity) {
    const startedAt = parseTime(activity.startedAt);
    const endsAt = parseTime(activity.endsAt);
    const activeStart = Math.max(last, startedAt);
    const activeEnd = Math.min(last + elapsedMs, endsAt);
    const activeHours = Math.max(0, activeEnd - activeStart) / MS_PER_HOUR;
    if (activity.type === "sleep") sleepHours = activeHours;
    if (activity.type === "work") workHours = activeHours;
    if (activity.type === "outing") outingHours = activeHours;
    if (activity.type === "study") studyHours = activeHours;
    idleHours = Math.max(0, elapsedHours - activeHours);
  }

  const hasComfyBed = getInventoryQuantity(save, "furniture.comfy_bed") > 0;
  const sleepBoost = hasComfyBed ? 1.08 : 1;
  const stress =
    profile.hunger <= 12 && profile.cleanliness <= 16 && profile.energy <= 10
      ? balance.decayPerHour.healthStress * elapsedHours
      : 0;

  profile.hunger = clamp(
    profile.hunger -
      balance.decayPerHour.hunger * idleHours -
      balance.decayPerHour.sleepHunger * sleepHours -
      (balance.decayPerHour.hunger + balance.decayPerHour.workHunger) * workHours -
      (balance.decayPerHour.hunger + balance.decayPerHour.outingHunger) * outingHours -
      balance.decayPerHour.hunger * studyHours,
    balance.offline.hungerFloor,
  );
  profile.cleanliness = clamp(
    profile.cleanliness -
      balance.decayPerHour.cleanliness * (idleHours + sleepHours) -
      (balance.decayPerHour.cleanliness + balance.decayPerHour.workCleanliness) * workHours -
      (balance.decayPerHour.cleanliness + balance.decayPerHour.outingCleanliness) * outingHours -
      balance.decayPerHour.cleanliness * studyHours,
    balance.offline.cleanlinessFloor,
  );
  profile.happiness = clamp(
    profile.happiness -
      balance.decayPerHour.happiness * elapsedHours -
      (profile.hunger <= 20 ? 0.65 * elapsedHours : 0) -
      (profile.cleanliness <= 20 ? 0.45 * elapsedHours : 0) -
      (profile.energy <= 12 ? 0.35 * elapsedHours : 0),
    balance.offline.happinessFloor,
  );
  profile.energy = clamp(
    profile.energy + balance.recoveryPerHour.sleepEnergy * sleepHours * sleepBoost + balance.recoveryPerHour.restEnergy * idleHours,
  );
  profile.health = clamp(
    profile.health + balance.recoveryPerHour.sleepHealth * sleepHours + balance.recoveryPerHour.restHealth * idleHours - stress,
    balance.offline.healthFloor,
  );

  if (activity?.type === "sleep" && nowTime >= parseTime(activity.endsAt)) {
    profile.currentActivity = undefined;
    profile.currentState = "resting";
  }

  if (!profile.currentActivity && ["eating", "bathing", "playing", "resting"].includes(profile.currentState) && elapsedMs > 2 * MS_PER_MINUTE) {
    profile.currentState = "idle";
  }

  profile.lastUpdatedAt = now.toISOString();
  return save;
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterSaveData}
 */
function getHamsterSaveData(now = new Date()) {
  const raw = readJson(HAMSTER_KEY, null);
  const save = normalizeHamsterSaveData(raw, now);
  resetHamsterDailyState(save, now);
  applyHamsterTime(save, now);
  refreshHamsterLevel(save);
  unlockHamsterContent(save);
  refreshHamsterAchievements(save);
  return save;
}

/**
 * @param {import("./types").HamsterSaveData} save
 */
function writeHamsterSaveData(save) {
  writeJson(HAMSTER_KEY, save);
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterSaveData}
 */
function syncHamsterSaveData(now = new Date()) {
  const raw = readJson(HAMSTER_KEY, null);
  const save = normalizeHamsterSaveData(raw, now);
  if (!save.adopted) {
    return save;
  }
  resetHamsterDailyState(save, now);
  applyHamsterTime(save, now);
  if (getSettings().hamsterAutoClaimRewards && isHamsterActivityComplete(save, now)) {
    claimHamsterActivityInternal(save, now, false, true);
  }
  refreshHamsterLevel(save);
  unlockHamsterContent(save);
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return save;
}

/**
 * @param {string} name
 * @param {Date} [now]
 * @returns {{ok: boolean; message: string; save: import("./types").HamsterSaveData}}
 */
function adoptHamster(name = "团团", now = new Date()) {
  const save = createDefaultHamsterSaveData(now);
  save.adopted = true;
  save.profile = createHamsterProfile(now, name);
  save.profile.achievements = ["hamster.created"];
  save.unlockedContent = ["room.default", "toy.ball", "food.basic_grain", "food.sunflower_seed", "food.water", "care.bath_gel"];
  addHamsterEvent(save, "adoption", `${save.profile.name} 从小纸箱里探出头，正式入住仓鼠屋。`, now);
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return { ok: true, message: `欢迎 ${save.profile.name} 入住 CREDIUS ARCADE。`, save };
}

/**
 * @param {string} name
 * @param {Date} [now]
 * @returns {{ok: boolean; message: string; save: import("./types").HamsterSaveData}}
 */
function renameHamster(name, now = new Date()) {
  const save = getHamsterSaveData(now);
  const trimmed = name.trim().slice(0, 12) || "团团";
  save.profile.name = trimmed;
  save.profile.lastInteractionAt = now.toISOString();
  addHamsterEvent(save, "profile", `仓鼠现在叫 ${trimmed}。`, now);
  writeHamsterSaveData(save);
  return { ok: true, message: `已经改名为 ${trimmed}。`, save };
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @returns {boolean}
 */
function hamsterHasExclusiveActivity(save) {
  const activity = save.profile.currentActivity;
  return Boolean(activity && activity.type !== "sleep");
}

/**
 * @param {string} itemId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function feedHamster(itemId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  const item = findHamsterItem(itemId);
  if (!save.adopted) return { ok: false, message: "小纸箱还没打开呢。", save };
  if (!balance || !item || item.category !== "food") return { ok: false, message: "这个不是可以喂的食物。", save };
  if (hamsterHasExclusiveActivity(save)) {
    return { ok: false, message: save.profile.currentActivity?.type === "study" ? "团团正在上课，课间再吃。" : "团团还在外面，回来后再吃。", save };
  }
  if (save.profile.hunger >= balance.action.feedFullThreshold) {
    return { ok: false, message: "吃不下啦，先玩一会儿吧。", save };
  }
  if (!removeInventoryItem(save, itemId, 1)) {
    return { ok: false, message: "背包里没有这个食物。", save };
  }

  const likeBonus = item.preference === "like" ? 3 : 0;
  save.profile.hunger = clamp(save.profile.hunger + safeAnyNumber(item.hunger, 0));
  save.profile.happiness = clamp(save.profile.happiness + safeAnyNumber(item.happiness, 0) + likeBonus);
  save.profile.health = clamp(save.profile.health + safeAnyNumber(item.health, 0));
  save.profile.affection = clamp(save.profile.affection + balance.action.feedAffection + (item.preference === "like" ? 1 : 0));
  save.profile.currentState = "eating";
  save.profile.statistics.totalFeedings += 1;
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterExperience(save, balance.action.feedExperience, now);
  incrementDailyTask(save, "feed");
  addHamsterEvent(save, "feed", `${save.profile.name} 吃掉了 ${item.name}。`, now, { itemId });
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return { ok: true, message: `${save.profile.name} 嚼得很认真。`, save, animation: "eating" };
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function bathHamster(now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  if (!save.adopted) return { ok: false, message: "先邀请仓鼠入住吧。", save };
  if (!balance) return { ok: false, message: "仓鼠屋暂时没有准备好。", save };
  if (hamsterHasExclusiveActivity(save)) {
    return { ok: false, message: save.profile.currentActivity?.type === "study" ? "团团正在学习，稍后再洗。" : "团团还在外面，回来后再洗。", save };
  }
  if (save.profile.cleanliness >= balance.action.bathCleanEnoughThreshold) {
    return { ok: false, message: "不需要再洗啦，毛毛已经很干净。", save };
  }
  const hasGel = removeInventoryItem(save, "care.bath_gel", 1);
  const bathBoost = getInventoryQuantity(save, "furniture.better_tub") > 0 ? 1.08 : 1;
  const cleanGain = (hasGel ? balance.action.bathCleanliness : 26) * bathBoost;

  save.profile.cleanliness = clamp(save.profile.cleanliness + cleanGain);
  save.profile.happiness = clamp(save.profile.happiness + balance.action.bathHappiness);
  save.profile.affection = clamp(save.profile.affection + balance.action.bathAffection);
  save.profile.currentState = "bathing";
  save.profile.statistics.totalBaths += 1;
  save.cooldowns.lastBathAt = now.toISOString();
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterExperience(save, balance.action.bathExperience, now);
  incrementDailyTask(save, "bath");
  addHamsterEvent(save, "bath", hasGel ? "泡泡散开，团团变得香喷喷。" : "清水澡完成，团团甩了甩毛。", now);
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return { ok: true, message: hasGel ? "泡泡洗澡完成。" : "没有浴液了，先洗个清水澡。", save, animation: "bathing" };
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function petHamster(now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  if (!save.adopted) return { ok: false, message: "纸箱里传来一点点动静。", save };
  if (!balance) return { ok: false, message: "仓鼠屋暂时没有准备好。", save };
  if (hamsterHasExclusiveActivity(save)) {
    return { ok: false, message: save.profile.currentActivity?.type === "study" ? "团团在认真听课，先给它一点专注时间。" : "现在摸不到，团团还在路上。", save };
  }

  const lastPet = parseTime(save.cooldowns.lastPetRewardAt ?? "");
  const cooling = lastPet && now.getTime() - lastPet < balance.action.petCooldownMs;
  const happinessGain = cooling ? 1 : balance.action.petHappiness;
  const affectionGain = cooling ? 0 : balance.action.petAffection;
  const experienceGain = cooling ? 0 : balance.action.petExperience;

  save.profile.happiness = clamp(save.profile.happiness + happinessGain);
  save.profile.affection = clamp(save.profile.affection + affectionGain);
  save.profile.currentState = cooling ? "resting" : "playing";
  save.profile.statistics.totalPettings += 1;
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  save.cooldowns.lastPetRewardAt = now.toISOString();
  addHamsterExperience(save, experienceGain, now);
  incrementDailyTask(save, "pet");
  addHamsterEvent(save, "pet", cooling ? "团团眯了眯眼，收益已经变少。" : "团团开心地蹦了一下。", now);
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return {
    ok: true,
    message: cooling ? "嘿嘿，再摸也舒服，但奖励要慢慢来。" : "嘿嘿，好舒服。",
    save,
    animation: cooling ? "shy" : "petting",
  };
}

/**
 * @param {string} toyId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function playHamster(toyId = "toy.ball", now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  const item = findHamsterItem(toyId);
  if (!save.adopted) return { ok: false, message: "先打开小纸箱吧。", save };
  if (!balance || !item || item.category !== "toy") return { ok: false, message: "这个玩具还不能玩。", save };
  if (hamsterHasExclusiveActivity(save)) return { ok: false, message: "团团现在有别的安排。", save };
  if (getInventoryQuantity(save, toyId) <= 0) return { ok: false, message: "还没有这个玩具。", save };
  const energyCost = safeAnyNumber(item.energyCost, balance.action.playEnergyCost);
  if (save.profile.energy < Math.max(balance.action.playEnergyMinimum, energyCost)) {
    return { ok: false, message: "精力不足，先休息一下吧。", save };
  }

  save.profile.energy = clamp(save.profile.energy - energyCost);
  save.profile.cleanliness = clamp(save.profile.cleanliness - 4);
  save.profile.happiness = clamp(save.profile.happiness + safeAnyNumber(item.happiness, balance.action.playHappiness));
  save.profile.affection = clamp(save.profile.affection + balance.action.playAffection);
  save.profile.currentState = "playing";
  save.profile.statistics.totalPlaySessions += 1;
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterExperience(save, balance.action.playExperience, now);
  incrementDailyTask(save, "play");
  addHamsterEvent(save, "play", `${save.profile.name} 玩了 ${item.name}。`, now, { toyId });
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return { ok: true, message: `${save.profile.name} 玩得很投入。`, save, animation: toyId.includes("wheel") ? "running" : "playing" };
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function startHamsterSleep(now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  if (!save.adopted) return { ok: false, message: "仓鼠还没入住。", save };
  if (!balance) return { ok: false, message: "仓鼠屋暂时没有准备好。", save };
  if (save.profile.currentActivity) return { ok: false, message: "团团现在已经有安排了。", save };
  if (save.profile.energy >= balance.action.sleepHighEnergyThreshold) {
    return { ok: false, message: "不困呢，等玩累一点再睡。", save };
  }
  const endsAt = new Date(now.getTime() + balance.action.sleepDurationMinutes * MS_PER_MINUTE);
  save.profile.currentActivity = {
    type: "sleep",
    activityId: "sleep.nap",
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    rewardClaimed: false,
  };
  save.profile.currentState = "sleeping";
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "sleep", `${save.profile.name} 钻进小床，开始补觉。`, now);
  writeHamsterSaveData(save);
  return { ok: true, message: "晚安，小仓鼠。", save, animation: "sleeping" };
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function wakeHamster(now = new Date()) {
  const save = getHamsterSaveData(now);
  const activity = save.profile.currentActivity;
  if (!activity || activity.type !== "sleep") {
    return { ok: false, message: "团团现在没有在睡觉。", save };
  }
  const sleptSeconds = Math.max(0, Math.round((Math.min(now.getTime(), parseTime(activity.endsAt)) - parseTime(activity.startedAt)) / 1000));
  save.profile.statistics.totalSleepTime += sleptSeconds;
  save.profile.currentActivity = undefined;
  save.profile.currentState = "resting";
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "wake", `${save.profile.name} 伸了个懒腰。`, now);
  writeHamsterSaveData(save);
  return { ok: true, message: "醒来啦，伸个懒腰。", save, animation: "waking" };
}

/**
 * @param {string} jobId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function startHamsterWork(jobId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  const job = balance?.jobs?.find((item) => item.id === jobId);
  if (!save.adopted) return { ok: false, message: "团团还没入住。", save };
  if (!balance || !job) return { ok: false, message: "没有找到这个工作。", save };
  if (save.profile.currentActivity) return { ok: false, message: "团团现在已经有安排了。", save };
  if (save.profile.level < job.unlockLevel) return { ok: false, message: `${job.title} 要 ${job.unlockLevel} 级解锁。`, save };
  if (job.requiredSkillId && !save.unlockedContent.includes(job.requiredSkillId)) {
    const study = balance.studies?.find((item) => item.skillId === job.requiredSkillId);
    return { ok: false, message: `先完成「${study?.title ?? "对应课程"}」再来应聘。`, save };
  }
  if (save.profile.energy < Math.max(balance.action.workMinimumEnergy, job.energyCost)) {
    return { ok: false, message: "精力不足，先睡一会儿吧。", save };
  }
  if (save.profile.hunger < balance.action.workMinimumHunger) {
    return { ok: false, message: "有点饿，吃点东西再去工作。", save };
  }
  const endsAt = new Date(now.getTime() + job.durationMinutes * MS_PER_MINUTE);
  save.profile.currentActivity = {
    type: "work",
    activityId: job.id,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    energyCost: job.energyCost,
    hungerCost: job.hungerCost,
    cleanlinessCost: job.cleanlinessCost,
    rewardClaimed: false,
    resultSeed: `${job.id}-${now.getTime()}`,
  };
  save.profile.currentState = "working";
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  incrementDailyTask(save, "work");
  addHamsterEvent(save, "work-start", `${save.profile.name} 出门去做「${job.title}」。`, now, { jobId });
  writeHamsterSaveData(save);
  return { ok: true, message: `${job.title} 开始啦，回来记得领奖。`, save, animation: "leaving" };
}

/**
 * @param {string} studyId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function startHamsterStudy(studyId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  const study = balance?.studies?.find((item) => item.id === studyId);
  if (!save.adopted) return { ok: false, message: "团团还没入住。", save };
  if (!balance || !study) return { ok: false, message: "没有找到这门课程。", save };
  if (save.profile.currentActivity) return { ok: false, message: "团团现在已经有安排了。", save };
  if (save.profile.level < study.unlockLevel) return { ok: false, message: `${study.title} 要 ${study.unlockLevel} 级开放。`, save };
  if (save.unlockedContent.includes(study.skillId)) return { ok: false, message: "这门课已经学会啦。", save };
  if (save.profile.energy < study.energyCost) return { ok: false, message: "精力不足，休息好再学习。", save };
  if (save.profile.hunger < Math.max(12, study.hungerCost)) return { ok: false, message: "先吃一点，学习才有精神。", save };

  const endsAt = new Date(now.getTime() + study.durationMinutes * MS_PER_MINUTE);
  save.profile.currentActivity = {
    type: "study",
    activityId: study.id,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    energyCost: study.energyCost,
    hungerCost: study.hungerCost,
    rewardClaimed: false,
    resultSeed: `${study.id}-${now.getTime()}`,
  };
  save.profile.currentState = "studying";
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "study-start", `${save.profile.name} 翻开了「${study.title}」课本。`, now, { studyId });
  writeHamsterSaveData(save);
  return { ok: true, message: `${study.title} 开课啦，离线也会继续学习。`, save, animation: "studying" };
}

/**
 * @param {string} outingId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function startHamsterOuting(outingId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  const outing = balance?.outings?.find((item) => item.id === outingId);
  if (!save.adopted) return { ok: false, message: "团团还没入住。", save };
  if (!balance || !outing) return { ok: false, message: "没有找到这个外出地点。", save };
  if (save.profile.currentActivity) return { ok: false, message: "团团现在已经有安排了。", save };
  if (save.profile.level < outing.unlockLevel) return { ok: false, message: `${outing.title} 要 ${outing.unlockLevel} 级解锁。`, save };
  if (save.profile.energy < Math.max(balance.action.outingMinimumEnergy, outing.energyCost)) {
    return { ok: false, message: "精力不足，先休息一下再出门。", save };
  }
  if (save.profile.hunger < balance.action.outingMinimumHunger) {
    return { ok: false, message: "先吃一点，路上才有力气。", save };
  }
  const endsAt = new Date(now.getTime() + outing.durationMinutes * MS_PER_MINUTE);
  save.profile.currentActivity = {
    type: "outing",
    activityId: outing.id,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    energyCost: outing.energyCost,
    hungerCost: outing.hungerCost,
    cleanlinessCost: outing.cleanlinessCost,
    rewardClaimed: false,
    resultSeed: `${outing.id}-${now.getTime()}`,
  };
  save.profile.currentState = "outing";
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "outing-start", `${save.profile.name} 出门去「${outing.title}」。`, now, { outingId });
  writeHamsterSaveData(save);
  return { ok: true, message: `${outing.title} 出发。`, save, animation: "leaving" };
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} now
 * @returns {boolean}
 */
function isHamsterActivityComplete(save, now = new Date()) {
  const activity = save.profile.currentActivity;
  return Boolean(activity && now.getTime() >= parseTime(activity.endsAt));
}

/**
 * @param {Date} [now]
 * @param {{early?: boolean}} [options]
 * @returns {import("./types").HamsterActionResult}
 */
function claimHamsterActivity(now = new Date(), options = {}) {
  const save = getHamsterSaveData(now);
  const result = claimHamsterActivityInternal(save, now, Boolean(options.early), false);
  writeHamsterSaveData(result.save);
  return result;
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} now
 * @param {boolean} early
 * @param {boolean} silent
 * @returns {import("./types").HamsterActionResult}
 */
function claimHamsterActivityInternal(save, now, early, silent) {
  const balance = getHamsterBalance();
  const activity = save.profile.currentActivity;
  if (!balance || !activity) {
    return { ok: false, message: "当前没有可领取的活动。", save };
  }
  if (activity.type === "sleep") {
    return wakeHamster(now);
  }
  const startedAt = parseTime(activity.startedAt);
  const endsAt = parseTime(activity.endsAt);
  const duration = Math.max(1, endsAt - startedAt);
  const elapsed = Math.max(0, Math.min(now.getTime(), endsAt) - startedAt);
  const completed = now.getTime() >= endsAt;
  if (!completed && !early) {
    return { ok: false, message: "还没完成呢，可以等等或提前结束。", save };
  }
  if (activity.rewardClaimed) {
    return { ok: false, message: "这次奖励已经领取过了。", save };
  }
  const factor = completed ? 1 : Math.max(0.2, Math.min(0.75, elapsed / duration));
  const seed = activity.resultSeed ?? `${activity.activityId}-${activity.startedAt}`;

  if (activity.type === "study") {
    const study = balance.studies?.find((item) => item.id === activity.activityId);
    if (!study) return { ok: false, message: "课程记录已经失效。", save };
    if (!completed) {
      save.profile.energy = clamp(save.profile.energy - Math.max(1, Math.round(study.energyCost * 0.2)));
      save.profile.hunger = clamp(save.profile.hunger - Math.max(0, Math.round(study.hungerCost * 0.2)));
      save.profile.currentState = "resting";
      save.profile.currentActivity = undefined;
      save.profile.lastInteractionAt = now.toISOString();
      save.profile.lastUpdatedAt = now.toISOString();
      addHamsterEvent(save, "study-pause", `${save.profile.name} 合上了「${study.title}」课本，下次可以重新开始。`, now, { studyId: study.id });
      return { ok: true, message: "课程暂停了，没有惩罚，下次可以重新开始。", save, animation: "resting" };
    }
    if (!save.unlockedContent.includes(study.skillId)) {
      save.unlockedContent.push(study.skillId);
    }
    save.profile.energy = clamp(save.profile.energy - study.energyCost);
    save.profile.hunger = clamp(save.profile.hunger - study.hungerCost);
    save.profile.happiness = clamp(save.profile.happiness + 4);
    save.profile.affection = clamp(save.profile.affection + 2);
    addHamsterExperience(save, study.experience, now);
    addHamsterEvent(save, "study-finish", `${save.profile.name} 学会了「${study.title}」，新的工作机会亮起来了。`, now, {
      studyId: study.id,
      skillId: study.skillId,
      jobId: study.unlocksJobId,
    });
    save.profile.currentState = "resting";
    save.profile.currentActivity = undefined;
    save.profile.lastInteractionAt = now.toISOString();
    save.profile.lastUpdatedAt = now.toISOString();
    return {
      ok: true,
      message: `学会「${study.title}」，解锁新的高级工作。`,
      save,
      reward: { experience: study.experience },
      animation: "celebrating",
    };
  }

  if (activity.type === "work") {
    const job = balance.jobs.find((item) => item.id === activity.activityId);
    if (!job) return { ok: false, message: "工作记录已经失效。", save };
    let coins = Math.round(job.baseCoins * factor);
    const event = getWorkEvent(job, seed);
    coins = Math.max(0, coins + event.coinDelta);
    const experience = Math.max(1, Math.round((job.experience + event.experienceDelta) * factor));
    save.profile.coins += coins;
    save.profile.energy = clamp(save.profile.energy - job.energyCost * factor);
    save.profile.hunger = clamp(save.profile.hunger - job.hungerCost * factor);
    save.profile.cleanliness = clamp(save.profile.cleanliness - job.cleanlinessCost * factor);
    save.profile.happiness = clamp(save.profile.happiness + event.happinessDelta);
    save.profile.statistics.totalWorkSessions += completed ? 1 : 0;
    save.profile.statistics.totalCoinsEarned += coins;
    addHamsterExperience(save, experience, now);
    if (job.materialItemId && seededUnit(seed) < (job.materialChance ?? 0)) {
      addInventoryItem(save, job.materialItemId, 1, now);
    }
    addHamsterEvent(save, "work-finish", silent ? `自动领取了 ${job.title} 的 ${coins} 仓鼠币。` : event.message, now, { coins, jobId: job.id });
    save.profile.currentState = "resting";
    save.profile.currentActivity = undefined;
    save.profile.lastInteractionAt = now.toISOString();
    save.profile.lastUpdatedAt = now.toISOString();
    refreshHamsterAchievements(save);
    return { ok: true, message: early ? `提前结束，获得 ${coins} 仓鼠币。` : `工作完成，获得 ${coins} 仓鼠币。`, save, reward: { coins, experience }, animation: "returning" };
  }

  const outing = balance.outings.find((item) => item.id === activity.activityId);
  if (!outing) return { ok: false, message: "外出记录已经失效。", save };
  const collectible = outing.collectibleItemId && seededUnit(seed) < (outing.collectibleChance ?? 0);
  save.profile.energy = clamp(save.profile.energy - outing.energyCost * factor);
  save.profile.hunger = clamp(save.profile.hunger - outing.hungerCost * factor);
  save.profile.cleanliness = clamp(save.profile.cleanliness - outing.cleanlinessCost * factor);
  save.profile.happiness = clamp(save.profile.happiness + outing.happiness * factor);
  save.profile.affection = clamp(save.profile.affection + outing.affection * factor);
  save.profile.statistics.totalOutings += completed ? 1 : 0;
  addHamsterExperience(save, Math.round(outing.experience * factor), now);
  if (collectible && outing.collectibleItemId) {
    addInventoryItem(save, outing.collectibleItemId, 1, now);
  }
  incrementDailyTask(save, "outing");
  addHamsterEvent(save, "outing-finish", getOutingEventMessage(outing, seed, collectible), now, {
    outingId: outing.id,
    collectibleItemId: collectible ? outing.collectibleItemId : "",
  });
  save.profile.currentState = "resting";
  save.profile.currentActivity = undefined;
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  refreshHamsterAchievements(save);
  return {
    ok: true,
    message: collectible ? "外出归来，还带回了一件小收藏。" : "外出归来，心情变亮了。",
    save,
    reward: { experience: Math.round(outing.experience * factor), itemId: collectible ? outing.collectibleItemId : undefined },
    animation: "returning",
  };
}

/**
 * @param {Record<string, unknown>} job
 * @param {string} seed
 * @returns {{message: string; coinDelta: number; experienceDelta: number; happinessDelta: number}}
 */
function getWorkEvent(job, seed) {
  const roll = seededUnit(seed);
  if (roll < 0.18) return { message: "帮客人找回了遗失物品，获得额外奖励。", coinDelta: 8, experienceDelta: 0, happinessDelta: 1 };
  if (roll < 0.32) return { message: "偷吃零食被发现，奖励少了一点，但团团很满足。", coinDelta: -5, experienceDelta: 0, happinessDelta: 3 };
  if (roll < 0.52) return { message: "得到顾客表扬，经验增加。", coinDelta: 0, experienceDelta: 8, happinessDelta: 2 };
  if (roll < 0.68) return { message: "工作太累，快乐度略微降低。", coinDelta: 0, experienceDelta: 0, happinessDelta: -3 };
  if (roll < 0.84) return { message: "提前整理完任务，获得小额奖金。", coinDelta: 6, experienceDelta: 2, happinessDelta: 0 };
  return { message: `${job.title} 完成，团团带着小步子回来了。`, coinDelta: 0, experienceDelta: 0, happinessDelta: 1 };
}

/**
 * @param {Record<string, unknown>} outing
 * @param {string} seed
 * @param {boolean} collectible
 * @returns {string}
 */
function getOutingEventMessage(outing, seed, collectible) {
  if (collectible) {
    return `在「${outing.title}」带回了一件小收藏。`;
  }
  const events = ["看了一会儿风，心情变轻了。", "找到一条很适合小短腿的路线。", "对路边的影子挥了挥手。", "回家前认真整理了腮帮。"];
  return events[hashString(seed) % events.length];
}

/**
 * @param {string} itemId
 * @param {number} [quantity]
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function buyHamsterItem(itemId, quantity = 1, now = new Date()) {
  const save = getHamsterSaveData(now);
  const item = findHamsterItem(itemId);
  if (!save.adopted) return { ok: false, message: "仓鼠还没入住，商店暂时不开张。", save };
  if (!item || !safeNumber(item.price)) return { ok: false, message: "这个商品暂时不能购买。", save };
  const count = Math.max(1, Math.floor(quantity));
  const maxOwned = Math.max(1, Math.floor(safeAnyNumber(item.maxOwned, 99)));
  const owned = getInventoryQuantity(save, itemId);
  if (save.profile.level < safeAnyNumber(item.unlockLevel, 1)) return { ok: false, message: `${item.name} 要 ${item.unlockLevel} 级解锁。`, save };
  if (owned >= maxOwned) return { ok: false, message: "这件物品已经拥有了。", save };
  const finalCount = Math.min(count, maxOwned - owned);
  const discounted = save.shopState.discountItemId === itemId ? save.shopState.discountRate : 1;
  const totalPrice = Math.ceil(safeAnyNumber(item.price, 0) * discounted * finalCount);
  if (save.profile.coins < totalPrice) return { ok: false, message: "仓鼠币不足。", save };

  save.profile.coins -= totalPrice;
  save.profile.statistics.totalCoinsSpent += totalPrice;
  addInventoryItem(save, itemId, finalCount, now);
  save.shopState.purchases.push(`${itemId}:${now.getTime()}`);
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "shop", `购买了 ${item.name}。`, now, { itemId, quantity: finalCount, price: totalPrice });
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return { ok: true, message: `买到 ${item.name}。`, save, reward: { itemId, quantity: finalCount } };
}

/**
 * @param {string} itemId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function useHamsterConsumable(itemId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const item = findHamsterItem(itemId);
  if (!save.adopted) return { ok: false, message: "仓鼠还没入住。", save };
  if (!item || item.category !== "consumable") return { ok: false, message: "这个物品不能直接使用。", save };
  if (!removeInventoryItem(save, itemId, 1)) return { ok: false, message: "背包里没有这个物品。", save };
  save.profile.health = clamp(save.profile.health + safeAnyNumber(item.health, 0));
  save.profile.cleanliness = clamp(save.profile.cleanliness + safeAnyNumber(item.cleanliness, 0));
  save.profile.happiness = clamp(save.profile.happiness + safeAnyNumber(item.happiness, 0));
  save.profile.currentState = "resting";
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "item", `${save.profile.name} 使用了 ${item.name}。`, now, { itemId });
  writeHamsterSaveData(save);
  return { ok: true, message: `${item.name} 已使用。`, save };
}

/**
 * @param {string} itemId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function equipHamsterItem(itemId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const item = findHamsterItem(itemId);
  if (!save.adopted) return { ok: false, message: "仓鼠还没入住。", save };
  if (!item) return { ok: false, message: "没有找到这件物品。", save };
  if (getInventoryQuantity(save, itemId) <= 0) return { ok: false, message: "背包里还没有这件物品。", save };
  if (item.category === "outfit") {
    save.profile.activeOutfitId = itemId;
  } else if (item.category === "room") {
    save.profile.activeRoomThemeId = itemId;
  } else {
    return { ok: false, message: "这件物品不能装备。", save };
  }
  save.profile.lastInteractionAt = now.toISOString();
  save.profile.lastUpdatedAt = now.toISOString();
  addHamsterEvent(save, "equip", item.category === "room" ? `切换到 ${item.name}。` : `换上了 ${item.name}。`, now, { itemId });
  writeHamsterSaveData(save);
  return { ok: true, message: item.category === "room" ? "房间已经布置好。" : "换装完成。", save };
}

/**
 * @param {string} taskId
 * @param {Date} [now]
 * @returns {import("./types").HamsterActionResult}
 */
function claimHamsterDailyTask(taskId, now = new Date()) {
  const save = getHamsterSaveData(now);
  const balance = getHamsterBalance();
  const task = save.dailyTasks.find((item) => item.taskId === taskId);
  if (!save.adopted) return { ok: false, message: "仓鼠还没入住。", save };
  if (!balance || !task) return { ok: false, message: "没有找到这个任务。", save };
  if (task.claimed) return { ok: false, message: "这个任务已经领取过了。", save };
  if (task.progress < task.target) return { ok: false, message: "任务还没完成。", save };
  task.claimed = true;
  save.profile.coins += balance.dailyTaskReward.coins;
  save.profile.statistics.totalCoinsEarned += balance.dailyTaskReward.coins;
  addHamsterExperience(save, balance.dailyTaskReward.experience, now);
  addHamsterEvent(save, "daily", `完成每日任务「${task.title}」。`, now, { taskId });
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return { ok: true, message: `领取 ${balance.dailyTaskReward.coins} 仓鼠币。`, save };
}

/**
 * @param {string} gameId
 * @param {{score?: number; playTime?: number; bestTime?: number; highestLevel?: number; roundId?: string}} result
 * @param {boolean} newHighScore
 * @param {Date} [now]
 * @returns {import("./types").HamsterMiniGameReward | null}
 */
function applyHamsterMiniGameReward(gameId, result, newHighScore, now = new Date()) {
  const raw = readJson(HAMSTER_KEY, null);
  const save = normalizeHamsterSaveData(raw, now);
  const balance = getHamsterBalance();
  if (!save.adopted || !balance) {
    return null;
  }
  resetHamsterDailyState(save, now);
  applyHamsterTime(save, now);
  const roundId = safeString(result.roundId) || `${gameId}:${now.toISOString()}:${Math.round(safeAnyNumber(result.score, 0))}:${Math.round(safeAnyNumber(result.playTime, 0))}`;
  if (save.gameRewardState.rewardedRoundIds.includes(roundId)) {
    return { coins: 0, experience: 0, itemId: "", message: "这一局已经结算过仓鼠奖励。", softCapped: false };
  }
  save.gameRewardState.rewardedRoundIds.push(roundId);
  save.gameRewardState.rewardedRoundIds = save.gameRewardState.rewardedRoundIds.slice(-80);

  const score = safeAnyNumber(result.score, 0);
  const playTime = safeAnyNumber(result.playTime, 0);
  const effective =
    playTime >= balance.miniGame.effectiveMinSeconds ||
    score >= balance.miniGame.effectiveMinScore ||
    safeAnyNumber(result.bestTime, 0) > 0 ||
    safeAnyNumber(result.highestLevel, 0) > 0;
  if (!effective) {
    writeHamsterSaveData(save);
    return { coins: 0, experience: 0, itemId: "", message: "这局太短，团团只挥了挥手。", softCapped: false };
  }

  const firstPlay = !save.gameRewardState.firstPlayGameIds.includes(gameId);
  const firstCompletion = !save.gameRewardState.completedGameIds.includes(gameId);
  let normalCoins = firstPlay ? balance.miniGame.firstPlayCoins : balance.miniGame.normalCoins;
  let normalExperience = firstPlay ? balance.miniGame.firstPlayExperience : balance.miniGame.normalExperience;
  if (!firstPlay && save.gameRewardState.normalCoinsEarned >= balance.miniGame.dailyNormalCap) {
    normalCoins = balance.miniGame.repeatCoins;
    normalExperience = balance.miniGame.repeatExperience;
  }
  const normalAllowed = Math.max(0, balance.miniGame.dailyNormalCap - save.gameRewardState.normalCoinsEarned);
  const grantedNormalCoins = Math.min(normalCoins, normalAllowed || balance.miniGame.repeatCoins);
  let extraCoins = 0;
  let extraExperience = 0;
  if (newHighScore) {
    const extraAllowed = Math.max(0, balance.miniGame.dailyExtraCap - save.gameRewardState.extraCoinsEarned);
    extraCoins = Math.min(balance.miniGame.newRecordCoins, extraAllowed);
    extraExperience = extraCoins ? balance.miniGame.newRecordExperience : 0;
    save.profile.statistics.recordsWitnessed += 1;
    incrementDailyTask(save, "record");
  }

  if (firstPlay) save.gameRewardState.firstPlayGameIds.push(gameId);
  if (firstCompletion) save.gameRewardState.completedGameIds.push(gameId);
  save.gameRewardState.normalCoinsEarned += grantedNormalCoins;
  save.gameRewardState.extraCoinsEarned += extraCoins;
  save.profile.coins += grantedNormalCoins + extraCoins;
  save.profile.statistics.totalCoinsEarned += grantedNormalCoins + extraCoins;
  save.profile.statistics.miniGamesCompleted += 1;
  save.profile.happiness = clamp(save.profile.happiness + 2 + (newHighScore ? 3 : 0));
  save.profile.affection = clamp(save.profile.affection + (newHighScore ? 2 : 1));
  addHamsterExperience(save, normalExperience + extraExperience, now);
  incrementDailyTask(save, "miniGame");

  let itemId = "";
  const themed = balance.themedMiniGameItems?.[gameId];
  if (firstCompletion && themed?.itemId && getInventoryQuantity(save, themed.itemId) <= 0) {
    itemId = themed.itemId;
    addInventoryItem(save, themed.itemId, 1, now);
  }
  const coins = grantedNormalCoins + extraCoins;
  const message = newHighScore
    ? `${save.profile.name} 见证了新纪录，获得 ${coins} 仓鼠币。`
    : `${save.profile.name} 看完一局，获得 ${coins} 仓鼠币。`;
  addHamsterEvent(save, "mini-game", message, now, { gameId, coins, itemId, newHighScore });
  save.profile.lastUpdatedAt = now.toISOString();
  refreshHamsterAchievements(save);
  writeHamsterSaveData(save);
  return {
    coins,
    experience: normalExperience + extraExperience,
    itemId,
    message,
    softCapped: grantedNormalCoins < normalCoins || (newHighScore && extraCoins < balance.miniGame.newRecordCoins),
  };
}

/**
 * @returns {string}
 */
function exportHamsterData() {
  return JSON.stringify(getHamsterSaveData(), null, 2);
}

/**
 * @param {string} json
 * @param {Date} [now]
 * @returns {{ok: boolean; message: string; save: import("./types").HamsterSaveData}}
 */
function importHamsterData(json, now = new Date()) {
  try {
    const parsed = JSON.parse(json);
    const save = normalizeHamsterSaveData(parsed, now);
    if (!save.adopted) {
      return { ok: false, message: "导入内容里没有有效的仓鼠存档。", save };
    }
    writeHamsterSaveData(save);
    return { ok: true, message: "仓鼠存档已导入。", save };
  } catch {
    const save = getHamsterSaveData(now);
    return { ok: false, message: "导入失败，JSON 内容无法读取。", save };
  }
}

/**
 * @param {Date} [now]
 * @returns {import("./types").HamsterSaveData}
 */
function resetHamsterData(now = new Date()) {
  const save = createDefaultHamsterSaveData(now);
  writeHamsterSaveData(save);
  return save;
}

/**
 * @param {Date} [now]
 * @returns {ReturnType<typeof getHamsterDerivedStatus>}
 */
function getHamsterStatus(now = new Date()) {
  return getHamsterDerivedStatus(getHamsterSaveData(now), now);
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} [now]
 */
function getHamsterDerivedStatus(save, now = new Date()) {
  const profile = save.profile;
  const nextLevelExp = getHamsterBalance()?.levelExperience?.[Math.min((getHamsterBalance()?.levelCap ?? 20), profile.level + 1)] ?? profile.experience;
  const currentLevelExp = getHamsterBalance()?.levelExperience?.[profile.level] ?? 0;
  const activity = profile.currentActivity;
  const activityEnd = activity ? parseTime(activity.endsAt) : 0;
  const activityStart = activity ? parseTime(activity.startedAt) : 0;
  const activityProgress = activity ? clamp(((now.getTime() - activityStart) / Math.max(1, activityEnd - activityStart)) * 100, 0, 100) : 0;
  const emotion = getHamsterEmotion(save);
  return {
    adopted: save.adopted,
    emotion,
    activityComplete: isHamsterActivityComplete(save, now),
    activityProgress,
    levelProgress:
      nextLevelExp <= currentLevelExp ? 100 : clamp(((profile.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100, 0, 100),
    statusLabels: {
      hunger: getMeterLabel("hunger", profile.hunger),
      cleanliness: getMeterLabel("cleanliness", profile.cleanliness),
      energy: getMeterLabel("energy", profile.energy),
      happiness: getMeterLabel("happiness", profile.happiness),
      health: getMeterLabel("health", profile.health),
    },
    notice: getHamsterNotice(save, now),
  };
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @returns {string}
 */
function getHamsterEmotion(save) {
  const profile = save.profile;
  if (profile.health <= 35) return "不舒服";
  if (profile.hunger <= 18) return "饥饿";
  if (profile.cleanliness <= 18) return "很脏";
  if (profile.energy <= 16 || profile.currentActivity?.type === "sleep") return "困倦";
  if (profile.currentState === "working" || profile.currentState === "outing" || profile.currentState === "studying") return "兴奋";
  if (profile.happiness >= 78) return "开心";
  if (profile.happiness <= 32) return "委屈";
  return "普通";
}

/**
 * @param {string} type
 * @param {number} value
 * @returns {string}
 */
function getMeterLabel(type, value) {
  if (type === "hunger") {
    if (value >= 70) return "饱足";
    if (value >= 40) return "正常";
    if (value >= 20) return "有点饿";
    if (value > 0) return "很饿";
    return "最低";
  }
  if (type === "cleanliness") {
    if (value >= 70) return "清爽";
    if (value >= 40) return "还不错";
    if (value >= 20) return "有点乱";
    return "想洗澡";
  }
  if (type === "energy") {
    if (value >= 70) return "精神";
    if (value >= 40) return "够用";
    if (value >= 20) return "有点累";
    return "困了";
  }
  if (type === "happiness") {
    if (value >= 70) return "开心";
    if (value >= 40) return "平稳";
    if (value >= 20) return "想陪伴";
    return "低落";
  }
  if (value >= 70) return "健康";
  if (value >= 40) return "需照顾";
  return "不舒服";
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} now
 * @returns {string}
 */
function getHamsterNotice(save, now) {
  if (!save.adopted) return "小纸箱里好像有动静。";
  if (isHamsterActivityComplete(save, now)) {
    const activity = save.profile.currentActivity;
    return activity?.type === "work"
      ? "工作完成，可以领取仓鼠币。"
      : activity?.type === "outing"
        ? "外出归来，有故事可以听。"
        : activity?.type === "study"
          ? "课程学完啦，可以掌握新技能。"
          : "团团睡醒啦。";
  }
  if (save.profile.hunger <= 22) return "团团有点饿。";
  if (save.profile.cleanliness <= 22) return "团团想洗澡。";
  if (save.profile.energy <= 18) return "团团精力不足。";
  return pickHamsterBubble(save, now);
}

/**
 * @param {import("./types").HamsterSaveData} save
 * @param {Date} now
 * @returns {string}
 */
function pickHamsterBubble(save, now) {
  const balance = getHamsterBalance();
  const bubbles = balance?.bubbles;
  if (!bubbles) return "今天也要一起玩！";
  if (save.profile.hunger <= 25) return bubbles.hungry[hashString(save.profile.lastInteractionAt) % bubbles.hungry.length];
  if (save.profile.cleanliness <= 25) return bubbles.dirty[hashString(save.profile.lastUpdatedAt) % bubbles.dirty.length];
  if (save.profile.energy <= 20) return bubbles.tired[hashString(save.profile.id) % bubbles.tired.length];
  const hour = now.getHours();
  const pool = hour < 5 ? bubbles.night : hour < 11 ? bubbles.morning : hour < 17 ? bubbles.noon : hour < 22 ? bubbles.evening : bubbles.night;
  return pool[hashString(`${save.profile.id}-${getLocalDateKey(now)}-${Math.floor(hour / 3)}`) % pool.length];
}

/**
 * @param {Record<string, GameRecord>} records
 * @returns {{totalPlays: number; totalPlayTime: number; triedGames: number; unlockedAchievements: number}}
 */
function getPlayerSummary(records) {
  const values = Object.values(records);
  const totalPlays = values.reduce((sum, record) => sum + record.totalPlays, 0);
  const totalPlayTime = values.reduce((sum, record) => sum + record.totalPlayTime, 0);
  const triedGames = values.filter((record) => record.totalPlays > 0).length;
  const unlockedAchievements =
    (totalPlays > 0 ? 1 : 0) +
    (totalPlays >= 10 ? 1 : 0) +
    (values.some((record) => record.highScore >= 1000) ? 1 : 0) +
    (values.some((record) => record.favorite) ? 1 : 0) +
    (triedGames >= 3 ? 1 : 0);

  return { totalPlays, totalPlayTime, triedGames, unlockedAchievements };
}

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatPlayTime(seconds) {
  if (!seconds) {
    return "0 分钟";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes || 1} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
}

/**
 * @param {string} isoDate
 * @returns {string}
 */
function formatRelativeTime(isoDate) {
  if (!isoDate) {
    return "尚未游玩";
  }
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) {
    return "尚未游玩";
  }
  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "刚刚";
  }
  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }
  if (diff < day * 7) {
    return `${Math.floor(diff / day)} 天前`;
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(time);
}

/**
 * @param {number} score
 * @returns {string}
 */
function formatScore(score) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(score)));
}

/**
 * @param {GameRecord[]} records
 * @param {"recent" | "score" | "plays" | "title"} sortBy
 * @param {(gameId: string) => string} titleFor
 * @returns {GameRecord[]}
 */
function sortRecords(records, sortBy, titleFor) {
  const copy = records.slice();
  copy.sort((a, b) => {
    if (sortBy === "score") {
      return b.highScore - a.highScore;
    }
    if (sortBy === "plays") {
      return b.totalPlays - a.totalPlays;
    }
    if (sortBy === "title") {
      return titleFor(a.gameId).localeCompare(titleFor(b.gameId), "zh-CN");
    }
    return new Date(b.lastPlayedAt || 0).getTime() - new Date(a.lastPlayedAt || 0).getTime();
  });
  return copy;
}

globalThis.CrediusArcadeStorage = {
  HAMSTER_KEY,
  RECORDS_KEY,
  SETTINGS_KEY,
  adoptHamster,
  applyHamsterMiniGameReward,
  bathHamster,
  buyHamsterItem,
  clearAllLocalData,
  clearAllRecords,
  clearGameRecord,
  claimHamsterActivity,
  claimHamsterDailyTask,
  createDefaultRecord,
  createDefaultHamsterSaveData,
  equipHamsterItem,
  exportHamsterData,
  feedHamster,
  formatPlayTime,
  formatRelativeTime,
  formatScore,
  getAllRecords,
  getGameRecord,
  getHamsterSaveData,
  getHamsterStatus,
  getPlayerSummary,
  getSettings,
  importHamsterData,
  petHamster,
  playHamster,
  renameHamster,
  resetHamsterData,
  saveGameResult,
  setFavorite,
  sortRecords,
  startHamsterOuting,
  startHamsterSleep,
  startHamsterStudy,
  startHamsterWork,
  syncHamsterSaveData,
  updateSettings,
  useHamsterConsumable,
  wakeHamster,
};
})();
