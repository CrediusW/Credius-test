const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = (process.env.SITE_URL || 'http://127.0.0.1:8770').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage();
    const errors = [], missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) missing.push(r.url()); });
    let games;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/');
      await page.locator('#games').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.header nav a[href="#games"]').count(), 1);
      assert.equal(await page.locator('#games a[href="game-hall/"]').count(), 1);
      await page.screenshot({ path: `../audit/games-home-${width}.png` });
      await page.goto(base + '/game-hall/');
      await page.locator('.game-card').first().waitFor();
      assert.equal(await page.locator('.game-card').count(), 14);
      assert.equal(await page.locator('#gameGrid .game-copy strong').first().innerText(), '2048');
      assert.equal(await page.locator('.game-card.coming-soon').count(), 2);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(247, 246, 240)');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      games = await page.evaluate(() => CrediusArcadeRegistry.gameDefinitions.filter(g => g.status === 'available'));
      assert.equal(games.length, 12);
      await page.locator('#gameGrid').evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.waitForFunction(() => [...document.querySelectorAll('#gameGrid .game-card:nth-child(-n+2) img')].every(img => img.complete && img.naturalWidth > 0));
      await page.waitForFunction(() => [...document.querySelectorAll('#gameGrid img')].filter(img => { const r = img.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).every(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: `../audit/game-hall-${width}.png` });
      await page.locator('#gameGrid [data-detail="ludo"]').first().click();
      assert(await page.locator('#detailContent .primary-action').isDisabled());
      await page.locator('#closeDetail').click();
      for (const game of games) {
        const response = await page.goto(base + '/game-hall/' + game.route);
        assert.equal(response.status(), 200);
        await page.locator('.game-shell').waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: ${game.id}`);
      }
    }
    await page.goto(base + '/game-hall/');
    await page.locator('[data-favorite="2048"]').click();
    await page.reload();
    assert.equal(await page.locator('[data-favorite="2048"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#quickStartButton').click();
    const frame = page.frameLocator('#gameFrame');
    await frame.locator('#pauseGame').click();
    assert.equal(await frame.locator('#statusPanel').isVisible(), true);
    await frame.locator('#statusButton').click();
    await page.locator('#closePlayer').click();
    await page.locator('#searchToggle').click();
    await page.locator('#searchInput').fill('俄罗斯');
    assert.equal(await page.locator('.game-card').count(), 1);
    await page.goto(base + '/game-hall/games/snake/');
    await page.locator('#settlementPanel').waitFor({ state: 'visible', timeout: 10000 });
    assert(await page.evaluate(() => CrediusArcadeStorage.getGameRecord('snake').totalPlays >= 1));
    await page.locator('#backLobby').click();
    await page.waitForURL('**/game-hall/index.html');
    await page.locator('.portal-home').click();
    await page.waitForURL(base + '/');
    assert.deepEqual(errors, [], 'Runtime errors');
    assert.deepEqual(missing, [], 'Missing assets');
    console.log('PASS: portal navigation, desktop/mobile, all 12 game loads, unavailable multiplayer, iframe pause/resume, search, favorite persistence, game result save and return links.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
