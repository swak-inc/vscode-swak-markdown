const { test, expect } = require('@playwright/test');
const { setup } = require('../helpers/browser.cjs');

test('プロパティはライブ・閲覧で同じ内容を表示し、本文の編集とUndoでもYAMLを保持する', async ({ page }) => {
  const yaml = '---\n# コメントを保持\nname: "sample"\ndescription: |\n  説明の1行目\n  説明の2行目\ntags: [meeting, proposal]\n---\n\n';
  const source = yaml + '# 見出し\n\n本文です。\n';
  const { host, errors } = await setup(page, source);
  const properties = page.locator('.ProseMirror .swak-properties');
  await expect(properties).toBeVisible();
  await expect(properties.locator('.metadata-property')).toHaveCount(3);
  await expect(properties.locator('.metadata-input-longtext').nth(1)).toHaveText('説明の1行目\n説明の2行目\n');
  const liveContent = await properties.textContent();
  expect(host.document.text).toBe(source);
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.insertText('追記');
  await expect.poll(() => host.document.text).toContain('本文です。追記');
  expect(host.document.text.startsWith(yaml)).toBe(true);
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await expect(page.locator('#preview .swak-properties')).toHaveText(liveContent);
  await page.getByRole('button', { name: 'ライブプレビュー', exact: true }).click();
  await page.locator('[data-command="undo"]').click();
  await expect.poll(() => host.document.text).toBe(source);
  expect(errors).toEqual([]);
});
