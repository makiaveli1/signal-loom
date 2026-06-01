import { expect, test, type Page } from '@playwright/test';

const FAIL_TEXT = [
  'Unhandled Runtime Error',
  'Hydration failed',
  'Text content does not match server-rendered HTML',
  'Application error',
];

async function collectShellMetrics(page: Page) {
  return page.evaluate((failText) => {
    const box = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
      };
    };

    const bodyText = document.body.innerText || '';
    const overlayPresent = [
      '[data-nextjs-dialog-overlay]',
      '[data-nextjs-dialog]',
      'template[data-next-error-message]',
    ].some((selector) => document.querySelector(selector));

    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlayPresent,
      failTextPresent: failText.some((text) => bodyText.includes(text)),
      composerShell: box('.composer-shell'),
      composerFrame: box('.composer-input-frame'),
      transcript: box('.transcript-scroll'),
    };
  }, FAIL_TEXT);
}

test.describe('Signal Loom cockpit smoke', () => {
  test('renders the workbench without browser-level regressions', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto('/');
    await expect(page.getByText('Signal Loom').first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Message (Hermes Agent|Nero)/i })).toBeVisible();

    const metrics = await collectShellMetrics(page);
    await testInfo.attach('shell-metrics', {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });

    expect(metrics.overflowX).toBe(0);
    expect(metrics.overlayPresent).toBe(false);
    expect(metrics.failTextPresent).toBe(false);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('keeps the mobile composer usable when options are open', async ({ browser }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-specific clipping guard');

    const context = await browser.newContext({
      viewport: { width: 320, height: 700 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page.getByRole('textbox', { name: /Message (Hermes Agent|Nero)/i })).toBeVisible();
      await page.getByRole('button', { name: /^Options$/ }).click();
      await expect(page.getByRole('button', { name: /^Close options$/ })).toBeVisible();

      const metrics = await collectShellMetrics(page);
      await testInfo.attach('mobile-options-metrics', {
        body: JSON.stringify(metrics, null, 2),
        contentType: 'application/json',
      });

      expect(metrics.overflowX).toBe(0);
      expect(metrics.overlayPresent).toBe(false);
      expect(metrics.failTextPresent).toBe(false);
      expect(metrics.composerFrame?.right ?? 999).toBeLessThanOrEqual(320);
      expect(metrics.composerShell?.height ?? 999).toBeLessThanOrEqual(260);
      // Guard against the original near-collapsed transcript failure while allowing
      // small font/layout differences between local WSL and GitHub's Linux runner.
      expect(metrics.transcript?.height ?? 0).toBeGreaterThanOrEqual(48);
    } finally {
      await context.close();
    }
  });
});
