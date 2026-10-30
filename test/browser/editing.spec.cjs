const { test, expect } = require('@playwright/test');
const { setup: setupBrowser } = require('../helpers/browser.cjs');

const source = '# Title\n\n本文です。\n\n### 表\n\n| 項目 | 内容 |\n| --- | --- |\n| 日本語 | セル本文 |\n\n> [!tip]+ 推奨\n> 本文です。\n>\n> > [!danger]- 注意\n> > 保持します。\n\n- [ ] **確認**: 作業\n\n==***重要***==と~~取消~~\n\n数式 $E=mc^2$\n';

const setup = (page, text = source) => setupBrowser(page, text);

test('ビルド済み画面で英字・日本語・改行を入力して保存し、Undo／Redoできる', async ({ page }) => {
  const { host, errors } = await setup(page);
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' abc');
  await page.keyboard.insertText('日本語😀');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('次の段落');
  await expect.poll(() => host.document.text).toContain('本文です。 abc日本語😀\n\n次の段落');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('保存済み');
  await page.locator('[data-command="undo"]').click();
  await expect.poll(() => host.document.text).not.toContain('次の段落');
  await page.locator('[data-command="redo"]').click();
  await expect.poll(() => host.document.text).toContain('次の段落');
  expect(errors).toEqual([]);
  expect(host.recovered).toEqual([]);
});

test('見出し・表・コールアウト・装飾内の文字を入力し、型と装飾を維持する', async ({ page }) => {
  const { host, errors } = await setup(page);
  for (const selector of ['.ProseMirror > h1', '.ProseMirror td p', '.ProseMirror .callout-content > p', '.ProseMirror mark strong', '.ProseMirror s']) {
    const node = page.locator(selector).first();
    await node.click();
    await page.keyboard.insertText('追記');
    await expect(node).toContainText('追記');
  }
  await expect.poll(() => host.document.text).toMatch(/==\*\*\*[^\n]*追記[^\n]*\*\*\*==/);
  expect(host.document.text).toContain('[!tip]+');
  expect(host.document.text).toContain('[!danger]-');
  expect(errors).toEqual([]);
});

test('編集直後も同じ画面内で閲覧と編集を往復し、Undo履歴と数式表示を保つ', async ({ page }) => {
  const { host, errors } = await setup(page);
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.insertText('変更');
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#preview')).toContainText('変更');
  await expect(page.locator('#preview .katex')).toBeVisible();
  await expect(page.locator('#preview details.callout')).toHaveCount(2);
  await page.getByRole('button', { name: 'ライブプレビュー', exact: true }).click();
  await expect(page.locator('#preview')).toBeHidden();
  await page.locator('[data-command="undo"]').click();
  await expect.poll(() => host.document.text).toBe(source);
  expect(host.opened).toEqual([]);
  expect(errors).toEqual([]);
});

test('IME変換中の編集は確定後に同期し、未変更の記法を保持する', async ({ page }) => {
  const { host, errors } = await setup(page);
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  const session = await page.context().newCDPSession(page);
  await session.send('Input.imeSetComposition', { text: 'にほんご', selectionStart: 4, selectionEnd: 4 });
  expect(host.document.text).toBe(source);
  await session.send('Input.imeSetComposition', { text: '日本語', selectionStart: 3, selectionEnd: 3 });
  await session.send('Input.insertText', { text: '日本語' });
  await expect.poll(() => host.document.text).toContain('本文です。日本語');
  expect(host.document.text).toContain('> > [!danger]- 注意');
  expect(errors).toEqual([]);
});

test('閲覧表示はHTML折りたたみを保ち、本文内のスクリプトとイベントを実行しない', async ({ page }) => {
  const { host, errors } = await setup(page, '<details><summary>補足</summary><p onclick="window.injected=true">本文</p></details>\n\n<script>window.injected=true</script>\n');
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await page.locator('#preview summary').click();
  await expect(page.locator('#preview details')).toHaveAttribute('open', '');
  await expect(page.locator('#preview p')).toHaveText('本文');
  await expect(page.locator('#preview [onclick], #preview script')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  expect(host.document.isDirty).toBe(false);
  expect(errors).toEqual([]);
});
