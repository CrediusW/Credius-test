// @ts-check

(function () {
  "use strict";

const {
  availableGameCount,
  categoryFilters,
  findGame,
  gameDefinitions,
  getCategoryLabel,
} = globalThis.CrediusArcadeRegistry;
const {
  adoptHamster,
  bathHamster,
  buyHamsterItem,
  clearAllLocalData,
  clearGameRecord,
  claimHamsterActivity,
  claimHamsterDailyTask,
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
} = globalThis.CrediusArcadeStorage;

const hamsterBalance = globalThis.CrediusHamsterBalance;
const campaign = globalThis.CrediusArcadeCampaign;
const versionManifest = globalThis.CrediusArcadeVersions;

const gameIds = gameDefinitions.map((game) => game.id);

const elements = {
  sidebar: must("#sidebar"),
  drawerBackdrop: must("#drawerBackdrop"),
  menuButton: must("#menuButton"),
  searchToggle: must("#searchToggle"),
  soundToggle: must("#soundToggle"),
  settingsButton: must("#settingsButton"),
  searchPanel: must("#searchPanel"),
  searchInput: /** @type {HTMLInputElement} */ (must("#searchInput")),
  hamsterPanel: must("#hamsterPanel"),
  categoryScroller: must("#categoryScroller"),
  gameGrid: must("#gameGrid"),
  resultCount: must("#resultCount"),
  allGameCount: must("#allGameCount"),
  recentGameName: must("#recentGameName"),
  recentGameScore: must("#recentGameScore"),
  quickStartButton: must("#quickStartButton"),
  quickStartGameName: must("#quickStartGameName"),
  homeAchievementCount: must("#homeAchievementCount"),
  campaignCoins: must("#campaignCoins"),
  campaignStars: must("#campaignStars"),
  campaignCleared: must("#campaignCleared"),
  totalPlays: must("#totalPlays"),
  totalPlayTime: must("#totalPlayTime"),
  triedGames: must("#triedGames"),
  achievementCount: must("#achievementCount"),
  nicknameInput: /** @type {HTMLInputElement} */ (must("#nicknameInput")),
  recordSort: /** @type {HTMLSelectElement} */ (must("#recordSort")),
  scoreList: must("#scoreList"),
  detailLayer: must("#detailLayer"),
  detailContent: must("#detailContent"),
  closeDetail: must("#closeDetail"),
  utilityLayer: must("#utilityLayer"),
  utilityContent: must("#utilityContent"),
  closeUtility: must("#closeUtility"),
  playOverlay: must("#playOverlay"),
  closePlayer: must("#closePlayer"),
  playerTitle: must("#playerTitle"),
  playerMode: must("#playerMode"),
  compactHamsterSlot: must("#compactHamsterSlot"),
  fullscreenButton: must("#fullscreenButton"),
  openStandalone: /** @type {HTMLAnchorElement} */ (must("#openStandalone")),
  playerLoading: must("#playerLoading"),
  gameFrame: /** @type {HTMLIFrameElement} */ (must("#gameFrame")),
  roamingHamster: must("#roamingHamster"),
};

const fullscreenSupported = typeof elements.playOverlay.requestFullscreen === "function";
elements.fullscreenButton.hidden = !fullscreenSupported;
elements.playOverlay.classList.toggle("fullscreen-unavailable", !fullscreenSupported);

const state = {
  category: "all",
  query: "",
  recordSort: "recent",
  detailGameId: "",
  hamsterTool: "",
  hamsterMessage: "",
  hamsterAnimation: "",
  hamsterLastReaction: "",
  hamsterHouseTab: "care",
  hamsterTransferText: "",
  utilityView: "",
  companionMenuOpen: false,
  companionSpeech: "",
  companionPose: "idle",
  companionPosition: null,
  companionLastSpeech: "",
  selectedLevels: {},
  campaignMessage: "",
};

let hamsterEffectTimer = 0;
let companionSpeechTimer = 0;
let companionBehaviorTimer = 0;
let companionPoseTimer = 0;
let companionDrag = null;
let companionLastPointerToggleAt = 0;

function must(selector) {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing element ${selector}`);
  }
  return /** @type {HTMLElement} */ (node);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * @param {string} itemId
 * @returns {Record<string, unknown> | undefined}
 */
function getHamsterItemInfo(itemId) {
  const shopItem = hamsterBalance.shopItems.find((item) => item.id === itemId);
  if (shopItem) {
    return shopItem;
  }
  const themed = Object.values(hamsterBalance.themedMiniGameItems).find((item) => item.itemId === itemId);
  if (themed) {
    return {
      id: themed.itemId,
      icon: themed.icon,
      name: themed.name,
      category: "collection",
      description: "小游戏联动纪念物。",
      maxOwned: 1,
    };
  }
  if (itemId === "room.default") {
    return {
      id: "room.default",
      icon: "屋",
      name: "默认温暖小屋",
      category: "room",
      description: "免费默认房间。",
      maxOwned: 1,
    };
  }
  if (itemId.startsWith("material.")) {
    return {
      id: itemId,
      icon: "材",
      name: "装饰材料",
      category: "material",
      description: "创意工作室带回的小材料。",
    };
  }
  if (itemId.startsWith("collectible.")) {
    return {
      id: itemId,
      icon: "藏",
      name: "外出收藏",
      category: "collection",
      description: "外出时捡到的小纪念。",
    };
  }
  return undefined;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @param {string} itemId
 * @returns {number}
 */
function getOwnedQuantity(save, itemId) {
  return save.profile.ownedItems.find((item) => item.itemId === itemId)?.quantity ?? 0;
}

/**
 * @param {string} name
 * @param {string} [className]
 * @returns {string}
 */
function renderHamsterIcon(name, className = "") {
  const paths = {
    feed: `<path d="M4 11h16l-2 8H6z"/><path d="M7 7c2.5 0 3.5 1.5 5 4M17 6c-3 0-4 2-5 5"/><path d="M17 4c0 2-1 3-3 3 0-2 1-3 3-3z"/>`,
    bath: `<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M7 12V8a3 3 0 0 1 6 0"/><circle cx="17" cy="6" r="2"/><circle cx="20" cy="9" r="1"/>`,
    pet: `<path d="M7 12V7a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5c0 4-3 7-7 7-5 0-8-3-8-7v-2a1.5 1.5 0 0 1 3 0z"/>`,
    play: `<circle cx="12" cy="13" r="7"/><path d="M5 13h14M12 6c2 2 3 4 3 7s-1 5-3 7M12 6c-2 2-3 4-3 7s1 5 3 7"/><path d="m19 4 .6 1.4L21 6l-1.4.6L19 8l-.6-1.4L17 6l1.4-.6z"/>`,
    sleep: `<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"/><path d="M15 4h5l-5 5h5"/>`,
    outing: `<path d="M5 9h14l1 11H4z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M12 13v4M10 15h4"/>`,
    work: `<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/>`,
    home: `<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>`,
    care: `<path d="M12 21s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.3-8 11-8 11z"/>`,
    shop: `<path d="M5 9h14l1 11H4zM8 9a4 4 0 0 1 8 0"/><path d="M9 14h6"/>`,
    bag: `<path d="M4 8h16v12H4z"/><path d="M8 8V5h8v3M4 12h16"/><circle cx="12" cy="12" r="1"/>`,
    tasks: `<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM8 11l2 2 4-4M8 17h8"/>`,
    study: `<path d="M4 5.5A3.5 3.5 0 0 1 7.5 3H11v16H7.5A3.5 3.5 0 0 0 4 21.5z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 3H13v16h3.5a3.5 3.5 0 0 1 3.5 2.5z"/><path d="M7 8h2M15 8h2M15 12h2"/>`,
    coin: `<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.7-1-3-1-1.8 0-3 .8-3 2s1.1 1.8 3 2.3 3 1.1 3 2.4-1.2 2.3-3 2.3c-1.4 0-2.6-.4-3.4-1.2M12 5v14"/>`,
    store: `<path d="M4 9h16l-2-5H6zM5 9v11h14V9M9 20v-6h6v6"/>`,
    cafe: `<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 11h2a2 2 0 0 1 0 4h-2M8 5c0 1 1 1 1 2M12 4c0 1 1 1 1 2"/>`,
    arcade: `<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 9h8v5H8zM9 17h-2m1-1v2M15 17h2"/>`,
    delivery: `<path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>`,
    studio: `<path d="M4 20 16 8l3 3L7 23H4zM14 6l2-2 4 4-2 2"/><path d="m6 6 1-3 1 3 3 1-3 1-1 3-1-3-3-1z"/>`,
    night: `<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"/><path d="m17 4 .5 1.5L19 6l-1.5.5L17 8l-.5-1.5L15 6l1.5-.5z"/>`,
    park: `<path d="M12 3c4 3 6 6 6 9a6 6 0 0 1-12 0c0-3 2-6 6-9zM12 12v9M8 21h8"/>`,
    river: `<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>`,
    fair: `<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11"/><circle cx="12" cy="12" r="2"/>`,
    camp: `<path d="m4 20 8-15 8 15zM12 5v15M8 20l4-6 4 6"/><path d="m19 3 .5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5z"/>`,
  };
  return `<svg class="hamster-ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.care}</svg>`;
}

/**
 * @param {string} stateClass
 * @returns {"idle" | "cheer" | "walk" | "eat" | "sleep" | "roll" | "jump"}
 */
function getHamsterSpriteSequence(stateClass) {
  if (stateClass === "eating") {
    return "eat";
  }
  if (stateClass === "sleeping") {
    return "sleep";
  }
  if (stateClass === "rolling") {
    return "roll";
  }
  if (["walking", "running", "outing", "working"].includes(stateClass)) {
    return "walk";
  }
  if (["playing", "petting", "celebrating", "wiggling"].includes(stateClass)) {
    return "jump";
  }
  if (stateClass === "bathing") {
    return "cheer";
  }
  return "idle";
}

/**
 * @param {string} stateClass
 * @param {string} outfitMarkup
 * @returns {string}
 */
function renderHamsterSpriteSequence(stateClass, outfitMarkup) {
  const sequence = getHamsterSpriteSequence(stateClass);
  const duration = {
    idle: 3200,
    cheer: 760,
    walk: stateClass === "running" ? 420 : 720,
    eat: 820,
    sleep: 3600,
    roll: 1120,
    jump: 960,
  }[sequence];
  const frameCount = sequence === "jump" ? 6 : 4;
  const frames = Array.from(
    { length: frameCount },
    (_, index) =>
      `<image class="hamster-sprite-frame hamster-sprite-frame-${index + 1}" href="assets/hamster/frames/${sequence}/${String(index + 1).padStart(2, "0")}.png" x="20" y="2" width="176" height="184" preserveAspectRatio="xMidYMid meet"/>`,
  ).join("");
  return `<g class="hamster-character hamster-raster-character hamster-sprite-sequence sequence-${sequence}" style="--hamster-frame-duration:${duration}ms">${frames}${outfitMarkup}</g>`;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function getHamsterPersistentVisualState(save) {
  return ["sleeping", "working", "outing", "studying"].includes(save.profile.currentState) ? save.profile.currentState : "idle";
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @param {string} [visualState]
 * @returns {"home" | "dining" | "play" | "bath" | "sleep" | "work" | "shop" | "study"}
 */
function getHamsterSceneMode(save, visualState = "") {
  const activeState = visualState || state.hamsterAnimation || getHamsterPersistentVisualState(save);
  if (activeState === "eating") return "dining";
  if (["playing", "running", "rolling", "celebrating"].includes(activeState)) return "play";
  if (activeState === "bathing") return "bath";
  if (activeState === "sleeping") return "sleep";
  if (activeState === "working") return "work";
  if (activeState === "studying") return "study";
  return "home";
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @param {"full" | "small" | "companion"} [size]
 * @param {string} [visualState]
 * @param {boolean} [reactive]
 * @returns {string}
 */
function renderHamsterAvatar(save, size = "full", visualState = "", reactive = false) {
  const persistentState = getHamsterPersistentVisualState(save);
  const stateClass = save.adopted ? visualState || state.hamsterAnimation || persistentState : "boxed";
  const emotion = save.adopted ? getHamsterStatus().emotion : "普通";
  const outfit = save.profile.activeOutfitId ?? "";
  const sleepy = stateClass === "sleeping" || emotion === "困倦";
  const angry = emotion === "生气";
  const hungry = emotion === "饥饿";
  const dirty = emotion === "很脏";
  const happy = emotion === "开心" || emotion === "兴奋";
  const eyeMarkup = sleepy
    ? `<path class="hamster-eye left" d="M73 91 q9 7 18 0" /><path class="hamster-eye right" d="M125 91 q9 7 18 0" />`
    : `<g class="hamster-open-eyes"><ellipse class="hamster-eye-dot left" cx="84" cy="88" rx="${happy ? 6 : 5.2}" ry="7"/><ellipse class="hamster-eye-dot right" cx="134" cy="88" rx="${happy ? 6 : 5.2}" ry="7"/><circle class="hamster-eye-glint" cx="82" cy="85" r="1.8"/><circle class="hamster-eye-glint" cx="132" cy="85" r="1.8"/></g>`;
  const mouthMarkup = angry
    ? `<path class="hamster-mouth" d="M100 119 q8 -7 16 0" />`
    : hungry
      ? `<path class="hamster-mouth" d="M101 116 q7 8 14 0" />`
      : happy
        ? `<path class="hamster-mouth" d="M98 115 q10 12 21 0" />`
        : `<path class="hamster-mouth" d="M101 116 q8 5 16 0" />`;
  const blush = happy || stateClass === "playing" ? `<circle class="hamster-blush" cx="67" cy="108" r="7" /><circle class="hamster-blush" cx="149" cy="108" r="7" />` : "";
  const dirt = dirty ? `<circle class="hamster-dirt" cx="62" cy="76" r="4" /><circle class="hamster-dirt" cx="145" cy="129" r="3" /><path class="hamster-dirt-line" d="M76 132 l9 5" />` : "";
  const cheeks = hungry
    ? `<ellipse class="hamster-cheek hungry" cx="72" cy="112" rx="17" ry="14" /><ellipse class="hamster-cheek hungry" cx="144" cy="112" rx="17" ry="14" />`
    : `<ellipse class="hamster-cheek" cx="72" cy="112" rx="14" ry="12" /><ellipse class="hamster-cheek" cx="144" cy="112" rx="14" ry="12" />`;
  const outfitMarkup =
    outfit === "outfit.bowtie"
      ? `<g class="hamster-outfit"><path d="M95 150 l13 -8 l13 8 l-13 8z" fill="#66d9c8"/><circle cx="108" cy="150" r="4" fill="#082c28"/></g>`
      : outfit === "outfit.paper_hat"
        ? `<path class="hamster-outfit" d="M77 48 l62 -15 l-17 37 z" fill="#f3f5ef" stroke="#c9d0c8" stroke-width="4" />`
        : outfit === "outfit.headset"
          ? `<g class="hamster-outfit" fill="none" stroke="#66d9c8" stroke-width="7" stroke-linecap="round"><path d="M67 77 q41 -48 82 0"/><path d="M61 84 v26"/><path d="M155 84 v26"/></g>`
          : outfit === "outfit.scarf"
            ? `<path class="hamster-outfit" d="M72 144 q36 18 72 0 v14 q-36 16 -72 0z" fill="#ff8a65" />`
            : outfit === "outfit.astronaut"
              ? `<ellipse class="hamster-outfit" cx="108" cy="96" rx="59" ry="54" fill="none" stroke="#e4ebe7" stroke-width="8" />`
              : outfit === "outfit.chef"
                ? `<path class="hamster-outfit" d="M72 55 q5 -24 26 -12 q11 -20 27 0 q21 -8 27 12 q-18 15 -80 0z" fill="#f3f5ef" />`
                : outfit === "outfit.sleep_cap"
                  ? `<path class="hamster-outfit" d="M82 50 q43 -27 62 21 q-39 -13 -73 4z" fill="#7aa7ff"/><circle cx="146" cy="70" r="7" fill="#f3f5ef"/>`
                  : "";
  const sleepMarks = stateClass === "sleeping" ? `<text class="hamster-zzz" x="150" y="54">Z</text><text class="hamster-zzz small" x="168" y="39">Z</text>` : "";
  const propMarkup =
    stateClass === "eating"
      ? `<g class="hamster-prop hamster-food-prop"><path class="food-bowl-svg" d="M55 155h106q-6 27-53 27t-53-27z"/><ellipse cx="108" cy="155" rx="53" ry="10"/><g class="food-pile"><circle cx="91" cy="151" r="7"/><circle cx="107" cy="148" r="8"/><circle cx="124" cy="151" r="7"/></g><path class="flying-seed" d="M137 106q9-10 16 0-8 12-16 0z"/><circle class="crumb one" cx="151" cy="119" r="3"/><circle class="crumb two" cx="158" cy="130" r="2"/></g>`
      : stateClass === "bathing"
        ? `<g class="hamster-prop hamster-bath-prop"><path class="bath-tub-svg" d="M37 137h142v15q0 31-34 31H71q-34 0-34-31z"/><path class="bath-water" d="M42 142q16-9 32 0t32 0 32 0 32 0"/><g class="bubbles"><circle cx="48" cy="126" r="10"/><circle cx="67" cy="113" r="7"/><circle cx="157" cy="118" r="12"/><circle cx="178" cy="101" r="7"/><circle cx="141" cy="97" r="6"/></g><g class="water-drops"><path d="M41 84q8 12 0 18-8-6 0-18z"/><path d="M176 78q8 12 0 18-8-6 0-18z"/></g></g>`
      : stateClass === "playing"
          ? `<g class="hamster-prop hamster-play-prop"><path class="ball-trail" d="M146 151q22-18 42-4"/><circle class="toy-ball-svg" cx="174" cy="151" r="17"/><path d="M158 151h32M174 135v32" class="ball-seam"/><path class="play-star one" d="m48 84 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path class="play-star two" d="m174 94 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>`
          : stateClass === "sleeping"
            ? `<g class="hamster-prop hamster-sleep-prop"><ellipse class="sleep-cushion" cx="108" cy="169" rx="73" ry="18"/><path class="sleep-blanket" d="M49 139q59-25 118 4v31H49z"/><path class="blanket-stitch" d="M59 157q48-18 98 1"/></g>`
            : stateClass === "working"
              ? `<g class="hamster-prop hamster-work-prop"><path class="work-cap" d="M68 61q37-34 78 2l-9 10q-29-17-63 0z"/><path class="clipboard" d="M142 116h38v51h-38z"/><path d="M150 128h22M150 138h18M150 148h20" class="clipboard-lines"/><circle class="work-coin one" cx="47" cy="114" r="9"/><circle class="work-coin two" cx="182" cy="88" r="7"/></g>`
              : stateClass === "outing" || stateClass === "walking" || stateClass === "running"
                ? `<g class="hamster-prop hamster-outing-prop"><path class="outing-bag" d="M143 119h42v42h-42z"/><path class="bag-strap" d="M146 124q-12-33-38-24"/><path class="outing-leaf one" d="M48 86q16-12 19 7-15 9-19-7z"/><path class="outing-leaf two" d="M174 79q14-10 17 6-13 8-17-6z"/></g>`
                : stateClass === "petting"
                  ? `<g class="hamster-prop hamster-pet-prop"><path class="pet-heart one" d="M45 92c-12-11-25 8 0 24 25-16 12-35 0-24z"/><path class="pet-heart two" d="M172 71c-9-8-18 6 0 18 18-12 9-26 0-18z"/><path class="pet-hand" d="M90 36q18-17 35 0l-5 26H94z"/></g>`
                  : stateClass === "celebrating"
                    ? `<g class="hamster-prop hamster-celebrate-prop"><path class="play-star one" d="m42 76 4 9 9 4-9 4-4 9-4-9-9-4 9-4z"/><path class="play-star two" d="m178 68 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path class="pet-heart three" d="M108 38c-12-11-25 8 0 24 25-16 12-35 0-24z"/></g>`
                    : stateClass === "rolling"
                      ? `<g class="hamster-prop hamster-roll-prop"><path class="roll-streak one" d="M27 93h34"/><path class="roll-streak two" d="M18 112h29"/><path class="play-star two" d="m181 76 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>`
                      : "";

  return `
    <svg class="hamster-svg ${size} hamster-state-${stateClass}" viewBox="0 0 216 196" role="img" aria-label="${save.adopted ? `${save.profile.name}，${emotion}` : "未打开的小纸箱"}" ${reactive && save.adopted ? "data-hamster-react" : ""}>
      <defs>
        <linearGradient id="hamsterFurGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0bd70"/><stop offset=".55" stop-color="#d98e3e"/><stop offset="1" stop-color="#b96c2d"/></linearGradient>
        <linearGradient id="hamsterCreamGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff0ce"/><stop offset="1" stop-color="#efc783"/></linearGradient>
        <linearGradient id="hamsterBathGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8ee8df"/><stop offset="1" stop-color="#46b9ba"/></linearGradient>
        <filter id="hamsterSoftShadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".25"/></filter>
      </defs>
      ${save.adopted ? "" : `<path class="hamster-box" d="M42 110 h132 l-13 61 h-106z" /><path class="hamster-box-flap" d="M43 110 l42 -30 h50 l40 30z" />`}
      ${propMarkup.includes("sleep-cushion") ? propMarkup : ""}
      ${save.adopted ? `<ellipse class="hamster-raster-shadow" cx="108" cy="178" rx="62" ry="9"/>${renderHamsterSpriteSequence(stateClass, outfitMarkup)}` : ""}
      <g class="hamster-character hamster-vector-character ${save.adopted ? "hamster-vector-hidden" : ""}">
        <ellipse class="hamster-shadow" cx="108" cy="174" rx="57" ry="10" />
        <path class="hamster-tail" d="M164 133q30-3 24 22-5 17-21 7"/>
        <circle class="hamster-ear left" cx="67" cy="62" r="24" />
        <circle class="hamster-ear right" cx="149" cy="62" r="24" />
        <circle class="hamster-ear-inner left" cx="67" cy="62" r="12" />
        <circle class="hamster-ear-inner right" cx="149" cy="62" r="12" />
        <ellipse class="hamster-body" cx="108" cy="112" rx="65" ry="62" />
        ${outfitMarkup}
        <path class="hamster-head-patch" d="M66 91q6-39 42-43 36 4 44 43-17-17-44-15-27-2-42 15z"/>
        <ellipse class="hamster-belly" cx="108" cy="134" rx="39" ry="31" />
        <ellipse class="hamster-muzzle" cx="108" cy="111" rx="28" ry="22"/>
        ${cheeks}
        ${blush}
        ${eyeMarkup}
        <path class="hamster-nose" d="M104 104 q4 -5 8 0 q-4 6 -8 0z" />
        ${mouthMarkup}
        <g class="hamster-whiskers"><path d="M78 112 48 106M78 118 45 120M138 112l30-6M138 118l33 2"/></g>
        <path class="hamster-paw left" d="M66 137 q14 6 24 -4" />
        <path class="hamster-paw right" d="M150 137 q-14 6 -24 -4" />
        <path class="hamster-foot left" d="M73 166 q15 8 28 0" />
        <path class="hamster-foot right" d="M115 166 q15 8 28 0" />
        <g class="hamster-toes"><path d="M82 166v5M90 167v5M126 167v5M134 166v5"/></g>
        <path class="hamster-fur-highlight" d="M77 69q12-16 29-17M60 99q-5 17 1 30"/>
        ${dirt}
      </g>
      ${save.adopted ? dirt : ""}
      ${propMarkup.includes("sleep-cushion") ? "" : propMarkup}
      ${sleepMarks}
    </svg>
  `;
}

/**
 * @param {string} label
 * @param {number} value
 * @param {string} text
 * @param {string} className
 * @returns {string}
 */
function renderHamsterMeter(label, value, text, className) {
  const settings = getSettings();
  return `
    <div class="hamster-meter ${className}">
      <span>${label}</span>
      <strong>${escapeHtml(text)}${settings.hamsterShowNumbers ? ` · ${clampPercent(value)}` : ""}</strong>
      <div class="hamster-meter-track"><i style="width:${clampPercent(value)}%"></i></div>
    </div>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterMeters(save) {
  const derived = getHamsterStatus();
  return `
    <div class="hamster-meters">
      ${renderHamsterMeter("饱腹", save.profile.hunger, derived.statusLabels.hunger, "hunger")}
      ${renderHamsterMeter("清洁", save.profile.cleanliness, derived.statusLabels.cleanliness, "cleanliness")}
      ${renderHamsterMeter("精力", save.profile.energy, derived.statusLabels.energy, "energy")}
      ${renderHamsterMeter("快乐", save.profile.happiness, derived.statusLabels.happiness, "happiness")}
      ${renderHamsterMeter("健康", save.profile.health, derived.statusLabels.health, "health")}
    </div>
  `;
}

function renderHamsterPanel() {
  const save = getHamsterSaveData();
  const settings = getSettings();
  if (!save.adopted) {
    elements.hamsterPanel.className = "hamster-panel adoption";
    elements.hamsterPanel.innerHTML = `
      <button class="hamster-scene hamster-adopt-scene" type="button" data-hamster-open aria-label="打开闻风仓鼠屋">
        ${renderHamsterAvatar(save)}
      </button>
      <div class="hamster-panel-copy">
        <p class="eyebrow">Credius Hamster</p>
        <h2>闻风的小仓鼠正在纸箱里等你。</h2>
        <p>它会成为 CREDIUS ARCADE 的常驻伙伴：陪你玩、等你回来，也会慢慢长大。</p>
        <label class="hamster-name-field">
          <span>仓鼠名称</span>
          <input type="text" maxlength="12" value="团团" data-hamster-name-input autocomplete="off" />
        </label>
        <div class="hamster-actions">
          <button class="primary-action" type="button" data-hamster-create>${renderHamsterIcon("care")}<span>邀请入住</span></button>
          <button type="button" data-hamster-open>${renderHamsterIcon("home")}<span>看看仓鼠屋</span></button>
        </div>
      </div>
    `;
    return;
  }

  const derived = getHamsterStatus();
  const collapsed = settings.hamsterLobbyCollapsed;
  const activity = renderHamsterActivitySummary(save);
  const sceneMode = getHamsterSceneMode(save);
  elements.hamsterPanel.className = `hamster-panel ${collapsed ? "collapsed" : ""}`;
  elements.hamsterPanel.innerHTML = collapsed
    ? `
      <button class="hamster-compact-strip" type="button" data-hamster-expand>
        ${renderHamsterAvatar(save, "small")}
        <span><strong>${escapeHtml(save.profile.name)} · Lv.${save.profile.level}</strong><small>${escapeHtml(derived.notice)}</small></span>
        <b>${save.profile.coins} 仓鼠币</b>
      </button>
    `
    : `
      <button class="hamster-scene hamster-photo-scene scene-${sceneMode} room-${escapeHtml(save.profile.activeRoomThemeId ?? "room.default").replace(".", "-")}" type="button" data-hamster-open aria-label="进入闻风仓鼠屋">
        <span class="hamster-room-window" aria-hidden="true"></span>
        <span class="hamster-room-floor" aria-hidden="true"></span>
        ${renderHamsterAvatar(save, "full", "", true)}
        ${renderHamsterBubble(state.hamsterMessage || derived.notice)}
      </button>
      <div class="hamster-panel-copy">
        <div class="hamster-title-row">
          <div>
            <p class="eyebrow">Credius Hamster｜闻风仓鼠屋</p>
            <h2>${escapeHtml(save.profile.name)} · Lv.${save.profile.level}</h2>
          </div>
          <div class="hamster-title-tools">
            <div class="hamster-coin-pill"><span>仓鼠币</span><strong>${save.profile.coins}</strong></div>
            <button class="hamster-collapse-control" type="button" data-hamster-collapse>收起</button>
          </div>
        </div>
        <div class="hamster-progress-row">
          <div class="hamster-xp"><span>经验进度</span><i><b style="width:${derived.levelProgress}%"></b></i></div>
          <div class="hamster-emotion"><span>心情</span><strong>${escapeHtml(derived.emotion)}</strong></div>
        </div>
        ${activity}
        ${renderHamsterMeters(save)}
        <div class="hamster-actions quick">
          <button type="button" data-hamster-tool="feed">${renderHamsterIcon("feed")}<span>喂食</span></button>
          <button type="button" data-hamster-action="bath">${renderHamsterIcon("bath")}<span>洗澡</span></button>
          <button type="button" data-hamster-action="pet">${renderHamsterIcon("pet")}<span>抚摸</span></button>
          <button type="button" data-hamster-tool="play">${renderHamsterIcon("play")}<span>玩耍</span></button>
          <button type="button" data-hamster-action="sleep">${renderHamsterIcon("sleep")}<span>${save.profile.currentActivity?.type === "sleep" ? "叫醒" : "睡觉"}</span></button>
          <button type="button" data-hamster-tool="outing">${renderHamsterIcon("outing")}<span>外出</span></button>
          <button type="button" data-hamster-tool="work">${renderHamsterIcon("work")}<span>工作</span></button>
          <button class="primary-action" type="button" data-hamster-open>${renderHamsterIcon("home")}<span>仓鼠屋</span></button>
        </div>
        ${renderHamsterQuickTool(save)}
      </div>
    `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterActivitySummary(save) {
  const activity = save.profile.currentActivity;
  if (!activity) {
    return `<div class="hamster-activity idle"><span>当前</span><strong>在仓鼠屋待命</strong></div>`;
  }
  const complete = getHamsterStatus().activityComplete;
  const progress = getHamsterStatus().activityProgress;
  const isStudy = activity.type === "study";
  const actionLabel = complete ? (isStudy ? "掌握技能" : "领取") : activity.type === "sleep" ? "叫醒" : isStudy ? "暂停课程" : "提前结束";
  return `
    <div class="hamster-activity ${complete ? "complete" : ""}">
      <span>${complete ? "可领取" : "进行中"}</span>
      <strong>${escapeHtml(getActivityTitle(activity))}</strong>
      <i><b style="width:${progress}%"></b></i>
      <button type="button" data-hamster-claim>${renderHamsterIcon(isStudy ? "study" : complete ? "coin" : activity.type === "sleep" ? "sleep" : "work")}<span>${actionLabel}</span></button>
    </div>
  `;
}

/**
 * @param {import("./src/types").HamsterActivity} activity
 * @returns {string}
 */
function getActivityTitle(activity) {
  if (activity.type === "sleep") {
    return "睡觉恢复中";
  }
  const list = activity.type === "work" ? hamsterBalance.jobs : activity.type === "study" ? hamsterBalance.studies : hamsterBalance.outings;
  return list.find((item) => item.id === activity.activityId)?.title ?? activity.activityId;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterQuickTool(save) {
  if (!state.hamsterTool) {
    return "";
  }
  if (state.hamsterTool === "feed") {
    const foodRows = hamsterBalance.foods
      .map((food) => ({ food, quantity: getOwnedQuantity(save, food.id) }))
      .filter((entry) => entry.quantity > 0)
      .map(
        ({ food, quantity }) => `
          <div class="hamster-tool-row">
            <span class="hamster-item-icon">${food.icon}</span>
            <span><strong>${food.name}</strong><small>数量 ${quantity} · 饱腹 +${food.hunger} · 快乐 +${food.happiness}</small></span>
            <button type="button" data-hamster-feed="${food.id}">${renderHamsterIcon("feed")}<span>使用</span></button>
          </div>
        `,
      )
      .join("");
    return `<div class="hamster-tool-drawer"><div class="hamster-tool-head"><strong>选择食物</strong><button type="button" data-hamster-tool="">收起</button></div>${foodRows || "<p>背包里没有食物，可以去商店买一点。</p>"}</div>`;
  }
  if (state.hamsterTool === "play") {
    const toys = hamsterBalance.shopItems
      .filter((item) => item.category === "toy")
      .map((toy) => ({ toy, quantity: getOwnedQuantity(save, toy.id) }))
      .filter((entry) => entry.quantity > 0)
      .map(
        ({ toy }) => `
          <div class="hamster-tool-row">
            <span class="hamster-item-icon">${toy.icon}</span>
            <span><strong>${toy.name}</strong><small>快乐 +${toy.happiness ?? 0} · 精力 -${toy.energyCost ?? hamsterBalance.action.playEnergyCost}</small></span>
            <button type="button" data-hamster-play="${toy.id}">${renderHamsterIcon("play")}<span>玩</span></button>
          </div>
        `,
      )
      .join("");
    return `<div class="hamster-tool-drawer"><div class="hamster-tool-head"><strong>选择玩具</strong><button type="button" data-hamster-tool="">收起</button></div>${toys || "<p>还没有玩具。基础小球会在新手物品里赠送。</p>"}</div>`;
  }
  if (state.hamsterTool === "work") {
    const rows = hamsterBalance.jobs
      .map((job) => renderActivityOption(save, job, "work"))
      .join("");
    return `<div class="hamster-tool-drawer"><div class="hamster-tool-head"><strong>外出工作</strong><button type="button" data-hamster-tool="">收起</button></div>${rows}</div>`;
  }
  if (state.hamsterTool === "outing") {
    const rows = hamsterBalance.outings
      .map((outing) => renderActivityOption(save, outing, "outing"))
      .join("");
    return `<div class="hamster-tool-drawer"><div class="hamster-tool-head"><strong>外出游玩</strong><button type="button" data-hamster-tool="">收起</button></div>${rows}</div>`;
  }
  return "";
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @param {Record<string, unknown>} activity
 * @param {"work" | "outing"} type
 * @returns {string}
 */
function renderActivityOption(save, activity, type) {
  const locked = save.profile.level < Number(activity.unlockLevel ?? 1);
  const disabled = locked || Boolean(save.profile.currentActivity);
  const reward = type === "work" ? `${activity.baseCoins} 仓鼠币` : `快乐 +${activity.happiness}`;
  const icon =
    type === "work"
      ? {
          "job.store": "store",
          "job.cafe": "cafe",
          "job.arcade_shift": "arcade",
          "job.delivery": "delivery",
          "job.studio": "studio",
          "job.night_guard": "night",
        }[String(activity.id)] ?? "work"
      : {
          "outing.park": "park",
          "outing.riverside": "river",
          "outing.arcade": "arcade",
          "outing.funfair": "fair",
          "outing.camping": "camp",
        }[String(activity.id)] ?? "outing";
  return `
    <div class="hamster-tool-row ${locked ? "locked" : ""}">
      <span class="hamster-item-icon">${renderHamsterIcon(icon)}</span>
      <span>
        <strong>${escapeHtml(activity.title)}</strong>
        <small>${activity.durationMinutes} 分钟 · 精力 -${activity.energyCost} · ${reward}${locked ? ` · ${activity.unlockLevel} 级解锁` : ""}</small>
      </span>
      <button type="button" data-hamster-${type}="${activity.id}" ${disabled ? "disabled" : ""}>${renderHamsterIcon(icon)}<span>开始</span></button>
    </div>
  `;
}

function renderCompactHamsterStatus() {
  const settings = getSettings();
  if (!settings.showHamsterInGames) {
    elements.compactHamsterSlot.innerHTML = "";
    elements.compactHamsterSlot.hidden = true;
    return;
  }
  const save = getHamsterSaveData();
  const derived = getHamsterStatus();
  elements.compactHamsterSlot.hidden = false;
  elements.compactHamsterSlot.innerHTML = `
    <button class="compact-hamster-button" type="button" data-hamster-open aria-label="查看仓鼠状态">
      ${renderHamsterAvatar(save, "small")}
      <span>
        <strong>${save.adopted ? escapeHtml(save.profile.name) : "小纸箱"}</strong>
        <small>${save.adopted ? escapeHtml(state.hamsterMessage || `${derived.emotion} · ${save.profile.coins} 币`) : "待入住"}</small>
      </span>
    </button>
  `;
}

/**
 * @returns {string}
 */
function renderUtilityHamsterStrip() {
  const save = getHamsterSaveData();
  const derived = getHamsterStatus();
  return `
    <button class="utility-hamster-strip" type="button" data-hamster-open>
      ${renderHamsterAvatar(save, "small")}
      <span>
        <strong>${save.adopted ? `${escapeHtml(save.profile.name)} · Lv.${save.profile.level}` : "Credius Hamster"}</strong>
        <small>${escapeHtml(derived.notice)}</small>
      </span>
      <b>${save.adopted ? `${save.profile.coins} 仓鼠币` : "邀请入住"}</b>
    </button>
  `;
}

/**
 * @param {string} text
 * @returns {string}
 */
function renderHamsterBubble(text) {
  const settings = getSettings();
  const urgent = /完成|归来|饿|洗澡|不足|纸箱|入住|领取/.test(text);
  if (settings.hamsterBubbleFrequency === "quiet" && !urgent) {
    return "";
  }
  if (settings.hamsterBubbleFrequency === "low" && !urgent && new Date().getHours() % 2 === 1) {
    return "";
  }
  return `<span class="hamster-bubble">${escapeHtml(text)}</span>`;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function getCompanionSpeech(save) {
  const profile = save.profile;
  const nickname = getSettings().nickname === "Player One" ? "闻风" : getSettings().nickname;
  let pool = hamsterBalance.bubbles.idle;
  if (profile.hunger <= 28) {
    pool = [...hamsterBalance.bubbles.hungry, "腮帮空空的，走路都没有回声啦。"];
  } else if (profile.cleanliness <= 28) {
    pool = [...hamsterBalance.bubbles.dirty, "毛毛翘起来了，需要一点泡泡。"];
  } else if (profile.energy <= 25) {
    pool = [...hamsterBalance.bubbles.tired, "我先眯一小会儿，还会陪着你的。"];
  } else if (profile.happiness >= 75) {
    pool = [
      ...hamsterBalance.bubbles.happy,
      `${nickname}，你今天也很可靠。`,
      `我宣布，${nickname} 是游戏厅里最会照顾仓鼠的人。`,
      "刚才那局很帅，我都看见啦。",
      "你的游戏收藏很有品味。",
    ];
  } else {
    const hour = new Date().getHours();
    const timePool =
      hour < 6 ? hamsterBalance.bubbles.night : hour < 11 ? hamsterBalance.bubbles.morning : hour < 17 ? hamsterBalance.bubbles.noon : hamsterBalance.bubbles.evening;
    pool = [...timePool, ...hamsterBalance.bubbles.idle, `${nickname}，我来巡逻一下页面。`];
  }
  const candidates = pool.filter((line) => line !== state.companionLastSpeech);
  const next = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0] ?? "我在这里。";
  state.companionLastSpeech = next;
  return next;
}

function renderRoamingHamster() {
  const save = getHamsterSaveData();
  const shouldHide = !save.adopted || !elements.playOverlay.hidden;
  elements.roamingHamster.hidden = shouldHide;
  if (shouldHide) {
    return;
  }
  const derived = getHamsterStatus();
  const speech = state.companionSpeech;
  const persistentState = getHamsterPersistentVisualState(save);
  const companionVisualState = persistentState !== "idle" ? persistentState : state.hamsterAnimation || (state.companionPose === "idle" ? "" : state.companionPose);
  const companionScene = getHamsterSceneMode(save, companionVisualState);
  elements.roamingHamster.classList.toggle("menu-open", state.companionMenuOpen);
  elements.roamingHamster.classList.toggle("is-roaming", state.companionPose === "walking" || state.companionPose === "running");
  elements.roamingHamster.classList.toggle("has-action-stage", companionScene !== "home");
  elements.roamingHamster.dataset.scene = companionScene;
  if (!elements.roamingHamster.querySelector(".companion-character")) {
    elements.roamingHamster.innerHTML = `
      <button class="companion-speech" type="button" data-companion-dismiss hidden></button>
      <div class="companion-action-orbit" aria-label="仓鼠快捷互动">
        <button type="button" data-companion-action="feed" aria-label="直接喂食">${renderHamsterIcon("feed")}<span>喂食</span></button>
        <button type="button" data-companion-action="bath" aria-label="直接洗澡">${renderHamsterIcon("bath")}<span>洗澡</span></button>
        <button type="button" data-companion-action="play" aria-label="直接玩耍">${renderHamsterIcon("play")}<span>玩耍</span></button>
        <button type="button" data-companion-action="sleep" aria-label="直接睡觉">${renderHamsterIcon("sleep")}<span>睡觉</span></button>
      </div>
      <button class="companion-character" type="button" data-companion-toggle data-companion-drag></button>
      <span class="companion-ground" aria-hidden="true"></span>
    `;
  }
  const speechElement = /** @type {HTMLButtonElement | null} */ (elements.roamingHamster.querySelector(".companion-speech"));
  const characterElement = /** @type {HTMLButtonElement | null} */ (elements.roamingHamster.querySelector(".companion-character"));
  const sleepAction = /** @type {HTMLButtonElement | null} */ (elements.roamingHamster.querySelector('[data-companion-action="sleep"]'));
  if (speechElement) {
    speechElement.hidden = !speech;
    speechElement.textContent = speech;
  }
  if (characterElement) {
    characterElement.setAttribute("aria-expanded", String(state.companionMenuOpen));
    characterElement.setAttribute("aria-label", `拖动或点击 ${save.profile.name}`);
    characterElement.innerHTML = `
      <span class="companion-mood">${escapeHtml(derived.emotion)}</span>
      ${renderHamsterAvatar(save, "companion", companionVisualState)}
    `;
  }
  if (sleepAction) {
    const sleeping = save.profile.currentActivity?.type === "sleep";
    sleepAction.setAttribute("aria-label", sleeping ? "一键叫醒" : "直接睡觉");
    sleepAction.innerHTML = `${renderHamsterIcon("sleep")}<span>${sleeping ? "叫醒" : "睡觉"}</span>`;
  }
  requestAnimationFrame(positionRoamingHamster);
}

function positionRoamingHamster() {
  if (elements.roamingHamster.hidden || companionDrag) {
    return;
  }
  const settings = getSettings();
  const rect = elements.roamingHamster.getBoundingClientRect();
  const width = rect.width || (window.innerWidth < 560 ? 118 : 142);
  const height = rect.height || (window.innerWidth < 560 ? 150 : 176);
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const minY = Math.max(64, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0);
  const maxY = Math.max(minY, window.innerHeight - height - 12);
  if (!state.companionPosition) {
    const normalizedX = settings.hamsterCompanionX ?? 0.98;
    const normalizedY = settings.hamsterCompanionY ?? 0.9;
    state.companionPosition = {
      x: margin + normalizedX * Math.max(0, maxX - margin),
      y: minY + normalizedY * Math.max(0, maxY - minY),
    };
  }
  state.companionPosition.x = Math.min(maxX, Math.max(margin, state.companionPosition.x));
  state.companionPosition.y = Math.min(maxY, Math.max(minY, state.companionPosition.y));
  elements.roamingHamster.style.setProperty("--companion-x", `${state.companionPosition.x}px`);
  elements.roamingHamster.style.setProperty("--companion-y", `${state.companionPosition.y}px`);
}

/**
 * @param {string} text
 * @param {string} [pose]
 */
function showCompanionSpeech(text, pose = "idle") {
  window.clearTimeout(companionSpeechTimer);
  state.companionSpeech = text;
  state.companionPose = pose;
  renderRoamingHamster();
  companionSpeechTimer = window.setTimeout(() => {
    state.companionSpeech = "";
    state.companionPose = "idle";
    renderRoamingHamster();
  }, 6800);
}

function moveCompanionRandomly() {
  const settings = getSettings();
  if (
    elements.roamingHamster.hidden ||
    companionDrag ||
    settings.reduceMotion ||
    settings.hamsterAnimationMode !== "full" ||
    document.visibilityState !== "visible"
  ) {
    return;
  }
  positionRoamingHamster();
  if (!state.companionPosition) {
    return;
  }
  const rect = elements.roamingHamster.getBoundingClientRect();
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
  const minY = 64;
  const maxY = Math.max(minY, window.innerHeight - rect.height - 12);
  state.companionPosition = {
    x: Math.min(maxX, Math.max(margin, state.companionPosition.x + (Math.random() - 0.5) * 190)),
    y: Math.min(maxY, Math.max(minY, state.companionPosition.y + (Math.random() - 0.5) * 110)),
  };
  state.companionPose = Math.random() > 0.72 ? "running" : "walking";
  renderRoamingHamster();
  window.clearTimeout(companionPoseTimer);
  companionPoseTimer = window.setTimeout(() => {
    state.companionPose = "idle";
    renderRoamingHamster();
  }, 1600);
}

function scheduleCompanionBehavior() {
  window.clearTimeout(companionBehaviorTimer);
  companionBehaviorTimer = window.setTimeout(() => {
    const save = getHamsterSaveData();
    if (save.adopted && elements.playOverlay.hidden && document.visibilityState === "visible") {
      if (Math.random() > 0.34) {
        showCompanionSpeech(getCompanionSpeech(save), Math.random() > 0.75 ? "petting" : "idle");
      }
      moveCompanionRandomly();
    }
    scheduleCompanionBehavior();
  }, 18000 + Math.random() * 18000);
}

function render() {
  renderTopState();
  renderHamsterPanel();
  renderCompactHamsterStatus();
  renderRoamingHamster();
  renderCategories();
  renderCards();
  renderSidebar();
}

function renderTopState() {
  const settings = getSettings();
  const records = getAllRecords(gameIds);
  const summary = getPlayerSummary(records);
  const journey = campaign.getSummary();
  const lastRecord = Object.values(records)
    .filter((record) => record.lastPlayedAt)
    .sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime())[0];
  const lastGame = lastRecord ? findGame(lastRecord.gameId) : null;

  elements.soundToggle.textContent = settings.soundEnabled ? "♪" : "♪̸";
  elements.soundToggle.setAttribute("aria-pressed", String(settings.soundEnabled));
  if (document.body?.classList) {
    document.body.classList.toggle("hamster-motion-off", settings.reduceMotion || settings.hamsterAnimationMode === "off");
    document.body.classList.toggle("hamster-motion-simple", settings.hamsterAnimationMode === "simple");
  }
  elements.nicknameInput.value = settings.nickname;
  elements.allGameCount.textContent = `${gameDefinitions.length}`;
  elements.homeAchievementCount.textContent = String(summary.unlockedAchievements);
  elements.campaignCoins.textContent = String(journey.coins);
  const totalCampaignLevels = gameDefinitions.reduce(
    (total, game) => total + (game.multiplayer ? 0 : campaign.getMaxLevel(game.id)),
    0,
  );
  const totalStarLevels = gameDefinitions.reduce(
    (total, game) => total + (game.multiplayer || isClearOnlyGame(game.id) ? 0 : campaign.getMaxLevel(game.id)),
    0,
  );
  elements.campaignStars.textContent = `${journey.stars} / ${totalStarLevels * 3}`;
  elements.campaignCleared.textContent = `${journey.clearedLevels} / ${totalCampaignLevels}`;
  elements.recentGameName.textContent = lastGame ? lastGame.title : "暂无";
  elements.recentGameScore.textContent = lastRecord
    ? lastGame?.scoringType === "wins"
      ? `累计 ${formatScore(lastRecord.highScore)} 胜`
      : `最近 ${formatScore(lastRecord.recentScores[0] ?? 0)} 分`
    : "还没有成绩";
  const quickStartGame = lastGame?.status === "available" ? lastGame : findGame("2048") ?? gameDefinitions[0];
  if (quickStartGame) {
    elements.quickStartButton.dataset.startGame = quickStartGame.id;
    elements.quickStartButton.setAttribute("aria-label", `${lastGame ? "继续" : "开始"} ${quickStartGame.title}`);
    elements.quickStartGameName.textContent = lastGame ? `继续 ${quickStartGame.title}` : quickStartGame.title;
  }
}

function getSelectedLevel(gameId) {
  const progress = campaign.getGameProgress(gameId);
  const requested = Number(state.selectedLevels[gameId]) || progress.unlockedLevel;
  return Math.min(progress.unlockedLevel, Math.max(1, requested));
}

function renderStarRow(stars) {
  const count = Math.min(3, Math.max(0, Number(stars) || 0));
  return `<span class="journey-stars" aria-label="${count} 星">${"★".repeat(count)}${"☆".repeat(3 - count)}</span>`;
}

function isClearOnlyGame(gameId) {
  return campaign.GAME_CONFIGS[gameId]?.ratingMode === "clear";
}

function renderCategories() {
  elements.categoryScroller.innerHTML = categoryFilters
    .map(
      (category) => `
        <button class="category-pill ${state.category === category.id ? "active" : ""}" type="button" data-category="${category.id}">
          ${category.label}
        </button>
      `,
    )
    .join("");
}

function renderCards() {
  const records = getAllRecords(gameIds);
  const query = state.query.trim().toLowerCase();
  const filteredGames = gameDefinitions.filter((game) => {
    const record = records[game.id] ?? getGameRecord(game.id);
    const matchesCategory =
      state.category === "all" ||
      (state.category === "favorite" ? record.favorite : game.categories.includes(state.category));
    const searchable = `${game.title} ${game.subtitle} ${game.description}`.toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    return matchesCategory && matchesSearch;
  });

  elements.resultCount.textContent = `${filteredGames.length} 个游戏`;
  elements.gameGrid.innerHTML = filteredGames
    .map((game, index) => renderGameCard(game, records[game.id], index))
    .join("");
}

/**
 * @param {import("./src/types").GameDefinition} game
 * @param {import("./src/types").GameRecord} record
 * @param {number} index
 * @returns {string}
 */
function renderGameCard(game, record, index) {
  const isComingSoon = game.status !== "available";
  const tried = record.totalPlays > 0;
  const progress = campaign.getGameProgress(game.id);
  const maxLevel = campaign.getMaxLevel(game.id);
  const currentLevel = getSelectedLevel(game.id);
  const clearOnly = isClearOnlyGame(game.id);
  const multiplayer = Boolean(game.multiplayer);
  const clearedCount = Object.values(progress.levels).filter((level) => level.cleared).length;
  const totalStars = Object.values(progress.levels).reduce((total, level) => total + level.stars, 0);
  const categoryLabel = getCategoryLabel(game.category);
  const badge = isComingSoon ? "待接入联机" : game.badge ?? (tried ? "已体验" : "未体验");
  const coverMarkup = game.cover
    ? `<img src="${game.cover}" alt="${game.title} 游戏画面" loading="${index < 3 ? "eager" : "lazy"}" decoding="async" />`
    : `<span class="game-icon" aria-hidden="true">${game.icon}</span>`;
  const bestLabel = game.scoringType === "time" && record.bestTime
    ? `${Math.round(record.bestTime)} 秒`
    : formatScore(record.highScore);
  const primaryAction = isComingSoon
    ? `<button type="button" data-detail="${game.id}">查看说明</button>`
    : multiplayer
      ? `<button type="button" data-start-game="${game.id}">进入联机</button>`
      : `<button type="button" data-start-game="${game.id}" data-start-level="${currentLevel}">挑战第 ${currentLevel} 关</button>`;
  const coverAction = isComingSoon
    ? `data-detail="${game.id}"`
    : multiplayer
      ? `data-start-game="${game.id}"`
      : `data-start-game="${game.id}" data-start-level="${currentLevel}"`;
  const metaMarkup = multiplayer
    ? `<span>2-4 人</span><span>实时房间</span><span>胜场 ${formatScore(record.highScore)}</span>`
    : `<span>${categoryLabel}</span><span>进度 ${progress.unlockedLevel}/${maxLevel}</span><span>${clearOnly ? `${clearedCount}/${maxLevel} 已通关` : `${totalStars}/${maxLevel * 3} ★`}</span><span>最高 ${bestLabel}</span>`;

  return `
    <article class="game-card ${isComingSoon ? "coming-soon" : ""}" style="--game-color:${game.theme}">
      <div class="game-cover-shell">
        <button class="game-cover-button" type="button" ${coverAction} aria-label="${isComingSoon ? "查看" : "开始"} ${game.title}">
          ${coverMarkup}
          <span class="game-badge">${badge}</span>
          ${isComingSoon ? "" : `<span class="cover-play-cue" aria-hidden="true"><b>▶</b><em>直接开始</em></span>`}
        </button>
        <button class="favorite-button ${record.favorite ? "active" : ""}" type="button" data-favorite="${game.id}" aria-label="收藏 ${game.title}" aria-pressed="${record.favorite}">
          ${record.favorite ? "★" : "☆"}
        </button>
      </div>
      <div class="game-card-body">
        <button class="game-copy" type="button" ${coverAction}>
          <strong>${game.title}</strong>
          <span>${game.subtitle}</span>
        </button>
        <p>${game.description}</p>
        <div class="card-meta">
          ${metaMarkup}
        </div>
        <div class="card-actions">
          ${primaryAction}
          <button type="button" data-more="${game.id}">说明</button>
        </div>
      </div>
    </article>
  `;
}

function renderSidebar() {
  const settings = getSettings();
  const records = getAllRecords(gameIds);
  const summary = getPlayerSummary(records);
  const sortedRecords = sortRecords(
    Object.values(records),
    /** @type {"recent" | "score" | "plays" | "title"} */ (state.recordSort),
    (gameId) => findGame(gameId)?.title ?? gameId,
  );

  elements.nicknameInput.value = settings.nickname;
  elements.totalPlays.textContent = String(summary.totalPlays);
  elements.totalPlayTime.textContent = formatPlayTime(summary.totalPlayTime);
  elements.triedGames.textContent = `${summary.triedGames}/${availableGameCount}`;
  elements.achievementCount.textContent = String(summary.unlockedAchievements);
  elements.scoreList.innerHTML = sortedRecords.map(renderScoreRow).join("");
}

/**
 * @param {import("./src/types").GameRecord} record
 * @returns {string}
 */
function renderScoreRow(record) {
  const game = findGame(record.gameId);
  if (!game) {
    return "";
  }

  return `
    <button class="score-row" type="button" data-detail="${game.id}" style="--game-color:${game.theme}">
      <span class="mini-icon" aria-hidden="true">${game.icon}</span>
      <span>
        <strong>${game.title}</strong>
        <small>${formatRelativeTime(record.lastPlayedAt)}</small>
      </span>
      <span>
        <strong>${formatScore(record.highScore)}</strong>
        <small>${record.highestLevel ? `最高 ${record.highestLevel} 级 · ` : ""}${record.totalPlays} 次</small>
      </span>
    </button>
  `;
}

/**
 * @param {string} gameId
 */
function openDetail(gameId) {
  const game = findGame(gameId);
  if (!game) {
    return;
  }

  const record = getGameRecord(gameId);
  state.detailGameId = gameId;
  elements.detailContent.innerHTML = renderDetail(game, record);
  elements.detailLayer.hidden = false;
  document.body.classList.add("modal-open");
  const startButton = elements.detailContent.querySelector("[data-start-game]");
  if (startButton instanceof HTMLElement) {
    startButton.focus();
  }
}

function renderLevelGrid(gameId) {
  const progress = campaign.getGameProgress(gameId);
  const selectedLevel = getSelectedLevel(gameId);
  const maxLevel = campaign.getMaxLevel(gameId);
  const clearOnly = isClearOnlyGame(gameId);
  return `
    <div class="level-grid" role="group" aria-label="选择关卡">
      ${Array.from({ length: maxLevel }, (_, index) => {
        const level = index + 1;
        const result = progress.levels[level];
        const locked = level > progress.unlockedLevel;
        return `
          <button
            class="level-button ${selectedLevel === level ? "selected" : ""} ${result.cleared ? "cleared" : ""}"
            type="button"
            data-select-level="${level}"
            data-select-game="${gameId}"
            ${locked ? "disabled" : ""}
            aria-label="${locked ? `第 ${level} 关未解锁` : clearOnly ? `选择第 ${level} 关，${result.cleared ? "已通关" : "未通关"}` : `选择第 ${level} 关，${result.stars} 星`}"
          >
            <span>${locked ? "锁" : level}</span>
            ${clearOnly
              ? `<span class="journey-clear">${result.cleared ? "✓ 已通关" : "待清场"}</span>`
              : renderStarRow(result.stars)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

/**
 * @param {import("./src/types").GameDefinition} game
 * @param {import("./src/types").GameRecord} record
 * @returns {string}
 */
function renderDetail(game, record) {
  const settings = getSettings();
  const progress = campaign.getGameProgress(game.id);
  const selectedLevel = getSelectedLevel(game.id);
  const levelConfig = campaign.getLevelConfig(game.id, selectedLevel);
  const journey = campaign.getSummary();
  const levelResult = progress.levels[selectedLevel];
  const clearOnly = isClearOnlyGame(game.id);
  const clearedCount = Object.values(progress.levels).filter((level) => level.cleared).length;
  const totalStars = Object.values(progress.levels).reduce((total, level) => total + level.stars, 0);
  const maxLevel = campaign.getMaxLevel(game.id);
  const recentScores = record.recentScores.length
    ? record.recentScores.map((score) => `<span>${formatScore(score)}</span>`).join("")
    : "<em>还没有本机成绩</em>";
  const disabled = game.status !== "available";
  const coverMarkup = game.cover
    ? `<img src="${game.cover}" alt="${game.title} 图标" loading="lazy" />`
    : `<span class="game-icon large" aria-hidden="true">${game.icon}</span>`;

  if (game.multiplayer) {
    return `
      <div class="detail-hero" style="--game-color:${game.theme}">
        <span class="detail-cover" aria-hidden="true">${coverMarkup}</span>
        <div>
          <p class="eyebrow">多人</p>
          <h2 id="detailTitle">${game.title} <small>v${game.version}</small></h2>
          <p>${game.description}</p>
        </div>
      </div>
      <div class="detail-grid">
        <div><span>玩家人数</span><strong>2-4</strong></div>
        <div><span>本机胜场</span><strong>${formatScore(record.highScore)}</strong></div>
        <div><span>房间码</span><strong>6 位</strong></div>
        <div><span>状态来源</span><strong>服务端</strong></div>
      </div>
      <section class="detail-section">
        <h3>操作方式</h3>
        <div class="control-list">${game.controls.map((control) => `<span>${control}</span>`).join("")}</div>
      </section>
      <div class="detail-actions">
        <button class="primary-action" type="button" data-start-game="${game.id}" ${disabled ? "disabled" : ""}>${disabled ? "待接入联机服务器" : "进入联机"}</button>
        <button type="button" data-close-detail>返回大厅</button>
      </div>
    `;
  }

  return `
    <div class="detail-hero" style="--game-color:${game.theme}">
      <span class="detail-cover" aria-hidden="true">${coverMarkup}</span>
      <div>
        <p class="eyebrow">${getCategoryLabel(game.category)}</p>
        <h2 id="detailTitle">${game.title} <small>v${game.version}</small></h2>
        <p>${game.description}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div><span>当前最高分</span><strong>${formatScore(record.highScore)}</strong></div>
      <div><span>已解锁</span><strong>${progress.unlockedLevel}/${maxLevel}</strong></div>
      <div><span>${clearOnly ? "已通关" : "关卡星星"}</span><strong>${clearOnly ? `${clearedCount}/${maxLevel}` : `${totalStars}/${maxLevel * 3}`}</strong></div>
      <div><span>街机币</span><strong>${journey.coins}</strong></div>
    </div>
    <section class="detail-section level-section">
      <div class="level-section-heading">
        <div>
          <h3>选择关卡</h3>
          <p>${clearOnly
            ? `第 ${selectedLevel} 关 · 清空所有可破坏砖块即可通过`
            : `第 ${selectedLevel} 关 · ${levelConfig.thresholds[0]} / ${levelConfig.thresholds[1]} / ${levelConfig.thresholds[2]} 分对应 1–3 星`}</p>
        </div>
        <strong>${clearOnly
          ? `<span class="journey-clear">${levelResult.cleared ? "✓ 已通关" : "未通关"}</span>`
          : renderStarRow(levelResult.stars)}</strong>
      </div>
      ${renderLevelGrid(game.id)}
      <div class="level-tools">
        <span>复活卡 ${journey.inventory["revive-card"] ?? 0}</span>
        <span>通关卡 ${journey.inventory["pass-card"] ?? 0}</span>
        ${clearOnly ? "" : `<span>星光徽章 ${journey.inventory["star-booster"] ?? 0}</span>`}
      </div>
      ${state.campaignMessage ? `<p class="campaign-message" role="status">${escapeHtml(state.campaignMessage)}</p>` : ""}
    </section>
    <section class="detail-section">
      <h3>操作方式</h3>
      <div class="control-list">${game.controls.map((control) => `<span>${control}</span>`).join("")}</div>
    </section>
    <section class="detail-section">
      <h3>最近 10 局</h3>
      <div class="recent-score-list">${recentScores}</div>
    </section>
    <div class="detail-options">
      <label><input type="checkbox" data-setting="soundEnabled" ${settings.soundEnabled ? "checked" : ""} /> 声音</label>
      <label><input type="checkbox" data-setting="vibrationEnabled" ${settings.vibrationEnabled ? "checked" : ""} /> 震动</label>
    </div>
    <div class="detail-actions">
      <button class="primary-action" type="button" data-start-game="${game.id}" data-start-level="${selectedLevel}" ${disabled ? "disabled" : ""}>
        ${disabled ? "即将开放" : `挑战第 ${selectedLevel} 关`}
      </button>
      <button type="button" data-pass-game="${game.id}" data-pass-level="${selectedLevel}" ${disabled || !journey.inventory["pass-card"] ? "disabled" : ""}>使用通关卡</button>
      <button type="button" data-close-detail>返回大厅</button>
    </div>
  `;
}

function closeDetail() {
  elements.detailLayer.hidden = true;
  state.detailGameId = "";
  document.body.classList.remove("modal-open");
}

/**
 * @param {string} gameId
 * @param {number} [requestedLevel]
 */
function launchGame(gameId, requestedLevel) {
  const game = findGame(gameId);
  if (!game || game.status !== "available") {
    return;
  }

  const progress = campaign.getGameProgress(gameId);
  const level = Math.min(progress.unlockedLevel, Math.max(1, Number(requestedLevel) || getSelectedLevel(gameId)));
  state.selectedLevels[gameId] = level;
  const gameUrl = game.multiplayer
    ? `${game.route}?from=lobby`
    : `${game.route}?from=lobby&level=${level}`;
  closeDetail();
  const gameBubbles = hamsterBalance.bubbles?.game ?? ["闻风，加油！"];
  state.hamsterMessage = gameBubbles[gameId.length % gameBubbles.length];
  elements.playerTitle.textContent = game.title;
  elements.playerMode.textContent = game.multiplayer ? "联机服务中" : "离线运行中";
  elements.openStandalone.href = gameUrl;
  elements.playerLoading.hidden = false;
  elements.playOverlay.classList.add("is-loading");
  elements.gameFrame.src = gameUrl;
  renderCompactHamsterStatus();
  elements.playOverlay.hidden = false;
  state.companionMenuOpen = false;
  renderRoamingHamster();
  document.body.classList.add("playing-game");
}

function closePlayer() {
  if (document.fullscreenElement === elements.playOverlay && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  elements.playOverlay.hidden = true;
  elements.gameFrame.src = "about:blank";
  elements.playerLoading.hidden = true;
  elements.playOverlay.classList.remove("is-loading");
  document.body.classList.remove("playing-game");
  render();
}

function togglePlayerFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
    return;
  }
  elements.playOverlay.requestFullscreen?.().catch(() => {});
}

function syncFullscreenButton() {
  const active = document.fullscreenElement === elements.playOverlay;
  elements.fullscreenButton.setAttribute("aria-label", active ? "退出全屏" : "进入全屏");
  elements.fullscreenButton.title = active ? "退出全屏" : "进入全屏";
  elements.fullscreenButton.setAttribute("aria-pressed", String(active));
}

/**
 * @param {"settings" | "about" | "records" | "achievements" | "hamster" | "shop"} view
 */
function openUtility(view) {
  state.utilityView = view;
  const card = elements.utilityContent.closest(".detail-card");
  if (card) {
    card.classList.toggle("hamster-utility-card", view === "hamster");
  }
  const content =
    view === "about"
      ? renderAbout()
      : view === "records"
        ? renderRecordsView()
        : view === "achievements"
          ? renderAchievements()
          : view === "shop"
            ? renderCampaignShop()
          : view === "hamster"
            ? renderHamsterHouse()
            : renderSettings();
  elements.utilityContent.innerHTML = view === "hamster" ? content : `${renderUtilityHamsterStrip()}${content}`;
  elements.utilityLayer.hidden = false;
  document.body.classList.add("modal-open");
}

function resetUtilityScroll() {
  const card = elements.utilityContent.closest(".detail-card");
  if (card) {
    card.scrollTop = 0;
  }
}

function closeUtility() {
  elements.utilityLayer.hidden = true;
  state.utilityView = "";
  document.body.classList.remove("modal-open");
}

function renderCampaignShop() {
  const journey = campaign.getSummary();
  return `
    <div class="campaign-shop">
      <div class="campaign-shop-head">
        <div>
          <p class="eyebrow">ARCADE SUPPLY</p>
          <h2 id="utilityTitle">道具商店</h2>
          <p>街机币来自关卡星级，与仓鼠币分开保存。</p>
        </div>
        <div class="campaign-wallet"><span>街机币</span><strong>${journey.coins}</strong></div>
      </div>
      ${state.campaignMessage ? `<p class="campaign-message" role="status">${escapeHtml(state.campaignMessage)}</p>` : ""}
      <div class="campaign-shop-list">
        ${campaign.SHOP_ITEMS.map((item) => {
          const quantity = journey.inventory[item.id] ?? 0;
          return `
            <article class="campaign-shop-item">
              <span class="campaign-item-icon" aria-hidden="true">${item.icon}</span>
              <div>
                <strong>${item.name}</strong>
                <p>${item.description}</p>
                <small>持有 ${quantity}</small>
              </div>
              <button type="button" data-shop-buy="${item.id}" ${journey.coins < item.price ? "disabled" : ""}>
                ${item.price} 币
              </button>
            </article>
          `;
        }).join("")}
      </div>
      <div class="campaign-shop-note">
        <strong>使用规则</strong>
        <p>复活卡由支持复活的动作游戏在失败时使用；通关卡可在游戏详情里开启下一关；星光徽章会在下一次成功结算时自动生效。</p>
      </div>
      <div class="detail-actions">
        <button type="button" data-close-utility>返回大厅</button>
      </div>
    </div>
  `;
}

function renderSettings() {
  const settings = getSettings();
  const authAccount = globalThis.CrediusArcadeAuth?.getAccount?.();
  return `
    <h2 id="utilityTitle">设置</h2>
    <div class="settings-list">
      <label>
        <span>本地昵称</span>
        <input type="text" maxlength="18" value="${escapeHtml(settings.nickname)}" data-settings-nickname />
      </label>
      <label>
        <span>声音</span>
        <input type="checkbox" data-settings-toggle="soundEnabled" ${settings.soundEnabled ? "checked" : ""} />
      </label>
      <label>
        <span>震动</span>
        <input type="checkbox" data-settings-toggle="vibrationEnabled" ${settings.vibrationEnabled ? "checked" : ""} />
      </label>
      <label>
        <span>减少动态效果</span>
        <input type="checkbox" data-settings-toggle="reduceMotion" ${settings.reduceMotion ? "checked" : ""} />
      </label>
      <label>
        <span>小游戏中显示宠物入口</span>
        <input type="checkbox" data-settings-toggle="showHamsterInGames" ${settings.showHamsterInGames ? "checked" : ""} />
      </label>
      <label>
        <span>仓鼠音效</span>
        <input type="checkbox" data-settings-toggle="hamsterSoundEnabled" ${settings.hamsterSoundEnabled ? "checked" : ""} />
      </label>
      <label>
        <span>仓鼠震动反馈</span>
        <input type="checkbox" data-settings-toggle="hamsterVibrationEnabled" ${settings.hamsterVibrationEnabled ? "checked" : ""} />
      </label>
      <label>
        <span>自动领取已完成工作奖励</span>
        <input type="checkbox" data-settings-toggle="hamsterAutoClaimRewards" ${settings.hamsterAutoClaimRewards ? "checked" : ""} />
      </label>
      <label>
        <span>显示状态数字</span>
        <input type="checkbox" data-settings-toggle="hamsterShowNumbers" ${settings.hamsterShowNumbers ? "checked" : ""} />
      </label>
      <label>
        <span>首页宠物区域默认折叠</span>
        <input type="checkbox" data-settings-toggle="hamsterLobbyCollapsed" ${settings.hamsterLobbyCollapsed ? "checked" : ""} />
      </label>
      <label>
        <span>仓鼠动画</span>
        <select data-settings-select="hamsterAnimationMode">
          <option value="full" ${settings.hamsterAnimationMode === "full" ? "selected" : ""}>完整</option>
          <option value="simple" ${settings.hamsterAnimationMode === "simple" ? "selected" : ""}>简化</option>
          <option value="off" ${settings.hamsterAnimationMode === "off" ? "selected" : ""}>关闭</option>
        </select>
      </label>
      <label>
        <span>气泡文案频率</span>
        <select data-settings-select="hamsterBubbleFrequency">
          <option value="normal" ${settings.hamsterBubbleFrequency === "normal" ? "selected" : ""}>正常</option>
          <option value="low" ${settings.hamsterBubbleFrequency === "low" ? "selected" : ""}>较少</option>
          <option value="quiet" ${settings.hamsterBubbleFrequency === "quiet" ? "selected" : ""}>安静</option>
        </select>
      </label>
      <label>
        <span>清除某个游戏成绩</span>
        <select data-clear-game>
          ${gameDefinitions.map((game) => `<option value="${game.id}">${game.title}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="detail-actions">
      <button type="button" data-clear-selected>清除所选成绩</button>
      <button type="button" data-clear-all>清除全部游戏记录</button>
    </div>
    <section class="auth-settings-card native-only">
      <div>
        <span>本机登录账号</span>
        <strong>${escapeHtml(authAccount?.username ?? "尚未创建")}</strong>
      </div>
      <button type="button" data-auth-lock>锁定应用</button>
    </section>
    <section class="hamster-save-tools">
      <h3>仓鼠本地存档</h3>
      <textarea data-hamster-transfer placeholder="导出时会显示 JSON；导入时把 JSON 放在这里。">${escapeHtml(state.hamsterTransferText)}</textarea>
      <div class="detail-actions">
        <button type="button" data-hamster-export>导出仓鼠存档</button>
        <button type="button" data-hamster-import>导入仓鼠存档</button>
      </div>
      <button class="danger-action" type="button" data-hamster-reset>重置仓鼠数据</button>
      <p>重置只会删除仓鼠、背包、仓鼠币、仓鼠任务和仓鼠成就，不影响小游戏最高分。</p>
    </section>
  `;
}

function renderAbout() {
  const accessDescription = globalThis.CrediusArcadeAuth?.isNativeApp?.()
    ? "使用本机私人账号进入，不依赖后端；游戏成绩和仓鼠存档都留在这台设备里。"
    : "不需要登录，不依赖后端，把分数和回忆都留在这台设备里。";
  return `
    <h2 id="utilityTitle">关于作者</h2>
    <div class="about-block">
      <span class="brand-symbol about-symbol" aria-hidden="true">C</span>
      <p><strong>CREDIUS ARCADE</strong> 是闻风 Credius 制作的原创离线小游戏集合。</p>
      <p>它更像一间私人收藏的精品街机厅：${accessDescription}</p>
      <p>当前版本 <strong>v${versionManifest.release.version}</strong> · ${versionManifest.release.name}</p>
      <p class="made-line">Made by 闻风 · Credius</p>
    </div>
  `;
}

function renderRecordsView() {
  const records = getAllRecords(gameIds);
  const rows = gameDefinitions
    .map((game) => {
      const record = records[game.id];
      return `
        <div class="record-detail-row" style="--game-color:${game.theme}">
          <span class="mini-icon">${game.icon}</span>
          <strong>${game.title}</strong>
          <span>最高 ${formatScore(record.highScore)}</span>
          <span>${record.totalPlays} 次</span>
          <span>${formatRelativeTime(record.lastPlayedAt)}</span>
        </div>
      `;
    })
    .join("");

  return `<h2 id="utilityTitle">全部成绩</h2><div class="record-detail-list">${rows}</div>`;
}

function renderAchievements() {
  const summary = getPlayerSummary(getAllRecords(gameIds));
  const hamster = getHamsterSaveData();
  const achievements = [
    ["第一次进厅", summary.totalPlays > 0],
    ["十局以后", summary.totalPlays >= 10],
    ["千分挑战", Object.values(getAllRecords(gameIds)).some((record) => record.highScore >= 1000)],
    ["私人收藏", Object.values(getAllRecords(gameIds)).some((record) => record.favorite)],
    ["全馆巡礼", summary.triedGames >= availableGameCount],
  ];
  const hamsterAchievements = hamsterBalance.achievements.map((achievement) => [
    achievement.title,
    hamster.profile.achievements.includes(achievement.id),
    achievement.description,
  ]);

  return `
    <h2 id="utilityTitle">成就</h2>
    <div class="achievement-list">
      ${achievements
        .map(
          ([title, unlocked]) => `
            <div class="achievement ${unlocked ? "unlocked" : ""}">
              <span>${unlocked ? "已解锁" : "未解锁"}</span>
              <strong>${title}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <h3 class="utility-subtitle">仓鼠成就</h3>
    <div class="achievement-list">
      ${hamsterAchievements
        .map(
          ([title, unlocked, description]) => `
            <div class="achievement ${unlocked ? "unlocked" : ""}">
              <span>${unlocked ? "已解锁" : "未解锁"}</span>
              <strong>${title}</strong>
              <small>${description}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderHamsterHouse() {
  const save = getHamsterSaveData();
  const derived = getHamsterStatus();
  const sceneMode = getHamsterHouseSceneMode(save);

  if (!save.adopted) {
    return `
      <div class="hamster-house-view adoption-view">
        <h2 id="utilityTitle">Credius Hamster｜闻风仓鼠屋</h2>
        <div class="hamster-house-adoption">
          <div class="hamster-house-scene">
            ${renderHamsterAvatar(save)}
            ${renderHamsterBubble("纸箱轻轻晃了一下。")}
          </div>
          <div>
            <p class="eyebrow">新的伙伴</p>
            <h3>邀请闻风的小仓鼠入住。</h3>
            <p>默认名字是“团团”，你也可以现在改名。新手物品会自动放进背包。</p>
            <label class="hamster-name-field">
              <span>仓鼠名称</span>
              <input type="text" maxlength="12" value="团团" data-hamster-name-input autocomplete="off" />
            </label>
            <div class="hamster-actions">
              <button class="primary-action" type="button" data-hamster-create>邀请入住</button>
              <button type="button" data-close-utility>稍后再说</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="hamster-house-view">
      <div class="hamster-house-head">
        <div>
          <p class="eyebrow">Credius Hamster｜闻风仓鼠屋</p>
          <h2 id="utilityTitle">${escapeHtml(save.profile.name)} · Lv.${save.profile.level}</h2>
        </div>
        <div class="hamster-house-coins"><span>仓鼠币</span><strong>${save.profile.coins}</strong></div>
      </div>
      <div class="hamster-house-profile">
        <label>
          <span>修改名称</span>
          <input type="text" maxlength="12" value="${escapeHtml(save.profile.name)}" data-hamster-rename-input />
        </label>
        <button type="button" data-hamster-rename>保存名称</button>
        <button type="button" data-action="settings">设置</button>
      </div>
      <div class="hamster-house-grid">
        <section class="hamster-house-scene room-${escapeHtml(save.profile.activeRoomThemeId ?? "room.default").replace(".", "-")} scene-${sceneMode}">
          <span class="hamster-room-window" aria-hidden="true"></span>
          <span class="hamster-room-floor" aria-hidden="true"></span>
          <span class="hamster-scene-ambience" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <button class="hamster-avatar-button" type="button" data-hamster-action="pet" aria-label="抚摸仓鼠">
            ${renderHamsterAvatar(save)}
          </button>
          ${renderHamsterBubble(state.hamsterMessage || derived.notice)}
          <div class="hamster-room-furniture" aria-hidden="true">
            <span class="furniture food-bowl"></span>
            <span class="furniture water-bottle"></span>
            <span class="furniture bed"></span>
            <span class="furniture tub"></span>
            <span class="furniture shelf"></span>
          </div>
        </section>
        <section class="hamster-status-card">
          <div class="hamster-house-level">
            <span>经验</span>
            <i><b style="width:${derived.levelProgress}%"></b></i>
          </div>
          <div class="hamster-house-emotion">
            <span>当前表情</span>
            <strong>${escapeHtml(derived.emotion)}</strong>
          </div>
          ${renderHamsterActivitySummary(save)}
          ${renderHamsterMeters(save)}
          ${renderNewbieGuide(save)}
        </section>
      </div>
      <nav class="hamster-house-tabs" aria-label="仓鼠屋功能">
        ${renderHamsterTabButton("care", "照顾", "care")}
        ${renderHamsterTabButton("activity", "工作外出", "work")}
        ${renderHamsterTabButton("study", "学习", "study")}
        ${renderHamsterTabButton("shop", "商店", "shop")}
        ${renderHamsterTabButton("bag", "背包装扮", "bag")}
        ${renderHamsterTabButton("tasks", "任务成就", "tasks")}
      </nav>
      ${renderHamsterHouseTab(save)}
    </div>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {"home" | "dining" | "play" | "bath" | "sleep" | "work" | "shop" | "study"}
 */
function getHamsterHouseSceneMode(save) {
  if (state.hamsterHouseTab === "shop") return "shop";
  if (state.hamsterHouseTab === "study") return "study";
  if (state.hamsterHouseTab === "activity") return "work";
  return getHamsterSceneMode(save);
}

/**
 * @param {string} id
 * @param {string} label
 * @param {string} icon
 * @returns {string}
 */
function renderHamsterTabButton(id, label, icon) {
  return `<button type="button" class="${state.hamsterHouseTab === id ? "active" : ""}" data-hamster-tab="${id}">${renderHamsterIcon(icon)}<span>${label}</span></button>`;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderNewbieGuide(save) {
  const steps = [
    ["第一次喂食", save.profile.statistics.totalFeedings > 0],
    ["第一次抚摸", save.profile.statistics.totalPettings > 0],
    ["查看状态", true],
  ];
  const done = steps.every(([, complete]) => complete);
  if (done) {
    return "";
  }
  return `
    <div class="hamster-guide">
      <strong>入住小引导</strong>
      ${steps
        .map(([label, complete]) => `<span class="${complete ? "done" : ""}">${complete ? "已完成" : "待完成"} · ${label}</span>`)
        .join("")}
      <small>可以跳过，仓鼠不会因为没完成引导而受影响。</small>
    </div>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterHouseTab(save) {
  if (state.hamsterHouseTab === "activity") {
    return renderHamsterActivityTab(save);
  }
  if (state.hamsterHouseTab === "shop") {
    return renderHamsterShopTab(save);
  }
  if (state.hamsterHouseTab === "study") {
    return renderHamsterStudyTab(save);
  }
  if (state.hamsterHouseTab === "bag") {
    return renderHamsterBagTab(save);
  }
  if (state.hamsterHouseTab === "tasks") {
    return renderHamsterTasksTab(save);
  }
  return renderHamsterCareTab(save);
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterCareTab(save) {
  const foods = hamsterBalance.foods
    .map((food) => ({ food, quantity: getOwnedQuantity(save, food.id) }))
    .map(
      ({ food, quantity }) => `
        <div class="hamster-shop-item ${quantity ? "" : "muted"}">
          <span class="hamster-item-icon">${food.icon}</span>
          <div>
            <strong>${food.name}</strong>
            <small>数量 ${quantity} · 饱腹 +${food.hunger} · 快乐 +${food.happiness} · ${food.preference === "like" ? "喜欢" : "普通"}</small>
          </div>
          <button type="button" data-hamster-feed="${food.id}" ${quantity ? "" : "disabled"}>${renderHamsterIcon("feed")}<span>喂食</span></button>
        </div>
      `,
    )
    .join("");
  const toys = hamsterBalance.shopItems
    .filter((item) => item.category === "toy")
    .map(
      (toy) => `
        <div class="hamster-shop-item ${getOwnedQuantity(save, toy.id) ? "" : "muted"}">
          <span class="hamster-item-icon">${toy.icon}</span>
          <div>
            <strong>${toy.name}</strong>
            <small>${toy.description} · 精力 -${toy.energyCost ?? hamsterBalance.action.playEnergyCost}</small>
          </div>
          <button type="button" data-hamster-play="${toy.id}" ${getOwnedQuantity(save, toy.id) ? "" : "disabled"}>${renderHamsterIcon("play")}<span>玩</span></button>
        </div>
      `,
    )
    .join("");
  return `
    <section class="hamster-tab-panel">
      <div class="hamster-section-head">
        <h3>照顾和互动</h3>
        <p>喂食、洗澡、抚摸和玩耍都有冷却或消耗，不会无限刷数值。</p>
      </div>
      <div class="hamster-actions care-actions">
        <button type="button" data-hamster-action="bath">${renderHamsterIcon("bath")}<span>洗澡</span></button>
        <button type="button" data-hamster-action="pet">${renderHamsterIcon("pet")}<span>抚摸</span></button>
        <button type="button" data-hamster-action="sleep">${renderHamsterIcon("sleep")}<span>${save.profile.currentActivity?.type === "sleep" ? "叫醒" : "睡觉"}</span></button>
        <button type="button" data-hamster-action="medicine">${renderHamsterIcon("care")}<span>舒缓草药</span></button>
      </div>
      <div class="hamster-list two-col">${foods}</div>
      <div class="hamster-section-head compact"><h3>玩具</h3></div>
      <div class="hamster-list two-col">${toys}</div>
    </section>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterActivityTab(save) {
  return `
    <section class="hamster-tab-panel">
      <div class="hamster-section-head">
        <h3>工作赚钱</h3>
        <p>工作离线也会计时，完成后只能领取一次；提前结束会按比例减少收益。</p>
      </div>
      <div class="hamster-list two-col">${hamsterBalance.jobs.map((job) => renderLargeActivityCard(save, job, "work")).join("")}</div>
      <div class="hamster-section-head">
        <h3>外出游玩</h3>
        <p>外出主要提升快乐和亲密度，也可能带回收藏。</p>
      </div>
      <div class="hamster-list two-col">${hamsterBalance.outings.map((outing) => renderLargeActivityCard(save, outing, "outing")).join("")}</div>
    </section>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterStudyTab(save) {
  const learnedCount = hamsterBalance.studies.filter((study) => save.unlockedContent.includes(study.skillId)).length;
  return `
    <section class="hamster-tab-panel hamster-study-panel">
      <div class="hamster-section-head">
        <h3>团团的学习角</h3>
        <p>课程离线也会继续。学完后永久掌握技能，并解锁对应高级工作；已学课程不会重复消耗。</p>
      </div>
      <div class="hamster-study-progress">
        <span>${renderHamsterIcon("study")}</span>
        <div><strong>已掌握 ${learnedCount} / ${hamsterBalance.studies.length}</strong><small>数学、街机维护、路线规划与创意设计</small></div>
      </div>
      <div class="hamster-list two-col">
        ${hamsterBalance.studies
          .map((study) => {
            const learned = save.unlockedContent.includes(study.skillId);
            const locked = save.profile.level < study.unlockLevel;
            const disabled = learned || locked || Boolean(save.profile.currentActivity);
            const job = hamsterBalance.jobs.find((item) => item.id === study.unlocksJobId);
            return `
              <div class="hamster-shop-item study-card ${learned ? "learned" : locked ? "locked" : ""}">
                <span class="hamster-item-icon">${study.icon}</span>
                <div>
                  <strong>${escapeHtml(study.title)}${learned ? " · 已掌握" : ""}</strong>
                  <small>${escapeHtml(study.description)}</small>
                  <small>${study.durationMinutes} 分钟 · 精力 -${study.energyCost} · 完成经验 +${study.experience}</small>
                  <small>职业目标：${escapeHtml(job?.title ?? "新的高级工作")}</small>
                </div>
                <button type="button" data-hamster-study="${study.id}" ${disabled ? "disabled" : ""}>
                  ${learned ? "已学会" : locked ? `${study.unlockLevel} 级` : `${renderHamsterIcon("study")}<span>上课</span>`}
                </button>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @param {Record<string, unknown>} activity
 * @param {"work" | "outing"} type
 * @returns {string}
 */
function renderLargeActivityCard(save, activity, type) {
  const missingSkill = Boolean(activity.requiredSkillId && !save.unlockedContent.includes(String(activity.requiredSkillId)));
  const locked = save.profile.level < Number(activity.unlockLevel ?? 1) || missingSkill;
  const disabled = locked || Boolean(save.profile.currentActivity);
  const icon =
    type === "work"
      ? {
          "job.store": "store",
          "job.cafe": "cafe",
          "job.arcade_shift": "arcade",
          "job.delivery": "delivery",
          "job.studio": "studio",
          "job.night_guard": "night",
          "job.cashier_math": "study",
          "job.arcade_technician": "arcade",
          "job.route_planner": "delivery",
          "job.creative_planner": "studio",
        }[String(activity.id)] ?? "work"
      : {
          "outing.park": "park",
          "outing.riverside": "river",
          "outing.arcade": "arcade",
          "outing.funfair": "fair",
          "outing.camping": "camp",
        }[String(activity.id)] ?? "outing";
  return `
    <div class="hamster-shop-item activity-card ${locked ? "locked" : ""}">
      <span class="hamster-item-icon">${renderHamsterIcon(icon)}</span>
      <div>
        <strong>${escapeHtml(activity.title)}</strong>
        <small>${activity.description}</small>
        <small>${activity.durationMinutes} 分钟 · 精力 -${activity.energyCost} · 饱腹 -${activity.hungerCost}${type === "work" ? ` · 收益 ${activity.baseCoins} 币` : ` · 快乐 +${activity.happiness}`}</small>
      </div>
      <button type="button" data-hamster-${type}="${activity.id}" ${disabled ? "disabled" : ""}>${missingSkill ? "先学习" : locked ? `${activity.unlockLevel} 级` : `${renderHamsterIcon(icon)}<span>开始</span>`}</button>
    </div>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterShopTab(save) {
  const categories = [
    ["food", "食物"],
    ["toy", "玩具"],
    ["outfit", "服饰"],
    ["furniture", "家具"],
    ["room", "房间主题"],
    ["consumable", "消耗品"],
  ];
  return `
    <section class="hamster-tab-panel">
      <div class="hamster-section-head">
        <h3>仓鼠商店</h3>
        <p>只使用仓鼠币，没有充值、广告、抽卡或盲盒。同一天折扣固定。</p>
      </div>
      ${categories
        .map(([category, label]) => {
          const items = hamsterBalance.shopItems.filter((item) => item.category === category);
          if (!items.length) return "";
          return `<h4 class="hamster-shop-category">${label}</h4><div class="hamster-list two-col">${items.map((item) => renderShopItem(save, item)).join("")}</div>`;
        })
        .join("")}
    </section>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function renderShopItem(save, item) {
  const owned = getOwnedQuantity(save, String(item.id));
  const maxOwned = Number(item.maxOwned ?? 99);
  const locked = save.profile.level < Number(item.unlockLevel ?? 1);
  const soldOut = owned >= maxOwned;
  const discount = save.shopState.discountItemId === item.id ? save.shopState.discountRate : 1;
  const price = Math.ceil(Number(item.price ?? 0) * discount);
  const meta = [
    item.hunger ? `饱腹 +${item.hunger}` : "",
    item.happiness ? `快乐 +${item.happiness}` : "",
    item.health ? `健康 +${item.health}` : "",
    item.cleanliness ? `清洁 +${item.cleanliness}` : "",
    item.unlockLevel ? `${item.unlockLevel} 级解锁` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="hamster-shop-item ${locked || soldOut ? "muted" : ""}">
      <span class="hamster-item-icon">${item.icon}</span>
      <div>
        <strong>${escapeHtml(item.name)}${discount < 1 ? " · 今日折扣" : ""}</strong>
        <small>${escapeHtml(item.description ?? "")}</small>
        <small>${meta || "收藏物品"} · 已有 ${owned}</small>
      </div>
      <button type="button" data-hamster-buy="${item.id}" ${locked || soldOut ? "disabled" : ""}>${soldOut ? "已拥有" : `${price} 币`}</button>
    </div>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterBagTab(save) {
  const rows = save.profile.ownedItems
    .map((item) => {
      const info = getHamsterItemInfo(item.itemId) ?? { name: item.itemId, icon: "物", category: "item", description: "" };
      const isActive = save.profile.activeOutfitId === item.itemId || save.profile.activeRoomThemeId === item.itemId;
      const canEquip = info.category === "outfit" || info.category === "room";
      const canUse = info.category === "consumable";
      return `
        <div class="hamster-shop-item ${isActive ? "active" : ""}">
          <span class="hamster-item-icon">${info.icon}</span>
          <div>
            <strong>${escapeHtml(info.name)}${isActive ? " · 使用中" : ""}</strong>
            <small>${escapeHtml(info.description ?? "")}</small>
            <small>数量 ${item.quantity} · ${escapeHtml(info.category)}</small>
          </div>
          ${
            canEquip
              ? `<button type="button" data-hamster-equip="${item.itemId}" ${isActive ? "disabled" : ""}>${isActive ? "已启用" : "启用"}</button>`
              : canUse
                ? `<button type="button" data-hamster-use="${item.itemId}">使用</button>`
                : "<button type=\"button\" disabled>收藏</button>"
          }
        </div>
      `;
    })
    .join("");
  return `
    <section class="hamster-tab-panel">
      <div class="hamster-section-head">
        <h3>背包、换装和布置</h3>
        <p>服饰只改变视觉，不提供数值加成；家具效果保持很轻。</p>
      </div>
      <div class="hamster-list two-col">${rows || "<p>背包还是空的。</p>"}</div>
    </section>
  `;
}

/**
 * @param {import("./src/types").HamsterSaveData} save
 * @returns {string}
 */
function renderHamsterTasksTab(save) {
  const tasks = save.dailyTasks
    .map(
      (task) => `
        <div class="hamster-shop-item ${task.claimed ? "active" : ""}">
          <span class="hamster-item-icon">${task.claimed ? "领" : "任"}</span>
          <div>
            <strong>${escapeHtml(task.title)}</strong>
            <small>${task.progress}/${task.target} · 奖励 ${hamsterBalance.dailyTaskReward.coins} 币和经验</small>
          </div>
          <button type="button" data-hamster-claim-task="${task.taskId}" ${task.claimed || task.progress < task.target ? "disabled" : ""}>${task.claimed ? "已领取" : "领取"}</button>
        </div>
      `,
    )
    .join("");
  const achievements = hamsterBalance.achievements
    .map(
      (achievement) => `
        <div class="achievement ${save.profile.achievements.includes(achievement.id) ? "unlocked" : ""}">
          <span>${save.profile.achievements.includes(achievement.id) ? "已解锁" : "未解锁"}</span>
          <strong>${achievement.title}</strong>
          <small>${achievement.description}</small>
        </div>
      `,
    )
    .join("");
  return `
    <section class="hamster-tab-panel">
      <div class="hamster-section-head">
        <h3>每日任务</h3>
        <p>每天 3 个轻量目标，没有连续签到惩罚。</p>
      </div>
      <div class="hamster-list">${tasks}</div>
      <div class="hamster-section-head">
        <h3>仓鼠成就</h3>
      </div>
      <div class="achievement-list hamster-achievement-grid">${achievements}</div>
    </section>
  `;
}

/**
 * @param {string} action
 */
function handleQuickAction(action) {
  if (action === "continue") {
    const lastRecord = Object.values(getAllRecords(gameIds))
      .filter((record) => record.lastPlayedAt)
      .sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime())[0];
    if (lastRecord) {
      openDetail(lastRecord.gameId);
    } else {
      openUtility("records");
    }
    closeDrawer();
    return;
  }

  if (action === "favorites") {
    state.category = "favorite";
    render();
    closeDrawer();
    return;
  }

  if (action === "settings" || action === "about" || action === "records" || action === "achievements" || action === "shop") {
    openUtility(/** @type {"settings" | "about" | "records" | "achievements" | "shop"} */ (action));
    closeDrawer();
  }
}

function openDrawer() {
  elements.sidebar.classList.add("open");
  elements.drawerBackdrop.hidden = false;
}

function closeDrawer() {
  elements.sidebar.classList.remove("open");
  elements.drawerBackdrop.hidden = true;
}

/**
 * @param {string} message
 * @returns {boolean}
 */
function confirmTwice(message) {
  return window.confirm(message) && window.confirm("再次确认：该操作只影响本机，但无法撤销。");
}

/**
 * @param {import("./src/types").HamsterActionResult | {ok: boolean; message: string}} result
 * @param {string} [sound]
 * @param {string} [visualEffect]
 */
function applyHamsterResult(result, sound = "tap", visualEffect = "") {
  state.hamsterMessage = result.message;
  if (result.ok) {
    window.clearTimeout(hamsterEffectTimer);
    state.hamsterAnimation =
      visualEffect ||
      {
        food: "eating",
        water: "bathing",
        pet: "petting",
        play: "playing",
        sleep: "sleeping",
        coins: "working",
        level: "petting",
      }[sound] ||
      "";
    hamsterEffectTimer = window.setTimeout(() => {
      state.hamsterAnimation = "";
      renderHamsterPanel();
      renderRoamingHamster();
      if (!elements.utilityLayer.hidden && state.utilityView === "hamster") {
        openUtility("hamster");
      }
    }, 3400);
    showCompanionSpeech(result.message, state.hamsterAnimation || "idle");
  }
  playHamsterSound(sound);
  vibrateHamster(result.ok ? 18 : 8);
  render();
  if (!elements.utilityLayer.hidden && state.utilityView) {
    openUtility(/** @type {"settings" | "about" | "records" | "achievements" | "hamster"} */ (state.utilityView));
    if (result.ok && visualEffect) {
      resetUtilityScroll();
    }
  }
}

function triggerHamsterReaction() {
  const reactions = [
    { id: "rolling", message: "团团咕噜咕噜翻了一圈！", duration: 1250 },
    { id: "celebrating", message: "看到你，团团高兴得跳起来啦。", duration: 1500 },
    { id: "headtilt", message: "团团歪着脑袋认真看你。", duration: 1300 },
    { id: "wiggling", message: "团团抖抖毛，腮帮也跟着晃了晃。", duration: 1150 },
  ];
  const candidates = reactions.filter((reaction) => reaction.id !== state.hamsterLastReaction);
  const reaction = candidates[Math.floor(Math.random() * candidates.length)] ?? reactions[0];
  state.hamsterLastReaction = reaction.id;
  state.hamsterAnimation = reaction.id;
  state.hamsterMessage = reaction.message;
  window.clearTimeout(hamsterEffectTimer);
  playHamsterSound("pet");
  vibrateHamster(16);
  render();
  showCompanionSpeech(reaction.message, reaction.id);
  hamsterEffectTimer = window.setTimeout(() => {
    state.hamsterAnimation = "";
    renderHamsterPanel();
    renderRoamingHamster();
  }, reaction.duration);
}

/**
 * @param {string} action
 */
function runHamsterAction(action) {
  if (action === "bath") {
    applyHamsterResult(bathHamster(), "water", "bathing");
    return;
  }
  if (action === "pet") {
    applyHamsterResult(petHamster(), "pet", "petting");
    return;
  }
  if (action === "sleep") {
    const save = getHamsterSaveData();
    applyHamsterResult(
      save.profile.currentActivity?.type === "sleep" ? wakeHamster() : startHamsterSleep(),
      "sleep",
      save.profile.currentActivity?.type === "sleep" ? "petting" : "sleeping",
    );
    return;
  }
  if (action === "medicine") {
    applyHamsterResult(useHamsterConsumable("medicine.herb"), "pet");
  }
}

/**
 * @param {"feed" | "bath" | "play" | "sleep"} action
 */
function runCompanionDirectAction(action) {
  const save = getHamsterSaveData();
  if (action === "feed") {
    const food = hamsterBalance.foods.find((item) => getOwnedQuantity(save, item.id) > 0);
    if (!food) {
      applyHamsterResult({ ok: false, message: "背包里没有食物了，先去仓鼠商店补一点吧。" });
      return;
    }
    applyHamsterResult(feedHamster(food.id), "food", "eating");
    return;
  }
  if (action === "play") {
    const toy = hamsterBalance.shopItems.find((item) => item.category === "toy" && getOwnedQuantity(save, item.id) > 0);
    if (!toy) {
      applyHamsterResult({ ok: false, message: "还没有能玩的玩具，去商店挑一个吧。" });
      return;
    }
    applyHamsterResult(playHamster(toy.id), "play", toy.id === "toy.wheel" ? "running" : "playing");
    return;
  }
  runHamsterAction(action);
}

function claimCurrentHamsterActivity() {
  const save = getHamsterSaveData();
  const activity = save.profile.currentActivity;
  if (!activity) {
    applyHamsterResult({ ok: false, message: "当前没有可领取的活动。" });
    return;
  }
  if (activity.type === "sleep") {
    applyHamsterResult(wakeHamster(), "sleep");
    return;
  }
  const complete = getHamsterStatus().activityComplete;
  applyHamsterResult(claimHamsterActivity(new Date(), { early: !complete }), complete ? "coins" : "tap");
}

/**
 * @param {string} kind
 */
function playHamsterSound(kind) {
  const settings = getSettings();
  if (!settings.soundEnabled || !settings.hamsterSoundEnabled) {
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies = {
      tap: 420,
      pet: 520,
      food: 360,
      water: 640,
      sleep: 240,
      coins: 760,
      level: 880,
    };
    oscillator.type = kind === "sleep" ? "sine" : "triangle";
    oscillator.frequency.value = frequencies[kind] ?? frequencies.tap;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Sound feedback is optional.
  }
}

/**
 * @param {number} duration
 */
function vibrateHamster(duration) {
  const settings = getSettings();
  if (!settings.vibrationEnabled || !settings.hamsterVibrationEnabled || !navigator.vibrate) {
    return;
  }
  try {
    navigator.vibrate(duration);
  } catch {
    // Vibration support varies across WebView containers.
  }
}

document.addEventListener("click", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);
  const categoryButton = target.closest("[data-category]");
  const detailButton = target.closest("[data-detail], [data-more]");
  const favoriteButton = target.closest("[data-favorite]");
  const startButton = target.closest("[data-start-game]");
  const closeDetailButton = target.closest("[data-close-detail]");
  const closeUtilityButton = target.closest("[data-close-utility]");
  const actionButton = target.closest("[data-action]");
  const clearSelected = target.closest("[data-clear-selected]");
  const clearAll = target.closest("[data-clear-all]");
  const hamsterOpen = target.closest("[data-hamster-open]");
  const hamsterCreate = target.closest("[data-hamster-create]");
  const hamsterExpand = target.closest("[data-hamster-expand]");
  const hamsterCollapse = target.closest("[data-hamster-collapse]");
  const hamsterTool = target.closest("[data-hamster-tool]");
  const hamsterAction = target.closest("[data-hamster-action]");
  const hamsterFeed = target.closest("[data-hamster-feed]");
  const hamsterPlay = target.closest("[data-hamster-play]");
  const hamsterWork = target.closest("[data-hamster-work]");
  const hamsterStudy = target.closest("[data-hamster-study]");
  const hamsterOuting = target.closest("[data-hamster-outing]");
  const hamsterClaim = target.closest("[data-hamster-claim]");
  const hamsterBuy = target.closest("[data-hamster-buy]");
  const hamsterEquip = target.closest("[data-hamster-equip]");
  const hamsterUse = target.closest("[data-hamster-use]");
  const hamsterRename = target.closest("[data-hamster-rename]");
  const hamsterTab = target.closest("[data-hamster-tab]");
  const hamsterTask = target.closest("[data-hamster-claim-task]");
  const hamsterExport = target.closest("[data-hamster-export]");
  const hamsterImport = target.closest("[data-hamster-import]");
  const hamsterReset = target.closest("[data-hamster-reset]");
  const hamsterReact = target.closest("[data-hamster-react]");
  const selectLevel = target.closest("[data-select-level]");
  const shopBuy = target.closest("[data-shop-buy]");
  const passLevel = target.closest("[data-pass-game]");

  if (hamsterReact) {
    triggerHamsterReaction();
    return;
  }

  if (selectLevel instanceof HTMLElement) {
    const gameId = selectLevel.dataset.selectGame;
    const level = Number(selectLevel.dataset.selectLevel);
    if (gameId && level) {
      state.selectedLevels[gameId] = level;
      state.campaignMessage = "";
      openDetail(gameId);
    }
    return;
  }

  if (shopBuy instanceof HTMLElement) {
    const result = campaign.buyItem(shopBuy.dataset.shopBuy ?? "");
    state.campaignMessage = result.message;
    render();
    openUtility("shop");
    return;
  }

  if (passLevel instanceof HTMLElement) {
    const gameId = passLevel.dataset.passGame;
    const level = Number(passLevel.dataset.passLevel);
    if (gameId && level) {
      const result = campaign.usePassCard(gameId, level);
      state.campaignMessage = result.message;
      if (result.ok) {
        state.selectedLevels[gameId] = Math.min(campaign.getMaxLevel(gameId), level + 1);
      }
      render();
      openDetail(gameId);
    }
    return;
  }

  if (hamsterOpen) {
    openUtility("hamster");
    return;
  }

  if (hamsterCreate instanceof HTMLElement) {
    const scope = hamsterCreate.closest(".hamster-panel, .hamster-house-view") ?? document;
    const input = scope.querySelector("[data-hamster-name-input]");
    const name = input instanceof HTMLInputElement ? input.value : "团团";
    applyHamsterResult(adoptHamster(name), "level");
    state.hamsterHouseTab = "care";
    if (!elements.utilityLayer.hidden) {
      openUtility("hamster");
    }
    return;
  }

  if (hamsterExpand) {
    updateSettings({ hamsterLobbyCollapsed: false });
    render();
    return;
  }

  if (hamsterCollapse) {
    updateSettings({ hamsterLobbyCollapsed: true });
    render();
    return;
  }

  if (hamsterTool instanceof HTMLElement) {
    state.hamsterTool = hamsterTool.dataset.hamsterTool ?? "";
    renderHamsterPanel();
    return;
  }

  if (hamsterAction instanceof HTMLElement) {
    runHamsterAction(hamsterAction.dataset.hamsterAction ?? "");
    return;
  }

  if (hamsterFeed instanceof HTMLElement) {
    applyHamsterResult(feedHamster(hamsterFeed.dataset.hamsterFeed ?? ""), "food", "eating");
    return;
  }

  if (hamsterPlay instanceof HTMLElement) {
    applyHamsterResult(playHamster(hamsterPlay.dataset.hamsterPlay ?? "toy.ball"), "play", "playing");
    return;
  }

  if (hamsterWork instanceof HTMLElement) {
    applyHamsterResult(startHamsterWork(hamsterWork.dataset.hamsterWork ?? ""), "tap", "working");
    return;
  }

  if (hamsterStudy instanceof HTMLElement) {
    applyHamsterResult(startHamsterStudy(hamsterStudy.dataset.hamsterStudy ?? ""), "tap", "studying");
    return;
  }

  if (hamsterOuting instanceof HTMLElement) {
    applyHamsterResult(startHamsterOuting(hamsterOuting.dataset.hamsterOuting ?? ""), "tap", "outing");
    return;
  }

  if (hamsterClaim) {
    claimCurrentHamsterActivity();
    return;
  }

  if (hamsterBuy instanceof HTMLElement) {
    applyHamsterResult(buyHamsterItem(hamsterBuy.dataset.hamsterBuy ?? ""), "coins");
    return;
  }

  if (hamsterEquip instanceof HTMLElement) {
    applyHamsterResult(equipHamsterItem(hamsterEquip.dataset.hamsterEquip ?? ""), "pet");
    return;
  }

  if (hamsterUse instanceof HTMLElement) {
    applyHamsterResult(useHamsterConsumable(hamsterUse.dataset.hamsterUse ?? ""), "pet");
    return;
  }

  if (hamsterRename instanceof HTMLElement) {
    const input = elements.utilityContent.querySelector("[data-hamster-rename-input]");
    applyHamsterResult(renameHamster(input instanceof HTMLInputElement ? input.value : "团团"), "pet");
    return;
  }

  if (hamsterTab instanceof HTMLElement) {
    window.clearTimeout(hamsterEffectTimer);
    state.hamsterAnimation = "";
    state.hamsterMessage = "";
    state.hamsterHouseTab = hamsterTab.dataset.hamsterTab ?? "care";
    openUtility("hamster");
    resetUtilityScroll();
    return;
  }

  if (hamsterTask instanceof HTMLElement) {
    applyHamsterResult(claimHamsterDailyTask(hamsterTask.dataset.hamsterClaimTask ?? ""), "coins");
    return;
  }

  if (hamsterExport) {
    state.hamsterTransferText = exportHamsterData();
    openUtility("settings");
    return;
  }

  if (hamsterImport) {
    const textarea = elements.utilityContent.querySelector("[data-hamster-transfer]");
    const text = textarea instanceof HTMLTextAreaElement ? textarea.value : state.hamsterTransferText;
    const result = importHamsterData(text);
    state.hamsterTransferText = text;
    applyHamsterResult(result, "level");
    return;
  }

  if (hamsterReset && confirmTwice("确认重置仓鼠数据？这会删除仓鼠、仓鼠币、仓鼠背包、仓鼠任务和仓鼠成就，但不会影响小游戏成绩。")) {
    resetHamsterData();
    state.hamsterMessage = "仓鼠数据已重置。";
    state.hamsterTransferText = "";
    render();
    openUtility("settings");
    return;
  }

  if (categoryButton instanceof HTMLElement) {
    state.category = categoryButton.dataset.category ?? "all";
    render();
  }

  if (favoriteButton instanceof HTMLElement) {
    const gameId = favoriteButton.dataset.favorite;
    if (gameId) {
      const record = getGameRecord(gameId);
      setFavorite(gameId, !record.favorite);
      render();
      if (state.detailGameId === gameId) {
        openDetail(gameId);
      }
    }
  }

  if (detailButton instanceof HTMLElement) {
    const gameId = detailButton.dataset.detail ?? detailButton.dataset.more;
    if (gameId) {
      openDetail(gameId);
    }
  }

  if (startButton instanceof HTMLElement) {
    const gameId = startButton.dataset.startGame;
    if (gameId) {
      launchGame(gameId, Number(startButton.dataset.startLevel));
    }
  }

  if (closeDetailButton) {
    closeDetail();
  }

  if (closeUtilityButton) {
    closeUtility();
  }

  if (actionButton instanceof HTMLElement) {
    handleQuickAction(actionButton.dataset.action ?? "");
  }

  if (clearSelected) {
    const select = elements.utilityContent.querySelector("[data-clear-game]");
    if (select instanceof HTMLSelectElement && confirmTwice("确认清除所选游戏的成绩记录？")) {
      clearGameRecord(select.value);
      openUtility("settings");
      render();
    }
  }

  if (clearAll && confirmTwice("确认清除全部游戏记录？收藏状态也会重置。")) {
    clearAllLocalData();
    openUtility("settings");
    render();
  }
});

document.addEventListener("change", (event) => {
  const target = /** @type {HTMLInputElement | HTMLSelectElement} */ (event.target);
  const settingKey = target.dataset.setting || target.dataset.settingsToggle;
  const selectSettingKey = target.dataset.settingsSelect;

  if (settingKey) {
    updateSettings({ [settingKey]: target instanceof HTMLInputElement ? target.checked : target.value });
    if (state.detailGameId) {
      openDetail(state.detailGameId);
    }
    render();
  }

  if (selectSettingKey) {
    updateSettings({ [selectSettingKey]: target.value });
    render();
    if (!elements.utilityLayer.hidden && state.utilityView) {
      openUtility(/** @type {"settings" | "about" | "records" | "achievements" | "hamster"} */ (state.utilityView));
    }
  }
});

document.addEventListener("input", (event) => {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (target === elements.searchInput) {
    state.query = target.value;
    renderCards();
  }

  if (target === elements.nicknameInput || target.matches("[data-settings-nickname]")) {
    updateSettings({ nickname: target.value.trim() || "Player One" });
    renderSidebar();
  }

  if (target.matches("[data-hamster-transfer]")) {
    state.hamsterTransferText = target.value;
  }
});

elements.recordSort.addEventListener("change", () => {
  state.recordSort = elements.recordSort.value;
  renderSidebar();
});
elements.menuButton.addEventListener("click", openDrawer);
elements.drawerBackdrop.addEventListener("click", closeDrawer);
elements.searchToggle.addEventListener("click", () => {
  elements.searchPanel.hidden = !elements.searchPanel.hidden;
  if (!elements.searchPanel.hidden) {
    elements.searchInput.focus();
  }
});
elements.soundToggle.addEventListener("click", () => {
  updateSettings({ soundEnabled: !getSettings().soundEnabled });
  render();
});
elements.settingsButton.addEventListener("click", () => openUtility("settings"));
elements.closeDetail.addEventListener("click", closeDetail);
elements.closeUtility.addEventListener("click", closeUtility);
elements.closePlayer.addEventListener("click", closePlayer);
elements.fullscreenButton.addEventListener("click", togglePlayerFullscreen);
elements.gameFrame.addEventListener("load", () => {
  if (elements.gameFrame.src === "about:blank") {
    return;
  }
  elements.playerLoading.hidden = true;
  elements.playOverlay.classList.remove("is-loading");
  elements.gameFrame.focus();
});
document.addEventListener("fullscreenchange", syncFullscreenButton);
elements.roamingHamster.addEventListener("click", (event) => {
  event.stopPropagation();
  const target = /** @type {HTMLElement} */ (event.target);
  const dismiss = target.closest("[data-companion-dismiss]");
  const actionButton = target.closest("[data-companion-action]");
  const toggle = target.closest("[data-companion-toggle]");
  if (dismiss) {
    state.companionSpeech = "";
    renderRoamingHamster();
    return;
  }
  if (actionButton instanceof HTMLElement) {
    const action = actionButton.dataset.companionAction ?? "";
    state.companionMenuOpen = false;
    if (["feed", "bath", "play", "sleep"].includes(action)) {
      runCompanionDirectAction(/** @type {"feed" | "bath" | "play" | "sleep"} */ (action));
      return;
    }
  }
  if (toggle) {
    if (event.detail > 0 && Date.now() - companionLastPointerToggleAt < 1500) {
      return;
    }
    state.companionMenuOpen = !state.companionMenuOpen;
    if (state.companionMenuOpen && !state.companionSpeech) {
      state.companionSpeech = getCompanionSpeech(getHamsterSaveData());
    }
    renderRoamingHamster();
  }
});
elements.roamingHamster.addEventListener("pointerdown", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);
  if (!target.closest("[data-companion-drag]")) {
    return;
  }
  positionRoamingHamster();
  if (!state.companionPosition) {
    return;
  }
  companionDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.companionPosition.x,
    originY: state.companionPosition.y,
    moved: false,
  };
  elements.roamingHamster.classList.add("is-dragging");
});
elements.roamingHamster.addEventListener("pointermove", (event) => {
  if (!companionDrag || companionDrag.pointerId !== event.pointerId) {
    return;
  }
  const deltaX = event.clientX - companionDrag.startX;
  const deltaY = event.clientY - companionDrag.startY;
  if (Math.hypot(deltaX, deltaY) > 5) {
    if (!companionDrag.moved) {
      elements.roamingHamster.setPointerCapture(event.pointerId);
    }
    companionDrag.moved = true;
  }
  const rect = elements.roamingHamster.getBoundingClientRect();
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
  const minY = 64;
  const maxY = Math.max(minY, window.innerHeight - rect.height - 12);
  state.companionPosition = {
    x: Math.min(maxX, Math.max(margin, companionDrag.originX + deltaX)),
    y: Math.min(maxY, Math.max(minY, companionDrag.originY + deltaY)),
  };
  elements.roamingHamster.style.setProperty("--companion-x", `${state.companionPosition.x}px`);
  elements.roamingHamster.style.setProperty("--companion-y", `${state.companionPosition.y}px`);
});
elements.roamingHamster.addEventListener("pointerup", (event) => {
  if (!companionDrag || companionDrag.pointerId !== event.pointerId) {
    return;
  }
  const wasMoved = companionDrag.moved;
  companionDrag = null;
  elements.roamingHamster.classList.remove("is-dragging");
  if (elements.roamingHamster.hasPointerCapture(event.pointerId)) {
    elements.roamingHamster.releasePointerCapture(event.pointerId);
  }
  if (state.companionPosition) {
    const rect = elements.roamingHamster.getBoundingClientRect();
    const maxX = Math.max(1, window.innerWidth - rect.width - 16);
    const maxY = Math.max(1, window.innerHeight - rect.height - 76);
    updateSettings({
      hamsterCompanionX: Math.min(1, Math.max(0, (state.companionPosition.x - 8) / maxX)),
      hamsterCompanionY: Math.min(1, Math.max(0, (state.companionPosition.y - 64) / maxY)),
    });
  }
  if (!wasMoved) {
    companionLastPointerToggleAt = Date.now();
    state.companionMenuOpen = !state.companionMenuOpen;
    if (state.companionMenuOpen && !state.companionSpeech) {
      state.companionSpeech = getCompanionSpeech(getHamsterSaveData());
    }
    renderRoamingHamster();
  }
});
elements.roamingHamster.addEventListener("pointercancel", () => {
  companionDrag = null;
  elements.roamingHamster.classList.remove("is-dragging");
});

window.addEventListener("message", (event) => {
  if (event.data?.type === "credius:close-game") {
    closePlayer();
  }
  if (event.data?.type === "credius:records-updated") {
    render();
  }
  if (event.data?.type === "credius:campaign-result") {
    const settlement = event.data.settlement;
    state.campaignMessage = settlement?.passed
      ? settlement.ratingMode === "clear"
        ? `第 ${settlement.level} 关已清场，获得 ${settlement.coins} 枚街机币。`
        : `第 ${settlement.level} 关获得 ${settlement.stars} 星和 ${settlement.coins} 枚街机币。`
      : settlement?.ratingMode === "clear"
        ? `第 ${settlement?.level ?? 1} 关尚未清空所有可破坏砖块。`
        : `第 ${settlement?.level ?? 1} 关尚未达到过关分数。`;
    render();
  }
  if (event.data?.type === "credius:hamster-reward") {
    state.hamsterMessage = event.data.reward?.message ?? "团团在大厅等你回来。";
    renderCompactHamsterStatus();
  }
});
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncHamsterSaveData();
    render();
    scheduleCompanionBehavior();
  } else {
    syncHamsterSaveData();
    window.clearTimeout(companionBehaviorTimer);
  }
});
window.addEventListener("resize", () => {
  state.companionPosition = null;
  positionRoamingHamster();
});
window.addEventListener("pagehide", () => syncHamsterSaveData());
window.addEventListener("beforeunload", () => syncHamsterSaveData());
window.addEventListener("credius-records-changed", render);
window.addEventListener("credius-campaign-changed", render);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.playOverlay.hidden) {
      closePlayer();
    } else if (!elements.detailLayer.hidden) {
      closeDetail();
    } else if (!elements.utilityLayer.hidden) {
      closeUtility();
    } else {
      closeDrawer();
    }
  }
});

syncHamsterSaveData();
render();
scheduleCompanionBehavior();
})();
