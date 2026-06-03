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

    const boxes = (selector: string) => [...document.querySelectorAll(selector)].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
      };
    });

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const overflowsViewport = (rect: { x: number; right: number }) => rect.x < 0 || rect.right > viewportWidth;

    const bodyText = document.body.innerText || '';
    const overlayPresent = [
      '[data-nextjs-dialog-overlay]',
      '[data-nextjs-dialog]',
      'template[data-next-error-message]',
    ].some((selector) => document.querySelector(selector));

    const visibleControls = [...document.querySelectorAll('button, [role="button"], input, textarea, select')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const unnamedVisibleControls = visibleControls.filter((element) => {
      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.getAttribute('placeholder') ||
        element.textContent ||
        '';
      return !label.trim();
    }).length;
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id).filter(Boolean);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

    const messageCards = boxes('.message-card-shell, .action-summary-premium');
    const workTracePanels = boxes('.work-trace-panel');
    const messageSourceChips = boxes('.message-source-chip');

    return {
      viewportWidth,
      viewportHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlayPresent,
      failTextPresent: failText.some((text) => bodyText.includes(text)),
      duplicateIds,
      unnamedVisibleControls,
      messageCardCount: messageCards.length,
      messageCardOverflows: messageCards.filter(overflowsViewport),
      workTracePanelOverflows: workTracePanels.filter(overflowsViewport),
      messageSourceChipOverflows: messageSourceChips.filter(overflowsViewport),
      composerShell: box('.composer-shell'),
      composerFrame: box('.composer-input-frame'),
      transcript: box('.transcript-scroll'),
    };
  }, FAIL_TEXT);
}

async function expectShellClean(page: Page, testInfo: { attach: (name: string, options: { body: string; contentType: string }) => Promise<void> }, attachmentName: string) {
  const metrics = await collectShellMetrics(page);
  await testInfo.attach(attachmentName, {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });

  expect(metrics.overflowX).toBe(0);
  expect(metrics.overlayPresent).toBe(false);
  expect(metrics.failTextPresent).toBe(false);
  expect(metrics.duplicateIds).toEqual([]);
  expect(metrics.unnamedVisibleControls).toBe(0);
  expect(metrics.messageCardOverflows).toEqual([]);
  expect(metrics.workTracePanelOverflows).toEqual([]);
  expect(metrics.messageSourceChipOverflows).toEqual([]);
  return metrics;
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

    const metrics = await expectShellClean(page, testInfo, 'shell-metrics');
    expect(metrics.messageCardCount).toBeGreaterThan(0);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('persists a dark and light theme across reloads', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /Message (Hermes Agent|Nero)/i })).toBeVisible();

    await page.locator('.layout-menu-summary').click();
    await page.getByRole('radio', { name: /^Operator Ember:/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-signal-theme', 'operator-ember');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-signal-theme', 'operator-ember');
    await expect(page.getByText('Ember').first()).toBeVisible();

    await page.locator('.layout-menu-summary').click();
    await page.getByRole('radio', { name: /^Papyrus Dawn:/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-signal-theme', 'papyrus-dawn');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-signal-theme', 'papyrus-dawn');
    await expect(page.getByText('Dawn').first()).toBeVisible();

    await expectShellClean(page, testInfo, 'theme-persistence-metrics');
  });

  test('opens settings modal and shows runtime truth without token values', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /Message (Hermes Agent|Nero)/i })).toBeVisible();

    const desktopSettings = page.getByRole('button', { name: 'Open Hermes settings' });
    if (await desktopSettings.isVisible()) {
      await desktopSettings.click();
    } else {
      await page.getByRole('button', { name: /Open Signal Loom mobile actions/i }).click();
      await page.getByRole('menuitem', { name: 'Connect / Settings' }).click();
    }

    await expect(page.getByRole('dialog', { name: 'Hermes settings' })).toBeVisible();
    await expect(page.getByText('Runtime truth')).toBeVisible();
    await expect(page.getByText('Detected Signal Loom configuration')).toBeVisible();
    await expect(page.getByText('Hermes API', { exact: true })).toBeVisible();
    await expect(page.getByText('API token', { exact: true })).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Bearer ');
    expect(bodyText).not.toContain('secret-token');

    await expectShellClean(page, testInfo, 'settings-runtime-truth-metrics');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('keeps the mobile composer usable when options are open', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-specific clipping guard');

    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /Message (Hermes Agent|Nero)/i })).toBeVisible();
    const optionsButton = page.getByRole('button', { name: /^Options$/ });
    if (await optionsButton.isVisible()) {
      await optionsButton.click();
      await expect(page.getByRole('button', { name: /^Close options$/ })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: /^Open Settings$/ }).first()).toBeVisible();
    }

    const metrics = await collectShellMetrics(page);
    await testInfo.attach('mobile-options-metrics', {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });

    expect(metrics.overflowX).toBe(0);
    expect(metrics.overlayPresent).toBe(false);
    expect(metrics.failTextPresent).toBe(false);
    expect(metrics.messageCardOverflows).toEqual([]);
    expect(metrics.workTracePanelOverflows).toEqual([]);
    expect(metrics.messageSourceChipOverflows).toEqual([]);
    expect(metrics.composerFrame?.right ?? 999).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.composerShell?.height ?? 999).toBeLessThanOrEqual(260);
    // Guard against the original near-collapsed transcript failure while allowing
    // small font/layout differences between local WSL and GitHub's Linux runner.
    expect(metrics.transcript?.height ?? 0).toBeGreaterThanOrEqual(48);
  });
});
