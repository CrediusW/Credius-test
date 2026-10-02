// @ts-check

/**
 * @typedef {"available" | "coming-soon"} GameStatus
 * @typedef {"score" | "time" | "level" | "wins"} ScoringType
 * @typedef {import("./types").GameDefinition} GameDefinition
 */

(function () {
  "use strict";

const versionManifest = globalThis.CrediusArcadeVersions;

/**
 * @param {string} gameId
 * @returns {string}
 */
function versionForGame(gameId) {
  const game = versionManifest?.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error(`Missing version manifest entry for game: ${gameId}`);
  }
  return game.version;
}

const categoryFilters = [
  { id: "all", label: "全部" },
  { id: "puzzle", label: "益智" },
  { id: "arcade", label: "街机" },
  { id: "action", label: "动作" },
  { id: "reaction", label: "反应" },
  { id: "strategy", label: "策略" },
  { id: "casual", label: "休闲" },
  { id: "multiplayer", label: "多人" },
  { id: "favorite", label: "收藏" },
];

/** @type {Record<string, string>} */
const categoryLabels = Object.fromEntries(
  categoryFilters.map((category) => [category.id, category.label]),
);

/** @type {GameDefinition[]} */
const gameDefinitions = [
  {
    id: "2048",
    version: versionForGame("2048"),
    title: "2048",
    subtitle: "选择方块，合并数字",
    description: "点选一个数字方块，用方向键或滑动推动它，合并出更大的数字。",
    category: "puzzle",
    categories: ["puzzle", "strategy", "casual"],
    icon: "C2",
    cover: "assets/game-icons/2048.png",
    route: "games/2048/index.html",
    status: "available",
    theme: "#66d9c8",
    controls: ["点击选择方块", "方向键 / WASD", "手机端可滑动棋盘"],
    scoringType: "score",
    badge: "新体验",
  },
  {
    id: "happy-match",
    version: versionForGame("happy-match"),
    title: "开心消消乐",
    subtitle: "果冻连线，星光爆开",
    description: "交换相邻果冻凑齐三个，在十个星光关卡里唤醒有趣道具；达到目标分就立即通关。",
    category: "puzzle",
    categories: ["puzzle", "casual", "reaction"],
    icon: "HM",
    cover: "games/happy-match/assets/cover.svg",
    route: "games/happy-match/index.html",
    status: "available",
    theme: "#ff78b5",
    controls: ["点击或滑动交换", "三枚同色即可消除", "关卡中途解锁专属道具"],
    scoringType: "score",
    badge: "10 关挑战",
  },
  {
    id: "tank-battle",
    version: versionForGame("tank-battle"),
    title: "坦克大战",
    subtitle: "守住基地，清空敌军",
    description: "驾驶坦克穿过砖墙与钢墙，保护基地并推进更高关卡。",
    category: "action",
    categories: ["action", "arcade", "strategy"],
    icon: "TK",
    cover: "assets/game-icons/tank-battle-v2.png",
    route: "games/tank-battle/index.html",
    status: "available",
    theme: "#f1b84b",
    controls: ["方向键 / WASD 移动", "空格键开火", "手机端方向盘 + 开火键"],
    scoringType: "score",
  },
  {
    id: "last-stand",
    version: versionForGame("last-stand"),
    title: "Last Stand",
    subtitle: "横向走位，火力压住数字",
    description: "带着小队左右移动，让自动火力打爆滚来的数字补给，解锁机枪、弹药和士兵，顶住最后 Boss。",
    category: "action",
    categories: ["action", "arcade", "reaction", "strategy"],
    icon: "LS",
    cover: "assets/game-icons/last-stand.svg",
    route: "games/last-stand/index.html",
    status: "available",
    theme: "#ffd666",
    controls: ["方向键 / A D 左右移动", "拖动移动", "自动射击"],
    scoringType: "score",
    badge: "新关卡",
  },
  {
    id: "tetris",
    version: versionForGame("tetris"),
    title: "俄罗斯方块",
    subtitle: "旋转、下落、消行",
    description: "控制不同形状的方块落位，连续消行获得更高分和等级。",
    category: "reaction",
    categories: ["reaction", "puzzle", "arcade"],
    icon: "TR",
    cover: "assets/game-icons/tetris.png",
    route: "games/tetris/index.html",
    status: "available",
    theme: "#7aa7ff",
    controls: ["方向键移动", "上键 / W 旋转", "下键软降", "空格硬降"],
    scoringType: "score",
    badge: "首版",
  },
  {
    id: "snake",
    version: versionForGame("snake"),
    title: "贪吃蛇",
    subtitle: "越长越难回头",
    description: "经典吃豆成长玩法，规划路线并避开自己的身体。",
    category: "reaction",
    categories: ["reaction", "casual", "arcade"],
    icon: "SN",
    cover: "assets/game-icons/snake.png",
    route: "games/snake/index.html",
    status: "available",
    theme: "#8bd66d",
    controls: ["方向键 / WASD", "手机端滑动", "触控方向键"],
    scoringType: "score",
    badge: "新上架",
  },
  {
    id: "minesweeper",
    version: versionForGame("minesweeper"),
    title: "扫雷",
    subtitle: "用逻辑拆开地雷阵",
    description: "根据数字提示推理雷区，安全揭开所有格子。",
    category: "strategy",
    categories: ["strategy", "puzzle"],
    icon: "MN",
    cover: "assets/game-icons/minesweeper.png",
    route: "games/minesweeper/index.html",
    status: "available",
    theme: "#d1ba75",
    controls: ["点击翻开", "长按标记"],
    scoringType: "time",
    badge: "新上架",
  },
  {
    id: "breakout",
    version: versionForGame("breakout"),
    title: "打砖块",
    subtitle: "反弹、瞄准、闯五关",
    description: "移动挡板接住小球，在五个手工砖阵中清空可破坏砖块，接住补给道具后继续闯关。",
    category: "arcade",
    categories: ["arcade", "reaction", "casual"],
    icon: "BK",
    cover: "assets/game-icons/breakout.png",
    route: "games/breakout/index.html",
    status: "available",
    theme: "#ff8a65",
    controls: ["清空全部可破坏砖块", "左右移动或拖动挡板", "接住特殊砖掉落的补给"],
    scoringType: "score",
    badge: "5 关重制",
  },
  {
    id: "sudoku",
    version: versionForGame("sudoku"),
    title: "数独",
    subtitle: "安静的九宫格挑战",
    description: "在行列宫中填入数字，完成一局耐心推理。",
    category: "puzzle",
    categories: ["puzzle", "strategy", "casual"],
    icon: "SD",
    cover: "assets/game-icons/sudoku.png",
    route: "games/sudoku/index.html",
    status: "available",
    theme: "#c5a3ff",
    controls: ["点击格子", "数字键输入"],
    scoringType: "time",
    badge: "新上架",
  },
  {
    id: "sokoban",
    version: versionForGame("sokoban"),
    title: "推箱子",
    subtitle: "一步错，整局重想",
    description: "把箱子推到目标点，考验空间规划和撤退路线。",
    category: "strategy",
    categories: ["strategy", "puzzle"],
    icon: "SB",
    cover: "assets/game-icons/sokoban.png",
    route: "games/sokoban/index.html",
    status: "available",
    theme: "#9fc2a7",
    controls: ["方向键 / WASD", "撤销一步", "触控方向键"],
    scoringType: "level",
    badge: "新上架",
  },
  {
    id: "space-shooter",
    version: versionForGame("space-shooter"),
    title: "太空射击",
    subtitle: "小屏幕上的弹幕练习",
    description: "操控飞船穿过敌机与弹幕，坚持更久并击落更多目标。",
    category: "arcade",
    categories: ["arcade", "action", "reaction"],
    icon: "SP",
    cover: "assets/game-icons/space-shooter.png",
    route: "games/space-shooter/index.html",
    status: "available",
    theme: "#7bdff2",
    controls: ["拖动移动", "方向键 / A D", "自动射击"],
    scoringType: "score",
    badge: "新上架",
  },
  {
    id: "super-mary",
    version: versionForGame("super-mary"),
    title: "王子历险记",
    subtitle: "探索星辉山谷，挑战雷霆巨兽",
    description: "原创横版平台历险：探索高低路线，收集太阳金币和能力道具，穿过机关并击败山谷 Boss。",
    category: "action",
    categories: ["action", "arcade", "reaction"],
    icon: "PR",
    cover: "assets/game-icons/prince-adventure.svg",
    route: "games/super-mary/index.html",
    status: "available",
    theme: "#e6b85c",
    controls: ["方向键 / A D 移动", "空格 / W 跳跃", "踩怪、收集道具并探索隐藏路线"],
    scoringType: "score",
    badge: "全面升级",
  },
  {
    id: "four-army-chess",
    version: versionForGame("four-army-chess"),
    title: "四国军棋",
    subtitle: "四人全暗，对家协同作战",
    description: "经典四国陆战棋：服务端合法布阵与交锋裁决，四名真人通过房间码对战，终局可逐步明棋复盘。",
    category: "multiplayer",
    categories: ["multiplayer", "strategy"],
    icon: "军",
    cover: "assets/game-icons/four-army-chess.svg",
    route: "games/four-army-chess/index.html",
    status: "coming-soon",
    theme: "#d9a83d",
    controls: ["四名真人进入同一房间", "点击己方棋子和合法落点", "终局逐步明棋复盘"],
    scoringType: "wins",
    badge: "四人全暗",
    multiplayer: true,
  },
  {
    id: "ludo",
    version: versionForGame("ludo"),
    title: "飞行棋",
    subtitle: "好友联机，也能和机器人开局",
    description: "经典中国飞行棋：四角机场、同色跳跃和跨棋盘飞行线。支持 2 至 4 人实时联机，房主可添加自动行动的机器人。",
    category: "multiplayer",
    categories: ["multiplayer", "strategy", "casual"],
    icon: "L4",
    cover: "assets/game-icons/ludo.svg",
    route: "games/ludo/index.html",
    status: "coming-soon",
    theme: "#68d5bd",
    controls: ["创建或输入 6 位房间码", "房主可添加机器人", "点击发光的飞机走棋"],
    scoringType: "wins",
    badge: "联机 / 机器人",
    multiplayer: true,
  },
];

const availableGameCount = gameDefinitions.filter(
  (game) => game.status === "available",
).length;

/**
 * @param {string} categoryId
 * @returns {string}
 */
function getCategoryLabel(categoryId) {
  return categoryLabels[categoryId] ?? categoryId;
}

/**
 * @param {string} gameId
 * @returns {GameDefinition | undefined}
 */
function findGame(gameId) {
  return gameDefinitions.find((game) => game.id === gameId);
}

globalThis.CrediusArcadeRegistry = {
  availableGameCount,
  categoryFilters,
  categoryLabels,
  findGame,
  gameDefinitions,
  getCategoryLabel,
};
})();
