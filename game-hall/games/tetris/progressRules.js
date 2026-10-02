// @ts-check

(function () {
  "use strict";

  const levels = [
    { level: 1, requiredLines: 20, dropInterval: 820 },
    { level: 2, requiredLines: 20, dropInterval: 620 },
    { level: 3, requiredLines: 20, dropInterval: 460 },
  ];
  const totalRequiredLines = levels.reduce((total, config) => total + config.requiredLines, 0);

  function normalizeLines(totalLines) {
    return Math.max(0, Math.floor(Number(totalLines) || 0));
  }

  function getLevelProgress(totalLines) {
    const safeLines = normalizeLines(totalLines);
    if (safeLines >= totalRequiredLines) {
      const finalLevel = levels[levels.length - 1];
      return {
        level: finalLevel.level,
        linesInLevel: finalLevel.requiredLines,
        linesRemaining: 0,
        completed: true,
      };
    }

    let consumedLines = 0;
    for (const config of levels) {
      const levelEnd = consumedLines + config.requiredLines;
      if (safeLines < levelEnd) {
        const linesInLevel = safeLines - consumedLines;
        return {
          level: config.level,
          linesInLevel,
          linesRemaining: config.requiredLines - linesInLevel,
          completed: false,
        };
      }
      consumedLines = levelEnd;
    }

    return { level: 3, linesInLevel: 20, linesRemaining: 0, completed: true };
  }

  function getDropInterval(level, graceMultiplier = 1) {
    const safeLevel = Math.min(levels.length, Math.max(1, Math.floor(Number(level) || 1)));
    const config = levels[safeLevel - 1];
    const safeGrace = Math.max(0.1, Number(graceMultiplier) || 1);
    return Math.max(88, Math.round(config.dropInterval * safeGrace));
  }

  globalThis.CrediusTetrisProgressRules = {
    levels,
    totalRequiredLines,
    getDropInterval,
    getLevelProgress,
  };
})();
