// @ts-check

(function () {
  "use strict";

  /**
   * @param {boolean} grounded
   * @param {number} jumpCount
   * @param {number} campaignLevel
   * @param {boolean} [canAirJump=true]
   * @returns {{jumpCount: number, velocity: number, isAirJump: boolean} | null}
   */
  function getNextJump(grounded, jumpCount, campaignLevel, canAirJump = true) {
    const safeCount = Math.max(0, Math.round(jumpCount));
    if (!grounded && (!canAirJump || safeCount >= 2)) {
      return null;
    }

    const isAirJump = !grounded;
    return {
      jumpCount: isAirJump ? safeCount + 1 : 1,
      velocity: isAirJump ? -(525 + campaignLevel * 1.5) : -(585 + campaignLevel * 2),
      isAirJump,
    };
  }

  globalThis.CrediusMaryJumpRules = {
    getNextJump,
  };
})();
