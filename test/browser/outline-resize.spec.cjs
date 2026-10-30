const { test, expect } = require('@playwright/test');
const { setup } = require('../helpers/browser.cjs');

const source = '# 文書タイトル\n\n## 概要\n\n本文です。\n\n### 詳細\n\n詳しい内容です。\n\n## 次の章\n\n次に進みます。\n';

async function dragBy(page, handle, delta, { release = true, fromBottom = false } = {}) {
  const bounds = await handle.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = fromBottom ? page.viewportSize().height - 16 : bounds.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y, { steps: 5 });
  if (release) await page.mouse.up();
}

test('目次の境界をドラッグすると本文と目次の幅が連動し、切替後も保持・初期化できる', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  const handle = page.getByRole('separator', { name: '本文と目次の幅を調整' });
  const content = page.locator('#document-content');
  await expect(handle).toHaveAttribute('aria-valuenow', '220');
  const original = await content.boundingBox();
  await page.getByRole('button', { name: '目次をすべて折りたたむ', exact: true }).click();
  await dragBy(page, handle, -160, { fromBottom: true });
  await expect(handle).toHaveAttribute('aria-valuenow', '380');
  expect((await content.boundingBox()).width).toBeCloseTo(original.width - 160);
  await expect(page.locator('body')).not.toHaveClass(/outline-resizing/);
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await expect(handle).toHaveAttribute('aria-valuenow', '380');
  await dragBy(page, handle, 80, { fromBottom: true });
  await expect(handle).toHaveAttribute('aria-valuenow', '300');
  await page.getByRole('button', { name: 'ライブプレビュー', exact: true }).click();
  await page.getByRole('button', { name: '目次', exact: true }).click();
  await expect(handle).toBeHidden();
  await page.getByRole('button', { name: '目次', exact: true }).click();
  await expect(handle).toHaveAttribute('aria-valuenow', '300');
  await page.locator('.ProseMirror p').last().click();
  await page.keyboard.insertText('幅変更後');
  await expect.poll(() => host.document.text).toContain('幅変更後');
  await page.locator('[data-command="undo"]').click();
  await expect.poll(() => host.document.text).toBe(source);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => host.document.isDirty).toBe(false);
  await handle.dblclick();
  await expect(handle).toHaveAttribute('aria-valuenow', '220');
  expect((await content.boundingBox()).width).toBeCloseTo(original.width);
  expect(host.document.text).toBe(source);
  expect(host.document.isDirty).toBe(false);
  expect(errors).toEqual([]);
});

test('幅の上下限・キーボード・ドラッグ取消と画面縮小で本文の幅を確保する', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  const handle = page.getByRole('separator', { name: '本文と目次の幅を調整' });
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '230');
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '220');
  await dragBy(page, handle, 400);
  await expect(handle).toHaveAttribute('aria-valuenow', '180');
  await dragBy(page, handle, -600);
  await expect(handle).toHaveAttribute('aria-valuenow', '480');
  await page.setViewportSize({ width: 820, height: 720 });
  await expect(handle).toHaveAttribute('aria-valuenow', '460');
  expect((await page.locator('#document-content').boundingBox()).width).toBeGreaterThanOrEqual(360);
  await page.setViewportSize({ width: 600, height: 720 });
  await page.getByRole('button', { name: '目次', exact: true }).click();
  await expect(page.locator('#outline')).toBeVisible();
  await expect(handle).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(handle).toHaveAttribute('aria-valuenow', '480');
  await dragBy(page, handle, 100, { release: false });
  await expect(handle).toHaveAttribute('aria-valuenow', '380');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '480');
  await expect(page.locator('body')).not.toHaveClass(/outline-resizing/);
  await page.keyboard.press('Enter');
  await expect(handle).toHaveAttribute('aria-valuenow', '220');
  expect(host.document.text).toBe(source);
  expect(host.document.isDirty).toBe(false);
  expect(errors).toEqual([]);
});
