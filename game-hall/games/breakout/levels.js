// @ts-check

(function () {
  "use strict";

  const LEGEND = {
    "1": { type: "normal", hp: 1 },
    "2": { type: "reinforced", hp: 2 },
    S: { type: "steel", hp: Infinity },
    X: { type: "explosive", hp: 1 },
    B: { type: "bonus", hp: 1 },
  };

  const levels = [
    {
      id: 1,
      name: "新手训练场",
      subtitle: "学会控制落点，让反弹成为你的第一种武器。",
      goal: "clear-all",
      scoreMultiplier: 1,
      accent: "#ff8a65",
      features: ["31 块疏朗砖阵", "强化砖初体验", "补给砖会掉落道具"],
      layout: [
        ".111.B11.11",
        "1111.1111..",
        ".122.221.1.",
        "11.111.111.",
      ],
    },
    {
      id: 2,
      name: "金字塔遗迹",
      subtitle: "从边缘缺口切入，让小球沿斜线穿过遗迹核心。",
      goal: "clear-all",
      scoreMultiplier: 1.1,
      accent: "#f1b84b",
      features: ["五层金字塔", "核心强化砖密集", "边缘补给砖考验路线"],
      layout: [
        ".....2.....",
        "....121....",
        "...1B211...",
        "..1122211..",
        ".11.212.11.",
      ],
    },
    {
      id: 3,
      name: "迷宫回廊",
      subtitle: "钢铁墙不会退让，只有改变角度才能绕进深处。",
      goal: "clear-all",
      scoreMultiplier: 1.25,
      accent: "#7aa7ff",
      features: ["不规则迷宫砖阵", "不可破坏钢铁墙", "回廊深处藏有补给"],
      layout: [
        "1111SS1111.",
        "...111.....",
        "111...111..",
        "..SS1111SS.",
        "11...2...11",
        ".SS111SS...",
        "111...1B11.",
      ],
    },
    {
      id: 4,
      name: "堡垒核心",
      subtitle: "穿过底部缺口，锁定爆炸砖，一击撕开整片防线。",
      goal: "clear-all",
      scoreMultiplier: 1.45,
      accent: "#ff6f7d",
      features: ["钢墙围成防御外圈", "爆炸砖清除 3×3", "补给砖掉落强化道具"],
      layout: [
        "SSSSSSSSSSS",
        "S111111111S",
        "S12X2B2X21S",
        "S111111111S",
        "S1X22222X1S",
        "S111B11111S",
        "S111...111S",
        "SSS.....SSS",
      ],
    },
    {
      id: 5,
      name: "最终挑战",
      subtitle: "击穿霓虹王冠，在移动钢墙前把一颗球变成两颗。",
      goal: "clear-all",
      scoreMultiplier: 1.65,
      accent: "#c5a3ff",
      features: ["王冠形终极砖阵", "移动钢墙持续封路", "3000 分触发双球"],
      splitScore: 3000,
      movingObstacles: [
        { x: 164, y: 352, width: 152, height: 14, minX: 48, maxX: 280, speed: 92 },
      ],
      layout: [
        "....222....",
        "..112B211..",
        ".11X222X11.",
        "11122222111",
        ".1112B2111.",
        "..11X11....",
        "...11111...",
        "....111....",
      ],
    },
  ];
  const TOTAL_CAMPAIGN_LEVELS = 12;
  const reservedLevelIds = Array.from(
    { length: TOTAL_CAMPAIGN_LEVELS - levels.length },
    (_, index) => levels.length + index + 1,
  );

  function getLevel(levelId) {
    const safeId = Math.max(1, Math.min(levels.length, Math.floor(Number(levelId) || 1)));
    return levels[safeId - 1];
  }

  function createLevelEntities(level, options = {}) {
    const canvasWidth = Number(options.canvasWidth) || 480;
    const top = Number(options.top) || 58;
    const side = Number(options.side) || 14;
    const gap = Number(options.gap) || 4;
    const height = Number(options.height) || 22;
    const rowGap = Number(options.rowGap) || 7;
    const cols = Math.max(...level.layout.map((row) => row.length));
    const width = (canvasWidth - side * 2 - gap * (cols - 1)) / cols;
    const entities = [];

    level.layout.forEach((row, rowIndex) => {
      row.padEnd(cols, ".").split("").forEach((symbol, colIndex) => {
        const definition = LEGEND[symbol];
        if (!definition) return;
        entities.push({
          id: `${level.id}-${rowIndex}-${colIndex}`,
          row: rowIndex,
          col: colIndex,
          symbol,
          type: definition.type,
          hp: definition.hp,
          maxHp: definition.hp,
          x: side + colIndex * (width + gap),
          y: top + rowIndex * (height + rowGap),
          width,
          height,
        });
      });
    });

    return entities;
  }

  function countBreakableBricks(levelOrEntities) {
    const entities = Array.isArray(levelOrEntities)
      ? levelOrEntities
      : createLevelEntities(levelOrEntities);
    return entities.filter((brick) => brick.type !== "steel").length;
  }

  function isLevelCleared(entities) {
    return entities.every((brick) => brick.type === "steel" || brick.hp <= 0);
  }

  globalThis.CrediusBreakoutLevels = {
    LEGEND,
    TOTAL_CAMPAIGN_LEVELS,
    countBreakableBricks,
    createLevelEntities,
    getLevel,
    isLevelCleared,
    levels,
    reservedLevelIds,
  };
})();
