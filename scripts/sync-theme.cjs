const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { themeDirectory, themeRepository, themeFiles, themeFile, digest, verifyThemeSource } = require('./theme-source.cjs');

async function main() {
  const [source, ref = 'HEAD'] = process.argv.slice(2);
  if (!source) throw new Error('使い方: npm run sync:theme -- <Obsidianテーマのcloneパス> [commit/tag]');
  const git = args => execFileSync('git', ['-C', source, ...args], { maxBuffer: 10 * 1024 * 1024 });
  const remote = git(['remote', 'get-url', 'origin']).toString().trim().replace(/\.git$/, '');
  if (![themeRepository, 'git@github.com:swak-inc/obsidian-theme-swak'].includes(remote)) throw new Error('Swak Obsidianテーマの正本cloneを指定してください');
  const revision = git(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}']).toString().trim();
  const contents = new Map(themeFiles.map(name => [name, git(['show', revision + ':' + name])]));
  const manifest = { repository: themeRepository, revision, files: Object.fromEntries([...contents].map(([name, data]) => [name, digest(data)])) };
  await fs.mkdir(themeDirectory, { recursive: true });
  for (const [name, data] of contents) await fs.writeFile(themeFile(name), data);
  await fs.writeFile(path.join(themeDirectory, 'source.json'), JSON.stringify(manifest, null, 2) + '\n');
  await verifyThemeSource();
  console.log('[swak][theme-sync] ✅ 同期完了 - commit [' + revision + ']');
}

main().catch(error => { console.error('[swak][theme-sync] ❌ 同期失敗 -', error.message); process.exitCode = 1; });
