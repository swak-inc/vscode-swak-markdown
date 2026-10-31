const { test } = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { EditorState } = require('prosemirror-state');
const { frontmatter, propertyRows } = require('../src/frontmatter.cjs');
const { parseDocument, serializeDocument, parser, serializer } = require('../src/live-model.cjs');

test('YAMLの複数行・リスト・型付き値を表示し、本文編集でも元のコメントとCRLFを保持する', () => {
  const source = '---\r\n# 保持するコメント\r\nname: "example"\r\ndescription: |\r\n  1行目\r\n  2行目\r\ntags: [meeting, proposal]\r\ndone: false\r\ncount: 9007199254740993\r\nempty: null\r\n---\r\n\r\n# 見出し\r\n\r\n本文\r\n';
  const model = parseDocument(source);
  assert.equal(model.doc.firstChild.type.name, 'frontmatter');
  const rows = propertyRows(model.doc.firstChild.attrs.raw);
  assert.deepEqual(rows.slice(0, 2), [{ key: 'name', value: 'example' }, { key: 'description', value: '1行目\n2行目\n' }]);
  assert.equal(rows.find(row => row.key === 'count').value, '9007199254740993');
  assert.equal(rows.find(row => row.key === 'done').value, 'false');
  assert.equal(rows.find(row => row.key === 'empty').value, '—');
  assert.match(rows.find(row => row.key === 'tags').value, /meeting[\s\S]*proposal/);
  assert.equal(serializeDocument(model.doc, model.originals, model.eol), source);
  let state = EditorState.create({ doc: model.doc });
  let position;
  state.doc.forEach((node, pos) => { if (node.type.name === 'paragraph') position = pos; });
  state = state.apply(state.tr.insertText('追加', position + 1));
  const edited = serializeDocument(state.doc, model.originals, model.eol);
  assert.ok(edited.startsWith(source.slice(0, source.indexOf('# 見出し'))));
  assert.match(edited, /追加本文/);
  assert.ok(parser.parse(serializer.serialize(model.doc)).eq(model.doc));
});

test('プロパティ内のHTMLを文字として扱い、不正なYAMLも欠落させない', () => {
  const md = new MarkdownIt({ html: true }).use(frontmatter);
  const html = md.render('---\n"<img src=x onerror=alert(1)>": "<script>alert(1)</script>"\n---\n\n# 本文');
  assert.match(html, /class="metadata-container swak-properties code-line"/);
  assert.match(html, /data-line="0"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img|<script/);
  for (const yaml of ['name: [broken', 'name: first\nname: second', '- sequence', 'a: *missing', 'a: &loop [*loop, *loop]']) {
    const source = `---\n${yaml}\n---\n\n本文\n`;
    const model = parseDocument(source);
    assert.equal(serializeDocument(model.doc, model.originals), source);
    assert.match(md.render(source), /プロパティ/);
  }
  assert.match(md.render('---\nname: [broken\n---'), /swak-properties-source/);
});

test('本文の水平線・コード・引用をプロパティにせず、終端マーカーにも対応する', () => {
  const md = new MarkdownIt().use(frontmatter);
  for (const source of ['本文\n\n---\n\nname: text\n\n---', '```yaml\n---\nname: text\n---\n```', '> ---\n> name: text\n> ---']) {
    assert.doesNotMatch(md.render(source), /metadata-container/);
  }
  assert.match(md.render('---\nname: text\n...\n\n本文'), /metadata-container/);
  assert.doesNotMatch(md.render('---\nname: text'), /metadata-container/);
});
