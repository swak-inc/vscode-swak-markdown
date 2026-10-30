const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const MarkdownIt = require('markdown-it');
const { themeFile } = require('../scripts/theme-source.cjs');
const { activate } = require('../dist/extension.cjs');
const createMarkdown = () => activate().extendMarkdownIt(new MarkdownIt({ html: true }));

test('基本13種類を表示し、指定アイコンとネストを保持する', () => {
  const md = createMarkdown();
  const types = ['note', 'abstract', 'info', 'todo', 'tip', 'success', 'question', 'warning', 'failure', 'danger', 'bug', 'example', 'quote'];
  for (const type of types) {
    const html = md.render(`> [!${type}] **見出し**\n> 本文`);
    assert.match(html, new RegExp(`data-callout="${type}"`));
    assert.match(html, /<svg\s/);
    assert.match(html, /<strong>見出し<\/strong>/);
    assert.doesNotMatch(html, /\[!/);
  }
  const icons = JSON.parse(readFileSync(new URL('../dist/icons.json', `file://${__filename}`)));
  for (const type of ['abstract', 'todo', 'tip', 'success', 'failure', 'danger']) {
    assert.ok(md.render(`> [!${type}]`).includes(icons[type]));
  }
  const nested = md.render('> [!tip] 外側\n> 本文\n>\n> > [!danger] 内側\n> > 本文');
  assert.equal((nested.match(/data-callout=/g) || []).length, 2);
  assert.match(nested, /data-line="0"/);
  assert.match(nested, /data-line="3"/);
});

test('折りたたみの開閉初期状態と通常の引用を保持する', () => {
  const md = createMarkdown();
  assert.match(md.render('> [!note]+ 開く\n> 本文'), /<details[^>]+ open>/);
  assert.match(md.render('> [!note]- 閉じる\n> 本文'), /<details[^>]+data-callout-fold="-">/);
  assert.match(md.render('> 引用\n>\n> > ネスト'), /<blockquote>\s*<p>引用<\/p>\s*<blockquote>/);
});

test('複合装飾と番号付き・番号なしタスクを表示し、コード内は変換しない', () => {
  const md = createMarkdown();
  assert.match(md.render('==***重要***=='), /<mark><em><strong>重要<\/strong><\/em><\/mark>/);
  assert.match(md.render('前に==***重要***==です'), /前に<mark><em><strong>重要<\/strong><\/em><\/mark>です/);
  assert.doesNotMatch(md.render('== 未完了 == と \\==文字\\=='), /<mark>/);
  const tasks = md.render('- [x] 完了\n- [ ] 未完了\n\n1. [ ] 手順');
  assert.equal((tasks.match(/type="checkbox"/g) || []).length, 3);
  assert.equal((tasks.match(/checked=""/g) || []).length, 1);
  const code = md.render('`==***そのまま***==`\n\n```md\n> [!danger] そのまま\n```');
  assert.doesNotMatch(code, /<mark>|class="callout/);
  assert.match(code, /&gt; \[!danger\]/);
});

test('既存の公開UIサンプルを本文の書き換えなしで表示する', () => {
  const html = createMarkdown().render(readFileSync(themeFile('ui-sample-ja.md'), 'utf8'));
  assert.match(html, /<h1>事業計画とシステム要件<\/h1>/);
  assert.match(html, /<table>/);
  assert.match(html, /data-callout="tip"/);
  assert.match(html, /<mark><em><strong>必ず検証環境で確認/);
  assert.match(html, /href="ui-reference.md"/);
});
