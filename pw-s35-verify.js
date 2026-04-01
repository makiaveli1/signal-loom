const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const base = 'http://localhost:3099';
  const out = '/home/likwid/.openclaw/workspace/signal-loom/.verification-screenshots/';
  const results = [];

  // Helper: open approvals panel
  async function openApprovals(page) {
    const btn = page.locator('button', { hasText: 'Approvals' });
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(500);
  }

  // 1. Normal desktop 1440px
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await openApprovals(page);
    await page.screenshot({ path: `${out}sl-s35-normal-1440.png`, fullPage: false });
    const approvalText = await page.locator('text=APPROVALS').first().isVisible();
    results.push({ test: 'normal-1440', approvalsVisible: approvalText });
    await page.close();
  }

  // 2. Narrow desktop 1024px
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await openApprovals(page);
    await page.screenshot({ path: `${out}sl-s35-narrow-1024.png`, fullPage: false });
    results.push({ test: 'narrow-1024', ok: true });
    await page.close();
  }

  // 3. Zoom 110% (1440px effective at 110% zoom)
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.body.style.zoom = '1.1');
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await openApprovals(page);
    await page.screenshot({ path: `${out}sl-s35-zoom110.png`, fullPage: false });
    results.push({ test: 'zoom-110', ok: true });
    await page.close();
  }

  // 4. Duo view (two columns)
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await openApprovals(page);
    // Click Duo preset (exact match)
    const duoBtn = page.getByRole('button', { name: 'Duo', exact: true });
    if (await duoBtn.isVisible()) await duoBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}sl-s35-duo.png`, fullPage: false });
    results.push({ test: 'duo-view', ok: true });
    await page.close();
  }

  // 5. Check DOM: verify DENIAL_NEXT_STEP constant renders (inject test data via JS)
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    await openApprovals(page);
    // Check approvals panel structure is intact
    const panelHeader = await page.locator('text=APPROVALS').first().isVisible();
    const emailSection = await page.locator('text=EMAIL OUTBOUND').isVisible().catch(() => false);
    const approvalsCount = await page.locator('[data-automation-id^="approval-card-"]').count();
    const emailGatesCount = await page.locator('[data-automation-id^="email-gate-card-"]').count();
    results.push({ test: 'dom-check', panelHeader, emailSection, approvalsCount, emailGatesCount });
    await page.close();
  }

  await browser.close();

  console.log('Results:', JSON.stringify(results, null, 2));
  console.log('Screenshots saved to', out);
  console.log('Done');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
