const { test, expect } = require('@playwright/test');
const { setup } = require('../helpers/browser.cjs');

const filler = Array.from({ length: 16 }, (_, index) => `本文 ${index + 1}。\n`).join('\n');
const source = `# 文書タイトル\n\n## 概要\n\n${filler}\n### 同じ見出し\n\n${filler}\n### 同じ見出し\n\n${filler}\n> [!tip]- 折りたたみ\n> #### 詳細な手順\n> 内容です。\n\n\`\`\`md\n# コード内の見出し\n\`\`\`\n\n${filler}`;

test('右側の目次に階層と同名の見出しを表示し、文書を変更せず移動する', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  await expect(page.locator('#outline')).toBeVisible();
  const buttons = page.locator('#outline-list .outline-link');
  await expect(buttons).toHaveText(['文書タイトル', '概要', '同じ見出し', '同じ見出し', '詳細な手順']);
  const geometry = await page.evaluate(() => ({
    contentRight: document.getElementById('document-content').getBoundingClientRect().right,
    outlineLeft: document.getElementById('outline').getBoundingClientRect().left
  }));
  expect(geometry.outlineLeft).toBeGreaterThanOrEqual(geometry.contentRight);
  await buttons.nth(3).click();
  await page.evaluate(() => window.scrollBy(0, -1));
  await expect(buttons.nth(3)).toHaveAttribute('aria-current', 'location');
  const position = await page.locator('.ProseMirror h3').nth(1).evaluate(element => ({
    heading: element.getBoundingClientRect().top,
    toolbar: document.getElementById('toolbar').getBoundingClientRect().bottom
  }));
  expect(position.heading).toBeGreaterThan(position.toolbar);
  expect(position.heading - position.toolbar).toBeLessThan(30);
  expect(host.document.text).toBe(source);
  expect(host.document.isDirty).toBe(false);
  await buttons.last().click();
  await expect(page.locator('.ProseMirror .callout-content')).toBeVisible();
  expect(host.document.text).toContain('[!tip]-');
  expect(errors).toEqual([]);
});

test('見出しの打鍵・Undoと閲覧切替に追従し、折りたたみ内にも移動できる', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  await page.locator('#outline-list .outline-link').nth(1).click();
  await page.keyboard.insertText('更新');
  await expect(page.locator('#outline-list .outline-link').nth(1)).toHaveText('更新概要');
  await page.locator('[data-command="undo"]').click();
  await expect(page.locator('#outline-list .outline-link').nth(1)).toHaveText('概要');
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await page.locator('#outline-list .outline-link').last().click();
  await expect(page.locator('#preview details')).toHaveAttribute('open', '');
  await expect(page.locator('#outline-list .outline-link').last()).toHaveAttribute('aria-current', 'location');
  expect(host.opened).toEqual([]);
  expect(host.document.text).toBe(source);
  expect(errors).toEqual([]);
});

test('スクロールで現在位置を更新し、狭い画面では目次を開閉できる', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  await page.locator('.ProseMirror h3').first().evaluate(element => element.scrollIntoView({ block: 'start' }));
  await expect(page.locator('#outline-list .outline-link').nth(2)).toHaveAttribute('aria-current', 'location');
  await page.setViewportSize({ width: 600, height: 720 });
  await expect(page.locator('#outline')).toBeHidden();
  await page.getByRole('button', { name: '目次', exact: true }).click();
  await expect(page.locator('#outline')).toBeVisible();
  await page.locator('#outline-list .outline-link').first().click();
  await expect(page.locator('#outline')).toBeHidden();
  const width = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  expect(width.page).toBeLessThanOrEqual(width.viewport);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#outline')).toBeVisible();
  await page.getByRole('button', { name: '目次を閉じる', exact: true }).click();
  await expect(page.locator('#outline')).toBeHidden();
  expect(host.document.text).toBe(source);
  expect(errors).toEqual([]);
});

test('見出しがない文書でも編集でき、見出し追加後に目次が現れる', async ({ page }) => {
  const { errors } = await setup(page, '本文です。\n');
  await expect(page.locator('#outline-empty')).toBeVisible();
  await page.locator('.ProseMirror p').click();
  await page.getByRole('button', { name: 'H2', exact: true }).click();
  await expect(page.locator('#outline-list .outline-link')).toHaveText(['本文です。']);
  await expect(page.locator('#outline-empty')).toBeHidden();
  expect(errors).toEqual([]);
});

test('見出しレベルの飛び・変更に合わせて親子関係とガイド線を更新する', async ({ page }) => {
  const text = `## 概要\n\n#### 詳細\n\n###### 補足\n\n### 次の項目\n\n## 別の章\n\n${filler}`;
  const { host, errors } = await setup(page, text);
  const roots = page.locator('#outline-list > li > .outline-row > .outline-link');
  const children = page.locator('#outline-list > li:first-child > ol > li > .outline-row > .outline-link');
  await expect(roots).toHaveText(['概要', '別の章']);
  await expect(children).toHaveText(['詳細', '次の項目']);
  await page.locator('#outline-list .outline-link').filter({ hasText: /^補足$/ }).click();
  await expect(page.locator('#outline-list .outline-branch-active')).toHaveCount(1);
  await expect(page.locator('#outline-list > li:first-child > ol > li:first-child > ol')).toHaveClass('outline-branch-active');
  await expect(page.locator('#outline-list ol').first()).toHaveCSS('border-left-width', '1px');
  expect(host.document.text).toBe(text);

  await page.locator('#outline-list .outline-link').filter({ hasText: /^詳細$/ }).click();
  await page.getByRole('button', { name: 'H2', exact: true }).click();
  await expect(roots).toHaveText(['概要', '詳細', '別の章']);
  await expect(page.locator('#outline-list > li:nth-child(2) > ol > li > .outline-row > .outline-link')).toHaveText(['補足', '次の項目']);
  await page.locator('[data-command="undo"]').click();
  await expect(roots).toHaveText(['概要', '別の章']);
  await expect(children).toHaveText(['詳細', '次の項目']);
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await expect(roots).toHaveText(['概要', '別の章']);
  await expect(children).toHaveText(['詳細', '次の項目']);
  expect(host.document.text).toBe(text);
  expect(errors).toEqual([]);
});

test('個別・全体の開閉は本文や位置を変えず、スクロール・表示切替後も閉じたまま保つ', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  const links = page.locator('#outline-list .outline-link');
  const rootToggle = page.locator('#outline-list > li > .outline-row > .outline-chevron');
  const expand = page.getByRole('button', { name: '目次をすべて展開', exact: true });
  const collapse = page.getByRole('button', { name: '目次をすべて折りたたむ', exact: true });
  await expect(expand).toBeDisabled();
  await page.getByRole('button', { name: '概要を折りたたむ', exact: true }).click();
  await expect(links.nth(2)).toBeHidden();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.locator('.ProseMirror h3').first().evaluate(element => element.scrollIntoView({ block: 'start' }));
  await expect(page.getByRole('button', { name: '概要を展開', exact: true })).toBeVisible();
  await expect(links.nth(2)).toBeHidden();
  await expect(links.nth(1)).toHaveCSS('border-left-width', '0px');
  await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await expect(links.nth(2)).toBeHidden();
  await page.getByRole('button', { name: 'ライブプレビュー', exact: true }).click();
  await expect(links.nth(2)).toBeHidden();
  await collapse.click();
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(links.nth(1)).toBeHidden();
  await expect(collapse).toBeDisabled();
  await rootToggle.focus();
  await page.keyboard.press('Enter');
  await expect(links.nth(1)).toBeVisible();
  await expect(links.nth(2)).toBeHidden();
  await expand.click();
  await expect(links.last()).toBeVisible();
  await expect(expand).toBeDisabled();
  expect(host.document.text).toBe(source);
  expect(host.document.isDirty).toBe(false);
  expect(errors).toEqual([]);
});

test('折りたたんだ親の名称変更や手前への見出し追加でも開閉状態を維持する', async ({ page }) => {
  const { host, errors } = await setup(page, '## 前の章\n\n本文です。\n\n## 後の章\n\n### 子見出し\n\n内容です。\n');
  await page.getByRole('button', { name: '後の章を折りたたむ', exact: true }).click();
  await page.locator('#outline-list .outline-link').filter({ hasText: /^後の章$/ }).click();
  await page.keyboard.insertText('新しい');
  await expect(page.getByRole('button', { name: '新しい後の章を展開', exact: true })).toBeVisible();
  await expect(page.locator('#outline-list .outline-link').last()).toBeHidden();
  await page.locator('.ProseMirror p').first().click();
  await page.getByRole('button', { name: 'H2', exact: true }).click();
  await expect(page.locator('#outline-list .outline-link')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '新しい後の章を展開', exact: true })).toBeVisible();
  await expect(page.locator('#outline-list .outline-link').last()).toBeHidden();
  await page.getByRole('button', { name: '目次をすべて展開', exact: true }).click();
  await expect(page.locator('#outline-list .outline-link').last()).toBeVisible();
  expect(host.document.text).toContain('## 新しい後の章');
  expect(errors).toEqual([]);
});

test('展開中の親・末端・ホバー・キーボード操作に最も近い階層の線だけを強調する', async ({ page }) => {
  const { host, errors } = await setup(page, source);
  const links = page.locator('#outline-list .outline-link');
  const guide = page.locator('#outline-list .outline-branch-active');
  await links.nth(1).click();
  await expect(guide).toHaveCount(1);
  await expect(guide).toHaveAttribute('id', 'outline-children-1');
  await links.nth(3).click();
  await expect(guide).toHaveAttribute('id', 'outline-children-3');
  await links.nth(4).click();
  await expect(guide).toHaveAttribute('id', 'outline-children-3');
  await links.nth(1).hover();
  await expect(guide).toHaveAttribute('id', 'outline-children-1');
  await page.locator('#outline-toggle').hover();
  await expect(guide).toHaveAttribute('id', 'outline-children-3');
  await page.getByRole('button', { name: '概要を折りたたむ', exact: true }).focus();
  await expect(guide).toHaveAttribute('id', 'outline-children-1');
  await page.locator('#outline-toggle').focus();
  await expect(guide).toHaveAttribute('id', 'outline-children-3');
  await page.getByRole('button', { name: '同じ見出しを折りたたむ', exact: true }).click();
  await expect(guide).toHaveAttribute('id', 'outline-children-1');
  expect(host.document.text).toBe(source);
  expect(host.document.isDirty).toBe(false);
  expect(errors).toEqual([]);
});
