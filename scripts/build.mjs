import { readFile, writeFile, mkdir, copyFile, readdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import themeSource from './theme-source.cjs';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await mkdir(dist, { recursive: true });
await themeSource.verifyThemeSource();
const theme = await readFile(themeSource.themeFile('theme.css'), 'utf8');

// 配色・アイコンの正本はObsidian用theme.css。プレビューのDOM名だけ合わせる。
const previewTheme = theme
  .replaceAll('.markdown-rendered', '.markdown-body')
  .replaceAll('.theme-dark', ':is(.vscode-dark, .vscode-high-contrast)')
  .replaceAll('.theme-light', ':is(.vscode-light, .vscode-high-contrast-light)')
  .replace(/\bdetails(?=[\s[.{:])/g, 'details:not(.callout)');
await writeFile(new URL('theme.css', dist), previewTheme);

const icons = {};
for (const [type, icon] of Object.entries({ note: 'pencil', abstract: 'square-text', info: 'info', todo: 'list-todo', example: 'list', tip: 'lightbulb', success: 'circle-check', question: 'circle-help', warning: 'triangle-alert', failure: 'circle-x', danger: 'circle-alert', bug: 'bug', quote: 'quote' })) {
  icons[type] = await readFile(new URL(`node_modules/lucide-static/icons/${icon}.svg`, root), 'utf8');
}
for (const match of theme.matchAll(/([^{}]+)\{[^{}]*--callout-icon:\s*([^;]+);[^{}]*\}/g)) {
  const [, selector, value] = match;
  let svg;
  if (value.startsWith('lucide-')) {
    svg = await readFile(new URL(`node_modules/lucide-static/icons/${value.trim().slice(7)}.svg`, root), 'utf8');
  } else if (value.trim().startsWith("'<svg")) {
    svg = value.trim().slice(1, -1);
  } else {
    throw new Error(`未対応のコールアウトアイコン: ${value}`);
  }
  for (const type of selector.matchAll(/data-callout="([a-z-]+)"/g)) icons[type[1]] = svg;
}
await writeFile(new URL('icons.json', dist), JSON.stringify(icons, null, 2) + '\n');

const hostBuild = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['src/extension.cjs'],
  outfile: 'dist/extension.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  legalComments: 'eof',
  external: ['vscode'],
  metafile: true
});
// CJSのモデルとESMのビューが別々のクラスを持つと、実打鍵時にFragment変換が失敗する。
const editorAliases = {};
for (const name of (await readdir(new URL('node_modules/', root))).filter(name => name.startsWith('prosemirror-') || name === 'orderedmap')) {
  const directory = new URL('node_modules/' + name + '/', root);
  const pkg = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
  editorAliases[name] = fileURLToPath(new URL(pkg.module || pkg.main, directory));
}
const liveBuild = await build({ alias: editorAliases, absWorkingDir: fileURLToPath(root), entryPoints: ['src/live.js'], outfile: 'dist/live.js', bundle: true, platform: 'browser', target: 'chrome130', format: 'iife', legalComments: 'eof', metafile: true });
const vendorStyles = await Promise.all(['prosemirror-view/style/prosemirror.css', 'prosemirror-tables/style/tables.css'].map(path => readFile(new URL('node_modules/' + path, root), 'utf8')));
await writeFile(new URL('live-vendor.css', dist), vendorStyles.join('\n'));
await rm(new URL('katex/', dist), { recursive: true, force: true });
await mkdir(new URL('katex/', dist), { recursive: true });
await copyFile(new URL('node_modules/katex/dist/katex.min.css', root), new URL('katex/katex.min.css', dist));
await cp(new URL('node_modules/katex/dist/fonts/', root), new URL('katex/fonts/', dist), { recursive: true });

const notices = ['Swak Obsidian theme\n' + await readFile(themeSource.themeFile('LICENSE'), 'utf8')];
const packages = new Set(['lucide-static']);
for (const input of [...Object.keys(hostBuild.metafile.inputs), ...Object.keys(liveBuild.metafile.inputs)]) {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(input);
  if (match) packages.add(match[1]);
}
for (const name of [...packages].sort()) {
  const directory = new URL(`node_modules/${name}/`, root);
  const licenses = (await readdir(directory)).filter(file => /^(license|copying)([.-]|$)/i.test(file));
  if (!licenses.length) throw new Error(`ライセンスファイルがありません: ${name}`);
  for (const license of licenses) notices.push(`${name}\n${await readFile(new URL(license, directory), 'utf8')}`);
}
await writeFile(new URL('THIRD-PARTY-NOTICES.txt', dist), notices.join('\n\n---\n\n'));
