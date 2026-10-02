const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = (process.env.SITE_URL || 'http://127.0.0.1:8767').replace(/\/$/, '');

function pdfFixture() {
  const text = 'BT /F1 18 Tf 30 130 Td (Python resume) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`
  ];
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Array.from(Buffer.from(pdf));
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/joblens/#/match', '/joblens/#/portfolio', '/joblens/#/settings', '/ai-voice-pet/']) {
        const response = await page.goto(base + path);
        if (response) assert.equal(response.status(), 200, path);
        if (path.includes('joblens')) await page.waitForFunction(() => !document.querySelector('.loading-hint'));
        if (path.includes('ai-voice-pet')) await page.waitForFunction(() => document.querySelectorAll('.part img[src]').length === 18);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${width} ${path}`);
        if (path === '/') {
          await page.locator('#lab').scrollIntoViewIfNeeded();
          await page.locator('#library').scrollIntoViewIfNeeded();
          await page.waitForFunction(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0));
          assert((await page.title()).includes('闻风的奇妙天地'));
          assert.equal(await page.locator('#library .book').count(), 4);
          assert.equal(await page.locator('#lab .deepseek-card a').getAttribute('href'), 'https://deepseek-personal-space.aacbcwang.chatgpt.site/');
          assert.equal(await page.locator('#library .book').last().getAttribute('href'), 'https://deepseek-personal-space.aacbcwang.chatgpt.site/books/investment-operating-system');
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const book of ['silicon-world', 'loop-engineering', 'dawn-dream']) {
      await page.goto(base + '/reader.html?book=' + book);
      assert.equal(await page.locator('#bookSelect').inputValue(), book);
      await page.frameLocator('#bookFrame').locator('body').waitFor();
      assert(await page.frameLocator('#bookFrame').locator('body').innerText());
    }
    await page.goto(base + '/reader.html?book=../../unknown');
    assert.equal(await page.locator('#bookSelect').inputValue(), 'silicon-world');

    await page.goto(base + '/joblens/#/match');
    await page.locator('#sampleJdBtn').click();
    await page.locator('#runMatchBtn').click();
    await page.locator('#exportReportBtn').waitFor();
    const result = await page.evaluate(() => JobLens.store.matchHistory()[0]);
    assert(result.score >= 0 && result.score <= 100);
    assert.match(result.source, /本地/);
    const download = page.waitForEvent('download');
    await page.locator('#exportReportBtn').click();
    assert((await download).suggestedFilename().endsWith('.md'));
    const parsed = await page.evaluate(async bytes => JobLens.pdfToText(new File([new Uint8Array(bytes)], 'test.pdf', { type: 'application/pdf' })), pdfFixture());
    assert.match(parsed, /Python resume/);
    assert(await page.evaluate(() => {
      const settings = JobLens.store.settings(); settings.llm.apiKey = 'test-secret'; JobLens.store.saveSettings(settings);
      const backup = JobLens.store.exportAll();
      const safe = backup.settings.llm.apiKey === '' && JobLens.store.settings().llm.apiKey === 'test-secret';
      settings.llm.apiKey = ''; JobLens.store.saveSettings(settings); return safe;
    }), 'Backup must exclude keys without clearing saved settings');
    const boundaries = await page.evaluate(async () => ({
      empty: await JobLens.ai.matchJD('', ''),
      missing: await JobLens.ai.matchJD('Python React', 'Python'),
      full: await JobLens.ai.matchJD('Python', 'Python '.repeat(300))
    }));
    assert.equal(boundaries.empty.score, 0);
    assert(boundaries.missing.missing.includes('React'));
    assert.equal(boundaries.full.score, 100);
    await page.goto(base + '/joblens/#/interview');
    await page.locator('#qCount').selectOption('3');
    await page.locator('#startBtn').click();
    for (let i = 0; i < 3; i++) { await page.locator('#skipBtn').click(); }
    await page.locator('#exportRptBtn').waitFor();
    assert((await page.locator('#reportMd').innerText()).includes('面试报告'));
    assert.equal(await page.evaluate(() => JobLens.store.interviewHistory()[0].count), 3);

    const selfTests = [];
    page.on('console', message => { if (message.text().includes('self-test')) selfTests.push(message.text()); });
    await page.goto(base + '/ai-voice-pet/');
    await page.waitForFunction(() => document.querySelectorAll('.part img[src]').length === 18);
    await page.locator('#textInput').fill('你好小元');
    await page.locator('#sendBtn').click();
    await page.locator('.bubble.pet').last().waitFor();
    assert.match(await page.locator('.bubble.pet').last().innerText(), /你好/);
    assert.equal(await page.locator('.part[data-part="zzz"]').evaluate(el => getComputedStyle(el).display), 'none');
    await page.locator('[data-act="pet"]').click();
    assert.match(await page.locator('.bubble.pet').last().innerText(), /摸/);
    await page.locator('#gear').click();
    assert.equal(await page.locator('#sheet').getAttribute('aria-hidden'), 'false');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#sheet').getAttribute('aria-hidden'), 'true');
    assert(!selfTests.some(text => text.includes('FAIL')), selfTests.join('\n'));

    const requests = [];
    await page.route('https://model.example.test/v1/chat/completions', async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { choices: [{ message: { content: '测试回复' } }] } });
    });
    await page.evaluate(() => localStorage.setItem('yuanpet_cfg', JSON.stringify({ mode: 'api', baseURL: 'https://model.example.test/v1', apiKey: 'test-key', model: 'test' })));
    await page.locator('#clearChat').click();
    for (const text of ['第一句话', '第二句话']) {
      await page.locator('#textInput').fill(text); await page.locator('#sendBtn').click();
      await page.waitForFunction(() => !document.getElementById('sendBtn').disabled);
    }
    assert.equal(requests.length, 2);
    assert(requests[1].messages.some(message => message.content === '第一句话'), 'Context must survive across turns');
    assert.deepEqual(errors, [], 'Runtime errors');
    console.log('PASS: desktop/mobile, reading, JD matching/export, PDF, backup privacy, interview, pet interaction/settings and conversation context.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
