const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { setup } = require('../test/helpers/browser.cjs');
const { themeDirectory: sampleDirectory, verifyThemeSource } = require('./theme-source.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'media/marketplace');
const themes = {
  light: { background: '#ffffff', foreground: '#333333', muted: '#616161', link: '#005fb8', selection: '#e4e6f1', border: '#d4d4d4', sidebar: '#f8f8f8' },
  dark: { background: '#1f1f1f', foreground: '#cccccc', muted: '#9d9d9d', link: '#4daafc', selection: '#37373d', border: '#454545', sidebar: '#181818' }
};

async function main() {
  await verifyThemeSource();
  const reference = await fs.readFile(path.join(sampleDirectory, 'ui-reference.md'), 'utf8');
  const section = name => {
    const match = reference.match(new RegExp('<!-- showcase: ' + name + ' -->([\\s\\S]*?)(?=<!-- showcase:|$)'));
    if (!match) throw new Error('サンプルが見つかりません: ' + name);
    return match[1].trim() + '\n';
  };
  const samples = [
    { name: 'properties', text: '---\nname: project-notes\ndescription: 会議の目的と合意事項をまとめるノート。項目名と値を読み分けやすく表示し、長い説明文も省略せず確認できます。\nstatus: In progress\n---\n\n# プロジェクトノート\n\n概要を確認してから、次のアクションを整理します。\n', mode: 'live', height: 720, crop: true },
    { name: 'live', text: (await fs.readFile(path.join(sampleDirectory, 'ui-sample-en.md'), 'utf8')).split('\n---\n')[0], mode: 'live', height: 1400, crop: true },
    { name: 'reading', text: (await fs.readFile(path.join(sampleDirectory, 'ui-sample-ja.md'), 'utf8')).split('\n---\n')[0], mode: 'preview', height: 1400, crop: true },
    { name: 'typography', text: section('typography').split('A footnote adds context.')[0], mode: 'preview', height: 1080, crop: true },
    { name: 'callouts-information', text: section('callouts-information'), mode: 'preview', height: 1100, crop: true },
    { name: 'callouts-attention', text: section('callouts-attention'), mode: 'preview', height: 1100, crop: true }
  ];
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [appearance, colors] of Object.entries(themes)) {
      for (const sample of samples) {
        const page = await browser.newPage({ viewport: { width: 1184, height: sample.height }, deviceScaleFactor: 1.5 });
        try {
          const { host, errors } = await setup(page, sample.text);
          // IDEがWebviewへ渡すテーマクラスと色変数のみを補い、拡張本体のHTML/CSS/JSを撮影する。
          await page.evaluate(({ appearance, colors }) => {
            document.body.classList.add('vscode-' + appearance);
            const variables = {
              'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              'editor-background': colors.background, 'editor-foreground': colors.foreground,
              foreground: colors.foreground, descriptionForeground: colors.muted,
              'textLink-foreground': colors.link, 'focusBorder': colors.link,
              'list-inactiveSelectionBackground': colors.selection, 'widget-border': colors.border,
              'sideBar-background': colors.sidebar, 'toolbar-hoverBackground': colors.selection,
              errorForeground: '#f14c4c'
            };
            for (const [name, value] of Object.entries(variables)) document.body.style.setProperty('--vscode-' + name, value);
          }, { appearance, colors });
          if (sample.mode === 'preview') await page.locator('[data-mode="preview"]').click();
          await page.evaluate(() => document.fonts.ready);
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
          const content = sample.mode === 'live' ? '.ProseMirror' : '#preview';
          const height = sample.crop ? await page.locator(content + ' > :last-child').evaluate(el => Math.ceil(el.getBoundingClientRect().bottom + 32)) : sample.height;
          assert.ok(height <= sample.height, sample.name + ': 末尾が撮影範囲を超えています');
          await page.screenshot({ path: path.join(output, sample.name + '-' + appearance + '.png'), clip: { x: 0, y: 0, width: 1184, height }, animations: 'disabled', caret: 'hide' });
          assert.deepEqual(errors, []);
          assert.equal(host.document.text, sample.text);
          console.log("[swak][screenshots] ✅ 撮影完了 - '" + sample.name + '-' + appearance + ".png'");
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
}

main().catch(error => { console.error('[swak][screenshots] ❌ 撮影失敗 -', error); process.exitCode = 1; });
