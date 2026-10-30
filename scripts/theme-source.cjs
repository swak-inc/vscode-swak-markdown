const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const themeDirectory = path.resolve(__dirname, '../vendor/swak-theme');
const themeRepository = 'https://github.com/swak-inc/obsidian-theme-swak';
const themeFiles = ['theme.css', 'LICENSE', 'ui-sample-en.md', 'ui-sample-ja.md', 'ui-reference.md', 'ui-embed-sample.md', 'screenshot.png'];
const digest = data => createHash('sha256').update(data).digest('hex');
const themeFile = name => {
  if (!themeFiles.includes(name)) throw new Error('対象外のテーマファイル: ' + name);
  return path.join(themeDirectory, name);
};

async function verifyThemeSource() {
  const manifest = JSON.parse(await fs.readFile(path.join(themeDirectory, 'source.json'), 'utf8'));
  if (manifest.repository !== themeRepository || !/^[a-f0-9]{40}$/.test(manifest.revision)) throw new Error('テーマの取得元情報が不正です');
  if (Object.keys(manifest.files).sort().join('\n') !== [...themeFiles].sort().join('\n')) throw new Error('テーマファイルの一覧が一致しません');
  for (const name of themeFiles) {
    if (digest(await fs.readFile(themeFile(name))) !== manifest.files[name]) throw new Error('テーマを直接編集せず、同期コマンドで更新してください: ' + name);
  }
  return manifest;
}

module.exports = { themeDirectory, themeRepository, themeFiles, themeFile, digest, verifyThemeSource };
