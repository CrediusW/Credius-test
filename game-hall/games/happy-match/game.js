// @ts-check

(function () {
  "use strict";

  const {
    areAdjacent,
    collapseBoardWithPayloads,
    createBoard,
    findMatches,
    getPossibleMoves,
    getRoundOutcome,
    swapCells,
  } = globalThis.CrediusHappyMatchRules;
  const {
    formatScore,
    getGameRecord,
    getSettings,
    saveGameResult,
    updateSettings,
  } = globalThis.CrediusArcadeStorage;

  const GAME_ID = "happy-match";
  const ROWS = 8;
  const COLS = 8;
  const SKILL_COST = 3;
  const MAX_SKILL_CHARGE = 9;
  const TILE_TYPES = ["berry", "lemon", "leaf", "drop", "grape", "sun"];
  const TILE_GLYPHS = {
    berry: "♥",
    lemon: "●",
    leaf: "◆",
    drop: "✦",
    grape: "✿",
    sun: "☀",
  };
  const LEVELS = [
    {
      name: "晨露初醒",
      mission: "达到左侧目标分就立即通关，技能连携可冲击更多星星。",
      moves: 26,
      skills: [
        { id: "star-hammer", name: "星星锤", icon: "✦", description: "敲亮九宫格", effect: "area" },
        { id: "rainbow-flask", name: "彩虹瓶", icon: "◉", description: "清除一种果冻", effect: "color" },
        { id: "firefly-rain", name: "萤火雨", icon: "❋", description: "随机点亮 12 格", effect: "random", count: 12 },
      ],
    },
    {
      name: "彩虹溪谷",
      mission: "让技能穿过溪谷，保留能量连续释放。",
      moves: 28,
      skills: [
        { id: "bubble-wave", name: "泡泡浪", icon: "≈", description: "清除相邻两行", effect: "double-row" },
        { id: "prism-beam", name: "棱镜光", icon: "◇", description: "同色果冻共鸣", effect: "color" },
        { id: "tide-stars", name: "潮汐星雨", icon: "※", description: "随机点亮 16 格", effect: "random", count: 16 },
      ],
    },
    {
      name: "风车花田",
      mission: "技能连招会让花田加速，连锁越深得分越高。",
      moves: 30,
      skills: [
        { id: "windmill-cross", name: "风车十字", icon: "✣", description: "清除整行整列", effect: "cross" },
        { id: "pollen-bloom", name: "花粉绽放", icon: "✿", description: "点亮菱形花阵", effect: "diamond" },
        { id: "gust-shower", name: "旋风星雨", icon: "❈", description: "随机点亮 18 格", effect: "random", count: 18 },
      ],
    },
    {
      name: "仓鼠航站",
      mission: "收集补给包，为仓鼠航站连续发射技能。",
      moves: 32,
      skills: [
        { id: "twin-rockets", name: "双子火箭", icon: "➶", description: "双行双列爆破", effect: "double-cross" },
        { id: "supply-drop", name: "补给空投", icon: "▣", description: "爆破 20 格并补包", effect: "random", count: 20, bonusPacks: 4 },
        { id: "orbit-beam", name: "环轨光束", icon: "◎", description: "同色加十字光束", effect: "color-cross" },
      ],
    },
    {
      name: "极光庆典",
      mission: "把三种终极技能串成星光庆典，达到目标即可前进。",
      moves: 34,
      skills: [
        { id: "aurora-nova", name: "极光新星", icon: "✺", description: "同色加十字爆开", effect: "color-cross" },
        { id: "meteor-festival", name: "流星庆典", icon: "☄", description: "随机点亮 26 格", effect: "random", count: 26 },
        { id: "star-mirror", name: "星镜复制", icon: "◈", description: "同时清除两种果冻", effect: "dual-color" },
      ],
    },
    {
      name: "月光蘑菇林",
      mission: "让月光技能穿过蘑菇林，尽早点亮目标分。",
      moves: 36,
      skills: [
        { id: "moon-wheel", name: "月轮斩", icon: "☾", description: "清除整行整列", effect: "cross" },
        { id: "spore-stars", name: "孢子星阵", icon: "❉", description: "点亮菱形星阵", effect: "diamond" },
        { id: "moon-shower", name: "月兔流星", icon: "☄", description: "随机点亮 28 格", effect: "random", count: 28 },
      ],
    },
    {
      name: "水晶矿洞",
      mission: "收集矿洞补给，用水晶共鸣叠高技能连携。",
      moves: 38,
      skills: [
        { id: "crystal-pulse", name: "水晶震荡", icon: "◇", description: "震亮九宫格", effect: "area" },
        { id: "twin-veins", name: "双层矿脉", icon: "═", description: "清除相邻两行", effect: "double-row" },
        { id: "gem-resonance", name: "宝石共鸣", icon: "◈", description: "同时清除两种果冻", effect: "dual-color" },
      ],
    },
    {
      name: "云端列车",
      mission: "沿云轨连续释放技能，在列车抵站前达到目标。",
      moves: 40,
      skills: [
        { id: "cloud-cannons", name: "云轨双炮", icon: "✣", description: "双行双列爆破", effect: "double-cross" },
        { id: "storm-pulse", name: "雷云脉冲", icon: "ϟ", description: "同色加十字光束", effect: "color-cross" },
        { id: "rail-stars", name: "星轨暴雨", icon: "※", description: "随机点亮 30 格", effect: "random", count: 30 },
      ],
    },
    {
      name: "龙焰山谷",
      mission: "用龙焰连招引爆技能包，烧亮更高星级。",
      moves: 42,
      skills: [
        { id: "dragon-cross", name: "龙焰十字", icon: "✦", description: "同色加十字爆开", effect: "color-cross" },
        { id: "lava-bloom", name: "熔岩花阵", icon: "✺", description: "点亮菱形火阵", effect: "diamond" },
        { id: "fire-rain", name: "焰星雨", icon: "☄", description: "随机点亮 32 格", effect: "random", count: 32 },
      ],
    },
    {
      name: "星河王座",
      mission: "集齐最终技能包，让星河终曲完成十关挑战。",
      moves: 44,
      skills: [
        { id: "galaxy-nova", name: "银河新星", icon: "✺", description: "同色加十字爆开", effect: "color-cross" },
        { id: "crown-stars", name: "王冠双星", icon: "♛", description: "同时清除两种果冻", effect: "dual-color" },
        { id: "galaxy-finale", name: "星河终曲", icon: "❋", description: "随机点亮 36 格", effect: "random", count: 36 },
      ],
    },
  ];

  const boardEl = /** @type {HTMLElement} */ (document.getElementById("board"));
  const fxLayer = /** @type {HTMLElement} */ (document.getElementById("fxLayer"));
  const scoreEl = /** @type {HTMLElement} */ (document.getElementById("score"));
  const targetEl = /** @type {HTMLElement} */ (document.getElementById("target"));
  const movesEl = /** @type {HTMLElement} */ (document.getElementById("moves"));
  const bestEl = /** @type {HTMLElement} */ (document.getElementById("best"));
  const levelNameEl = /** @type {HTMLElement} */ (document.getElementById("levelName"));
  const missionTitle = /** @type {HTMLElement} */ (document.getElementById("missionTitle"));
  const missionText = /** @type {HTMLElement} */ (document.getElementById("missionText"));
  const progressBar = /** @type {HTMLElement} */ (document.getElementById("progressBar"));
  const progressText = /** @type {HTMLElement} */ (document.getElementById("progressText"));
  const skillCombo = /** @type {HTMLElement} */ (document.getElementById("skillCombo"));
  const skillChargeBar = /** @type {HTMLElement} */ (document.getElementById("skillChargeBar"));
  const skillChargeText = /** @type {HTMLElement} */ (document.getElementById("skillChargeText"));
  const skillChoices = /** @type {HTMLElement} */ (document.getElementById("skillChoices"));
  const skillHint = /** @type {HTMLElement} */ (document.getElementById("skillHint"));
  const toast = /** @type {HTMLElement} */ (document.getElementById("toast"));
  const statusPanel = /** @type {HTMLElement} */ (document.getElementById("statusPanel"));
  const statusKicker = /** @type {HTMLElement} */ (document.getElementById("statusKicker"));
  const statusTitle = /** @type {HTMLElement} */ (document.getElementById("statusTitle"));
  const statusMessage = /** @type {HTMLElement} */ (document.getElementById("statusMessage"));
  const finalScore = /** @type {HTMLElement} */ (document.getElementById("finalScore"));
  const finalTarget = /** @type {HTMLElement} */ (document.getElementById("finalTarget"));
  const primaryAction = /** @type {HTMLButtonElement} */ (document.getElementById("primaryAction"));
  const retryAction = /** @type {HTMLButtonElement} */ (document.getElementById("retryAction"));
  const lobbyAction = /** @type {HTMLButtonElement} */ (document.getElementById("lobbyAction"));
  const backLobby = /** @type {HTMLButtonElement} */ (document.getElementById("backLobby"));
  const pauseButton = /** @type {HTMLButtonElement} */ (document.getElementById("pauseGame"));
  const newGameButton = /** @type {HTMLButtonElement} */ (document.getElementById("newGame"));
  const soundButton = /** @type {HTMLButtonElement} */ (document.getElementById("soundGame"));

  const requestedLevel = globalThis.CrediusArcadeCampaign.getCurrentLevel(GAME_ID);
  const levelNumber = Math.min(LEVELS.length, Math.max(1, requestedLevel));
  const level = LEVELS[levelNumber - 1];
  const campaignConfig = globalThis.CrediusArcadeCampaign.getLevelConfig(GAME_ID, levelNumber);
  const targetScore = campaignConfig.thresholds[0];

  let board = createBoard(ROWS, COLS, TILE_TYPES);
  let packBoard = createPackBoard();
  let score = 0;
  let moves = level.moves;
  let best = getGameRecord(GAME_ID).highScore;
  let selected = null;
  let cursor = { row: 0, col: 0 };
  let phase = "playing";
  let busy = false;
  let skillCharge = 0;
  let skillUses = 0;
  let packsCollected = 0;
  let armedSkill = null;
  let roundStartedAt = Date.now();
  let roundRecorded = false;
  let pointerStart = null;
  let toastTimer = 0;
  let audioContext = null;

  function createPackBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  }

  function seedSkillPacks(count) {
    const candidates = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (!packBoard[row][col]) candidates.push({ row, col });
      }
    }
    for (let index = 0; index < count && candidates.length; index += 1) {
      const choiceIndex = Math.floor(Math.random() * candidates.length);
      const [choice] = candidates.splice(choiceIndex, 1);
      packBoard[choice.row][choice.col] = true;
    }
  }

  function ensureMinimumPacks() {
    const current = packBoard.flat().filter(Boolean).length;
    const minimum = Math.min(8, 5 + Math.floor(levelNumber / 2));
    if (current < minimum) seedSkillPacks(minimum - current);
  }

  function render() {
    const stars = getStarsForScore(score);
    scoreEl.textContent = formatScore(score);
    targetEl.textContent = formatScore(targetScore);
    movesEl.textContent = String(moves);
    bestEl.textContent = formatScore(Math.max(best, score));
    levelNameEl.textContent = `星光果园 · 第 ${levelNumber} 关`;
    missionTitle.textContent = level.name;
    missionText.textContent = level.mission;
    progressBar.style.width = `${Math.min(100, (score / campaignConfig.thresholds[2]) * 100)}%`;
    progressText.textContent = `当前 ${"★".repeat(stars)}${"☆".repeat(3 - stars)} · 还剩 ${moves} 步`;
    renderBoard();
    renderSkills();
  }

  function renderBoard(falling = false) {
    boardEl.setAttribute("aria-busy", String(busy));
    const cells = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const kind = board[row][col];
        const hasPack = packBoard[row][col];
        const classes = ["match-tile"];
        if (cursor.row === row && cursor.col === col) classes.push("is-cursor");
        if (selected?.row === row && selected?.col === col) classes.push("is-selected");
        if (falling) classes.push("is-falling");
        if (hasPack) classes.push("has-skill-pack");
        cells.push(`
          <button
            class="${classes.join(" ")}"
            type="button"
            tabindex="-1"
            data-row="${row}"
            data-col="${col}"
            data-kind="${kind}"
            aria-label="${kindLabel(kind)}${hasPack ? "，带技能包" : ""}，第 ${row + 1} 行，第 ${col + 1} 列"
          >
            <span aria-hidden="true">${TILE_GLYPHS[kind]}</span>
            ${hasPack ? '<i class="skill-pack-badge" aria-hidden="true">✦</i>' : ""}
          </button>
        `);
      }
    }
    boardEl.innerHTML = cells.join("");
  }

  function renderSkills() {
    const multiplier = 1 + skillUses * 0.25;
    const readySkills = Math.floor(skillCharge / SKILL_COST);
    skillCombo.textContent = `技能连携 ×${multiplier.toFixed(2)}`;
    skillChargeBar.style.width = `${Math.min(100, (skillCharge / SKILL_COST) * 100)}%`;
    skillChargeText.textContent = readySkills
      ? `技能包 ${skillCharge} 个 · 可释放 ${readySkills} 次 · 已释放 ${skillUses} 次`
      : `技能包 ${skillCharge}/${SKILL_COST} · 已释放 ${skillUses} 次`;
    skillChoices.innerHTML = level.skills.map((skill) => {
      const isArmed = armedSkill?.id === skill.id;
      const disabled = skillCharge < SKILL_COST || busy || phase !== "playing";
      return `
        <button
          class="skill-choice ${isArmed ? "is-armed" : ""}"
          type="button"
          data-skill-id="${skill.id}"
          ${disabled ? "disabled" : ""}
          aria-label="${skill.name}：${skill.description}"
        >
          <span aria-hidden="true">${skill.icon}</span>
          <strong>${isArmed ? "已选择 · 点果冻" : skill.name}</strong>
          <small>${skill.description}</small>
        </button>
      `;
    }).join("");

    if (armedSkill) {
      skillHint.textContent = `${armedSkill.name} 已准备好，请点选一枚果冻。`;
    } else if (skillCharge >= SKILL_COST) {
      skillHint.textContent = "能量已满：任选一个技能。放完还能继续消除和再次充能。";
    } else if (moves <= 0) {
      skillHint.textContent = "步数已用完，技能能量不足，正在结算星级。";
    } else {
      skillHint.textContent = "消除带 ✦ 的果冻，收集 3 个技能包即可任选一个技能。";
    }
  }

  function getStarsForScore(value) {
    if (value >= campaignConfig.thresholds[2]) return 3;
    if (value >= campaignConfig.thresholds[1]) return 2;
    if (value >= campaignConfig.thresholds[0]) return 1;
    return 0;
  }

  function kindLabel(kind) {
    return {
      berry: "莓果冻",
      lemon: "柠檬冻",
      leaf: "青叶冻",
      drop: "蓝星冻",
      grape: "葡萄冻",
      sun: "太阳冻",
    }[kind] ?? "果冻";
  }

  function startLevel() {
    board = createBoard(ROWS, COLS, TILE_TYPES);
    packBoard = createPackBoard();
    seedSkillPacks(7 + levelNumber);
    score = 0;
    moves = level.moves;
    selected = null;
    cursor = { row: 0, col: 0 };
    phase = "playing";
    busy = false;
    skillCharge = 0;
    skillUses = 0;
    packsCollected = 0;
    armedSkill = null;
    roundStartedAt = Date.now();
    roundRecorded = false;
    pauseButton.textContent = "暂停";
    statusPanel.hidden = true;
    render();
    boardEl.focus();
  }

  function swapPackCells(first, second) {
    const payload = packBoard[first.row][first.col];
    packBoard[first.row][first.col] = packBoard[second.row][second.col];
    packBoard[second.row][second.col] = payload;
  }

  async function attemptSwap(first, second) {
    if (busy || phase !== "playing" || moves <= 0 || !areAdjacent(first, second)) return;
    busy = true;
    selected = null;
    cursor = { ...second };
    ensureAudio();
    swapCells(board, first, second);
    swapPackCells(first, second);
    renderBoard();
    await delay(150);

    const matches = findMatches(board);
    if (!matches.size) {
      swapCells(board, first, second);
      swapPackCells(first, second);
      renderBoard();
      boardEl.classList.add("is-invalid");
      playInvalidSound();
      await delay(220);
      boardEl.classList.remove("is-invalid");
      busy = false;
      renderSkills();
      return;
    }

    moves -= 1;
    await resolveCascades(matches);
  }

  async function resolveCascades(initialMatches, chain = 1) {
    let matches = initialMatches;
    let combo = chain;

    while (matches.size) {
      const packCount = await animateClear(matches, combo);
      const gained =
        matches.size * 45 * combo
        + Math.max(0, matches.size - 3) * 30
        + packCount * 90;
      score += gained;
      best = Math.max(best, score);
      clearCells(matches);
      collapseBoardWithPayloads(
        board,
        packBoard,
        TILE_TYPES,
        Math.random,
        () => Math.random() < 0.075 + levelNumber * 0.006,
      );
      ensureMinimumPacks();
      render();
      renderBoard(true);
      await delay(230);
      matches = findMatches(board);
      combo += 1;
      if (matches.size) showToast(`${combo - 1} 连锁 · 分数倍率继续上升！`);
    }

    if (!getPossibleMoves(board).length) {
      board = createBoard(ROWS, COLS, TILE_TYPES);
      packBoard = createPackBoard();
      seedSkillPacks(7);
      showToast("果园风吹过，送来一盘新棋！");
      renderBoard(true);
      await delay(240);
    }
    busy = false;
    render();
    checkRoundEnd();
  }

  function clearCells(cells) {
    for (const key of cells) {
      const [row, col] = key.split(":").map(Number);
      board[row][col] = null;
      packBoard[row][col] = false;
    }
  }

  async function animateClear(matches, combo) {
    const colors = [];
    const packKeys = [];
    for (const key of matches) {
      const [row, col] = key.split(":").map(Number);
      const tile = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (tile) tile.classList.add("is-clearing");
      colors.push(board[row][col]);
      if (packBoard[row][col]) {
        packKeys.push(key);
        createPackPop(key);
      }
    }
    createParticles(matches, colors);
    playClearSound(combo, matches.size);
    if (combo > 1) showToast(`${combo} 连锁！ +${formatScore(matches.size * 45 * combo)}`);
    await delay(280);
    if (packKeys.length) collectPacks(packKeys.length);
    return packKeys.length;
  }

  function collectPacks(count) {
    const previousCharge = skillCharge;
    skillCharge = Math.min(MAX_SKILL_CHARGE, skillCharge + count);
    packsCollected += count;
    if (
      Math.floor(previousCharge / SKILL_COST)
      < Math.floor(skillCharge / SKILL_COST)
    ) {
      playSkillReadySound();
    } else {
      playPackSound();
    }
    showToast(`技能包 +${count} · 当前 ${skillCharge}/${SKILL_COST}`);
    renderSkills();
  }

  function createPackPop(key) {
    if (getSettings().reduceMotion) return;
    const [row, col] = key.split(":").map(Number);
    const tile = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!tile) return;
    const layerRect = fxLayer.getBoundingClientRect();
    const rect = tile.getBoundingClientRect();
    const pop = document.createElement("span");
    pop.className = "pack-pop";
    pop.textContent = "✦ 技能包 +1";
    pop.style.left = `${rect.left - layerRect.left + rect.width / 2}px`;
    pop.style.top = `${rect.top - layerRect.top + rect.height / 2}px`;
    fxLayer.append(pop);
    window.setTimeout(() => pop.remove(), 820);
  }

  function createParticles(matches, colors) {
    if (getSettings().reduceMotion) return;
    const layerRect = fxLayer.getBoundingClientRect();
    let colorIndex = 0;
    for (const key of matches) {
      const [row, col] = key.split(":").map(Number);
      const tile = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (!tile) continue;
      const rect = tile.getBoundingClientRect();
      const x = rect.left - layerRect.left + rect.width / 2;
      const y = rect.top - layerRect.top + rect.height / 2;
      const sparkColor = tileColor(colors[colorIndex]);
      colorIndex += 1;

      const ring = document.createElement("span");
      ring.className = "flash-ring";
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      fxLayer.append(ring);
      window.setTimeout(() => ring.remove(), 520);

      for (let index = 0; index < 5; index += 1) {
        const angle = (Math.PI * 2 * index) / 5 + Math.random() * 0.35;
        const distance = 24 + Math.random() * 38;
        const spark = document.createElement("span");
        spark.className = "spark";
        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        spark.style.setProperty("--size", `${4 + Math.random() * 6}px`);
        spark.style.setProperty("--spark", sparkColor);
        fxLayer.append(spark);
        window.setTimeout(() => spark.remove(), 620);
      }
    }
  }

  function tileColor(kind) {
    return {
      berry: "#ff70b2",
      lemon: "#ffe36e",
      leaf: "#8ced83",
      drop: "#72ddff",
      grape: "#bd96ff",
      sun: "#ffad65",
    }[kind] ?? "#ffffff";
  }

  function getSkillById(skillId) {
    return level.skills.find((skill) => skill.id === skillId);
  }

  function skillNeedsTarget(skill) {
    return skill.effect !== "random";
  }

  function chooseSkill(skill) {
    if (!skill || skillCharge < SKILL_COST || busy || phase !== "playing") return;
    ensureAudio();
    if (!skillNeedsTarget(skill)) {
      useSkill(skill);
      return;
    }
    armedSkill = armedSkill?.id === skill.id ? null : skill;
    selected = null;
    render();
    if (armedSkill) showToast(`${skill.name}准备好了，请点一枚果冻`);
    boardEl.focus();
  }

  function getSkillCells(skill, position) {
    const cells = new Set();
    const safePosition = position ?? { row: 0, col: 0 };
    const selectedKind = board[safePosition.row][safePosition.col];
    const add = (row, col) => {
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) cells.add(`${row}:${col}`);
    };

    if (skill.effect === "area") {
      for (let row = safePosition.row - 1; row <= safePosition.row + 1; row += 1) {
        for (let col = safePosition.col - 1; col <= safePosition.col + 1; col += 1) add(row, col);
      }
    } else if (skill.effect === "color") {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (board[row][col] === selectedKind) add(row, col);
        }
      }
    } else if (skill.effect === "double-row") {
      const secondRow = safePosition.row < ROWS - 1 ? safePosition.row + 1 : safePosition.row - 1;
      for (let col = 0; col < COLS; col += 1) {
        add(safePosition.row, col);
        add(secondRow, col);
      }
    } else if (skill.effect === "cross") {
      for (let index = 0; index < COLS; index += 1) add(safePosition.row, index);
      for (let index = 0; index < ROWS; index += 1) add(index, safePosition.col);
    } else if (skill.effect === "diamond") {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (Math.abs(row - safePosition.row) + Math.abs(col - safePosition.col) <= 2) add(row, col);
        }
      }
    } else if (skill.effect === "double-cross") {
      const secondRow = safePosition.row < ROWS - 1 ? safePosition.row + 1 : safePosition.row - 1;
      const secondCol = safePosition.col < COLS - 1 ? safePosition.col + 1 : safePosition.col - 1;
      for (let index = 0; index < COLS; index += 1) {
        add(safePosition.row, index);
        add(secondRow, index);
      }
      for (let index = 0; index < ROWS; index += 1) {
        add(index, safePosition.col);
        add(index, secondCol);
      }
    } else if (skill.effect === "color-cross") {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (board[row][col] === selectedKind) add(row, col);
        }
      }
      for (let index = 0; index < COLS; index += 1) add(safePosition.row, index);
      for (let index = 0; index < ROWS; index += 1) add(index, safePosition.col);
    } else if (skill.effect === "dual-color") {
      const secondKind = TILE_TYPES[(TILE_TYPES.indexOf(selectedKind) + 1 + skillUses) % TILE_TYPES.length];
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (board[row][col] === selectedKind || board[row][col] === secondKind) add(row, col);
        }
      }
    } else if (skill.effect === "random") {
      const candidates = [];
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) candidates.push({ row, col });
      }
      const count = Math.min(candidates.length, Number(skill.count) || 12);
      for (let index = 0; index < count; index += 1) {
        const choiceIndex = Math.floor(Math.random() * candidates.length);
        const [choice] = candidates.splice(choiceIndex, 1);
        add(choice.row, choice.col);
      }
    }
    return cells;
  }

  async function useSkill(skill, position = null) {
    if (busy || phase !== "playing" || skillCharge < SKILL_COST) return;
    const cells = getSkillCells(skill, position);
    if (!cells.size) return;
    skillCharge -= SKILL_COST;
    skillUses += 1;
    armedSkill = null;
    selected = null;
    busy = true;
    boardEl.setAttribute("aria-busy", "true");
    renderSkills();
    const skillChain = 2 + Math.min(3, skillUses);
    playSkillSound(skillUses);
    showToast(`${skill.name} · 技能连携 ×${(1 + skillUses * 0.25).toFixed(2)}！`);
    const packCount = await animateClear(cells, skillChain);
    score +=
      cells.size * (52 + skillUses * 12)
      + packCount * 100
      + skillUses * 180;
    clearCells(cells);
    collapseBoardWithPayloads(
      board,
      packBoard,
      TILE_TYPES,
      Math.random,
      () => Math.random() < 0.085,
    );
    if (skill.bonusPacks) seedSkillPacks(skill.bonusPacks);
    ensureMinimumPacks();
    render();
    renderBoard(true);
    await delay(260);
    const matches = findMatches(board);
    if (matches.size) {
      await resolveCascades(matches, skillChain + 1);
      return;
    }
    busy = false;
    render();
    checkRoundEnd();
  }

  function checkRoundEnd() {
    const outcome = getRoundOutcome({
      score,
      target: targetScore,
      moves,
      skillCharge,
      skillCost: SKILL_COST,
    });
    if (outcome === "playing") return;
    if (outcome === "skill-overtime") {
      showToast("步数已用完，剩余技能还可以继续释放！");
      renderSkills();
      return;
    }
    if (outcome === "passed") {
      completeLevel();
    } else {
      failLevel();
    }
  }

  function completeLevel() {
    phase = "complete";
    busy = false;
    const result = recordRound(true);
    best = result.record.highScore;
    playWinSound();
    statusKicker.textContent = levelNumber === LEVELS.length ? "十关完成" : "目标达成";
    statusTitle.textContent = `${level.name} · 获得 ${getStarsForScore(score)} 星`;
    statusMessage.textContent = `本关释放 ${skillUses} 次技能、收集 ${packsCollected} 个技能包。`;
    primaryAction.textContent = levelNumber === LEVELS.length ? "再玩本关" : "进入下一关";
    retryAction.hidden = false;
    finalScore.textContent = formatScore(score);
    finalTarget.textContent = formatScore(targetScore);
    statusPanel.hidden = false;
    render();
  }

  function failLevel() {
    phase = "failed";
    busy = false;
    recordRound(false);
    playFailSound();
    statusKicker.textContent = "步数结算";
    statusTitle.textContent = "星光还差一点";
    statusMessage.textContent = `本关释放 ${skillUses} 次技能；再获得 ${formatScore(Math.max(0, targetScore - score))} 分即可过关。`;
    primaryAction.textContent = "再试一次";
    retryAction.hidden = true;
    finalScore.textContent = formatScore(score);
    finalTarget.textContent = formatScore(targetScore);
    statusPanel.hidden = false;
    render();
  }

  function recordRound(completed) {
    if (roundRecorded) return { record: getGameRecord(GAME_ID), newHighScore: false };
    roundRecorded = true;
    return saveGameResult(GAME_ID, {
      score,
      playTime: Math.max(1, Math.round((Date.now() - roundStartedAt) / 1000)),
      highestLevel: completed ? levelNumber : Math.max(0, levelNumber - 1),
      completed,
      roundId: `${GAME_ID}-${levelNumber}-${roundStartedAt}`,
    });
  }

  function togglePause() {
    if (phase === "playing") {
      phase = "paused";
      pauseButton.textContent = "继续";
      statusKicker.textContent = "暂停";
      statusTitle.textContent = "果园等你回来";
      statusMessage.textContent = "棋盘、技能能量和步数都已停住。";
      primaryAction.textContent = "继续游戏";
      retryAction.hidden = true;
      finalScore.textContent = formatScore(score);
      finalTarget.textContent = formatScore(targetScore);
      statusPanel.hidden = false;
      renderSkills();
      return;
    }
    if (phase === "paused") {
      phase = "playing";
      pauseButton.textContent = "暂停";
      statusPanel.hidden = true;
      renderSkills();
      boardEl.focus();
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1900);
  }

  function updateSoundButton() {
    soundButton.textContent = getSettings().soundEnabled ? "♪" : "♪̸";
  }

  function ensureAudio() {
    if (!getSettings().soundEnabled || audioContext) return;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
  }

  function tone(frequency, duration, type = "sine", volume = 0.045, offset = 0) {
    if (!getSettings().soundEnabled) return;
    ensureAudio();
    if (!audioContext) return;
    const start = audioContext.currentTime + offset;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playClearSound(combo, count) {
    const base = 390 + Math.min(6, combo) * 72;
    tone(base, 0.15, "sine", 0.045);
    tone(base * 1.25, 0.18, "triangle", 0.035, 0.055);
    if (count >= 4 || combo > 1) tone(base * 1.5, 0.22, "sine", 0.028, 0.11);
  }

  function playInvalidSound() {
    tone(150, 0.14, "square", 0.025);
  }

  function playPackSound() {
    tone(740, 0.12, "sine", 0.025);
    tone(980, 0.16, "triangle", 0.025, 0.06);
  }

  function playSkillReadySound() {
    tone(523, 0.18, "triangle", 0.035);
    tone(659, 0.2, "triangle", 0.035, 0.09);
    tone(784, 0.28, "sine", 0.035, 0.18);
  }

  function playSkillSound(useCount) {
    const lift = Math.min(4, useCount) * 35;
    [330, 440, 587, 784].forEach((frequency, index) => {
      tone(frequency + lift, 0.28, index % 2 ? "triangle" : "sine", 0.04, index * 0.06);
    });
  }

  function playWinSound() {
    [523, 659, 784, 1046].forEach((frequency, index) => {
      tone(frequency, 0.42, "sine", 0.04, index * 0.11);
    });
  }

  function playFailSound() {
    tone(260, 0.24, "triangle", 0.035);
    tone(196, 0.38, "sine", 0.03, 0.18);
  }

  function delay(milliseconds) {
    const duration = getSettings().reduceMotion ? Math.min(24, milliseconds) : milliseconds;
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  function returnToLobby() {
    if (!roundRecorded && (score > 0 || moves < level.moves)) recordRound(false);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "credius:close-game" }, "*");
      window.parent.postMessage({ type: "credius:records-updated" }, "*");
      return;
    }
    window.location.href = "../../index.html";
  }

  boardEl.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const tile = target.closest("[data-row][data-col]");
    if (!(tile instanceof HTMLElement) || busy || phase !== "playing") return;
    ensureAudio();
    const position = { row: Number(tile.dataset.row), col: Number(tile.dataset.col) };
    cursor = { ...position };
    if (armedSkill) {
      useSkill(armedSkill, position);
      return;
    }
    if (moves <= 0) {
      showToast("普通步数已用完，只能释放剩余技能。");
      return;
    }
    if (!selected) {
      selected = position;
      renderBoard();
      return;
    }
    if (selected.row === position.row && selected.col === position.col) {
      selected = null;
      renderBoard();
      return;
    }
    if (areAdjacent(selected, position)) {
      attemptSwap(selected, position);
      return;
    }
    selected = position;
    renderBoard();
  });

  boardEl.addEventListener("pointerdown", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const tile = target.closest("[data-row][data-col]");
    if (!(tile instanceof HTMLElement)) return;
    pointerStart = {
      row: Number(tile.dataset.row),
      col: Number(tile.dataset.col),
      x: event.clientX,
      y: event.clientY,
    };
  });

  boardEl.addEventListener("pointerup", (event) => {
    if (!pointerStart || busy || phase !== "playing" || armedSkill || moves <= 0) {
      pointerStart = null;
      return;
    }
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      pointerStart = null;
      return;
    }
    const second = Math.abs(dx) > Math.abs(dy)
      ? { row: pointerStart.row, col: pointerStart.col + (dx > 0 ? 1 : -1) }
      : { row: pointerStart.row + (dy > 0 ? 1 : -1), col: pointerStart.col };
    const first = { row: pointerStart.row, col: pointerStart.col };
    pointerStart = null;
    if (second.row >= 0 && second.row < ROWS && second.col >= 0 && second.col < COLS) {
      attemptSwap(first, second);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (phase !== "playing" || busy) return;
    const direction = {
      ArrowUp: { row: -1, col: 0 },
      ArrowDown: { row: 1, col: 0 },
      ArrowLeft: { row: 0, col: -1 },
      ArrowRight: { row: 0, col: 1 },
    }[event.key];
    if (direction) {
      event.preventDefault();
      cursor = {
        row: Math.min(ROWS - 1, Math.max(0, cursor.row + direction.row)),
        col: Math.min(COLS - 1, Math.max(0, cursor.col + direction.col)),
      };
      renderBoard();
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (armedSkill) {
        useSkill(armedSkill, cursor);
      } else if (moves <= 0) {
        showToast("请选择一个已经充能的技能。");
      } else if (!selected) {
        selected = { ...cursor };
        renderBoard();
      } else if (areAdjacent(selected, cursor)) {
        attemptSwap(selected, cursor);
      } else {
        selected = { ...cursor };
        renderBoard();
      }
    }
  });

  skillChoices.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const button = target.closest("[data-skill-id]");
    if (!(button instanceof HTMLElement)) return;
    chooseSkill(getSkillById(button.dataset.skillId ?? ""));
  });

  primaryAction.addEventListener("click", () => {
    if (phase === "paused") {
      togglePause();
      return;
    }
    if (phase === "complete" && levelNumber < LEVELS.length) {
      window.location.href = `index.html?level=${levelNumber + 1}`;
      return;
    }
    startLevel();
  });
  retryAction.addEventListener("click", startLevel);
  lobbyAction.addEventListener("click", returnToLobby);
  backLobby.addEventListener("click", returnToLobby);
  pauseButton.addEventListener("click", togglePause);
  newGameButton.addEventListener("click", () => {
    if (!roundRecorded && (score > 0 || moves < level.moves)) recordRound(false);
    startLevel();
  });
  soundButton.addEventListener("click", () => {
    updateSettings({ soundEnabled: !getSettings().soundEnabled });
    updateSoundButton();
    if (getSettings().soundEnabled) {
      ensureAudio();
      tone(660, 0.16, "sine", 0.035);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && phase === "playing") togglePause();
  });

  updateSoundButton();
  startLevel();
})();
