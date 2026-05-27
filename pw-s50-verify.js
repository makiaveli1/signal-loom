/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const base = 'http://localhost:3000';
  const out = '/home/likwid/.openclaw/workspace/signal-loom/.verification-screenshots/';
  const results = [];

  // 1. Normal desktop — CRM button gone
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    const crmBtn = await page.locator('button', { hasText: 'CRM' }).count();
    const approvalsBtn = await page.locator('button', { hasText: 'Approvals' }).count();
    const topBarText = await page.locator('header').innerText().catch(() => '');
    results.push({
      test: 'crm-gone',
      crmButtonGone: crmBtn === 0,
      approvalsPresent: approvalsBtn > 0,
      topBarNoCRM: !topBarText.includes('CRM')
    });
    await page.screenshot({ path: `${out}sl-s50-normal.png`, fullPage: false });
    await page.close();
  }

  // 2. Approvals panel
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('button', { hasText: 'Approvals' }).click();
    await page.waitForTimeout(500);
    results.push({ test: 'approvals-panel-ok', ok: true });
    await page.screenshot({ path: `${out}sl-s50-approvals.png`, fullPage: false });
    await page.close();
  }

  // 3. Narrow 1024px
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await page.screenshot({ path: `${out}sl-s50-narrow.png`, fullPage: false });
    results.push({ test: 'narrow-1024-ok', ok: true });
    await page.close();
  }

  // 4. Duo view
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    const duoBtn = page.getByRole('button', { name: 'Duo', exact: true });
    if (await duoBtn.isVisible().catch(() => false)) {
      await duoBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${out}sl-s50-duo.png`, fullPage: false });
    results.push({ test: 'duo-view-ok', ok: true });
    await page.close();
  }

  // 5. Zoom 110%
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.body.style.zoom = '1.1');
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await page.screenshot({ path: `${out}sl-s50-zoom110.png`, fullPage: false });
    results.push({ test: 'zoom-110-ok', ok: true });
    await page.close();
  }

  // 6. Agent roster visible
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    const roster = await page.locator('text=Agent Roster').count();
    results.push({ test: 'agent-roster-visible', rosterPresent: roster > 0 });
    await page.close();
  }

  await browser.close();
  console.log('Results:', JSON.stringify(results, null, 2));
  const failures = results.filter(r => {
    const vals = Object.values(r).filter((v) => typeof v === 'boolean');
    return vals.some(v => v === false);
  });
  console.log(failures.length === 0 ? 'ALL PASSED' : `FAILURES: ${JSON.stringify(failures)}`);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
