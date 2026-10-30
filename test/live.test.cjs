const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { EditorState } = require('prosemirror-state');
const { history, undo, redo } = require('prosemirror-history');
const { parseDocument, serializeDocument, parser, serializer } = require('../src/live-model.cjs');
const { minimalEdit } = require('../src/text-edit.cjs');
const { themeFile } = require('../scripts/theme-source.cjs');

test('公開サンプルと全装飾リファレンスは開くだけで一文字も変えない', () => {
  for (const file of ['ui-sample-ja.md', 'ui-reference.md']) {
    const text = readFileSync(themeFile(file), 'utf8');
    const model = parseDocument(text);
    assert.equal(serializeDocument(model.doc, model.originals, model.eol), text);
  }
});

test('日本語の編集・Undo・Redoで本文を保ち、他のブロックやCRLFを変更しない', () => {
  const text = '#  見出し\r\n\r\n日本語の本文です。\r\n\r\n> [!danger]- 注意\r\n> 保持する本文\r\n';
  const model = parseDocument(text);
  let state = EditorState.create({ doc: model.doc, plugins: [history()] });
  let paragraph;
  state.doc.forEach((node, pos) => { if (node.type.name === 'paragraph') paragraph = pos; });
  const dispatch = transaction => { state = state.apply(transaction); };
  dispatch(state.tr.insertText('追加😀', paragraph + 1));
  const changed = serializeDocument(state.doc, model.originals, model.eol);
  assert.match(changed, /^#  見出し\r\n\r\n追加😀日本語/);
  assert.ok(changed.endsWith('> [!danger]- 注意\r\n> 保持する本文\r\n'));
  assert.ok(undo(state, dispatch));
  assert.equal(serializeDocument(state.doc, model.originals, model.eol), text);
  assert.ok(redo(state, dispatch));
  assert.equal(serializeDocument(state.doc, model.originals, model.eol), changed);
});

test('コールアウト13種、折りたたみ、ネスト、複合ハイライトを保存して再読込できる', () => {
  const types = ['note', 'abstract', 'info', 'todo', 'example', 'tip', 'success', 'question', 'warning', 'failure', 'danger', 'bug', 'quote'];
  const source = types.map(type => `> [!${type}]- タイトル\n> 前に==***重要***==です。\n`).join('\n') + '\n> [!tip]+ 外側\n>\n> > [!danger]- 内側\n> > 本文\n';
  const first = parser.parse(source);
  const serialized = serializer.serialize(first);
  assert.ok(first.eq(parser.parse(serialized)));
  types.forEach(type => assert.ok(serialized.includes(`[!${type}]-`)));
  assert.ok(serialized.includes('==***重要***=='));
  assert.ok(serialized.includes('> > [!danger]- 内側'));
});

test('表の揃えとパイプ文字、番号付きタスクを編集後も保持する', () => {
  const source = '| 左 | 中央 | 右 |\n| :--- | :---: | ---: |\n| a \\| b | c | d |\n\n1. [ ] 未完了\n2. [x] 完了\n';
  const model = parseDocument(source);
  let state = EditorState.create({ doc: model.doc });
  let task;
  state.doc.descendants((node, pos) => { if (node.type.name === 'list_item' && node.attrs.checked === false) task = pos; });
  state = state.apply(state.tr.setNodeMarkup(task, null, { checked: true }));
  const output = serializeDocument(state.doc, model.originals);
  assert.ok(output.startsWith(source.split('\n\n')[0]));
  assert.match(output, /1\. \[x\] 未完了\n2\. \[x\] 完了/);
  const tableSerialized = serializer.serialize(parser.parse(source));
  assert.ok(parser.parse(source).eq(parser.parse(tableSerialized)));
});

test('HTML・数式・Wikiリンクは実行や欠落を伴わず元記法で保存する', () => {
  const source = '---\ntitle: Example\n---\n\n本文 $E=mc^2$ と ![[note]]\n\n$$\nx^2\n$$\n\n<div onclick="alert(1)">HTML</div>\n';
  const model = parseDocument(source);
  assert.equal(serializeDocument(model.doc, model.originals), source);
  const serialized = serializer.serialize(model.doc);
  assert.ok(serialized.includes('$E=mc^2$'));
  assert.ok(serialized.includes('![[note]]'));
  assert.ok(serialized.includes('onclick="alert(1)"'));
  assert.ok(model.doc.eq(parser.parse(serialized)));
});

test('最小編集は絵文字・日本語・改行を壊さず、挿入・削除・置換を適用する', () => {
  for (const [before, after] of [['abc', 'abdc'], ['😀日本語', '😁日本語'], ['前😀後', '前後'], ['a\r\nb', 'a\r\n追加b'], ['', '本文'], ['本文', ''], ['same', 'same']]) {
    const edit = minimalEdit(before, after);
    assert.equal(before.slice(0, edit.from) + edit.text + before.slice(edit.to), after);
  }
});
