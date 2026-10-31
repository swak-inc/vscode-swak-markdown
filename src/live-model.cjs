const MarkdownIt = require('markdown-it');
const { Schema } = require('prosemirror-model');
const { schema: baseSchema, MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } = require('prosemirror-markdown');
const { tableNodes } = require('prosemirror-tables');
const callouts = require('./callouts.cjs');
const mark = require('./mark.cjs');

let nodes = baseSchema.spec.nodes.update('list_item', {
  ...baseSchema.spec.nodes.get('list_item'),
  attrs: { checked: { default: null } },
  toDOM: node => ['li', { class: node.attrs.checked === null ? '' : 'task-list-item' }, 0]
}).append(tableNodes({ tableGroup: 'block', cellContent: 'paragraph+', cellAttributes: {
  align: { default: null, getFromDOM: dom => dom.style.textAlign || null, setDOMAttr: (value, attrs) => { if (value) attrs.style = `text-align: ${value}`; } }
}})).append({
  callout: {
    group: 'block', content: 'block+', defining: true,
    attrs: { kind: { default: 'note' }, title: { default: '' }, fold: { default: '' } },
    toDOM: node => ['div', { class: 'callout', 'data-callout': node.attrs.kind }, ['div', { class: 'callout-content' }, 0]]
  },
  raw_block: {
    group: 'block', atom: true, attrs: { raw: {} },
    toDOM: node => ['pre', { class: 'swak-raw-block', title: 'ソース表示から編集できます' }, ['code', node.attrs.raw]]
  },
  raw_inline: {
    group: 'inline', inline: true, atom: true, attrs: { raw: {} },
    toDOM: node => ['code', { class: 'swak-raw-inline' }, node.attrs.raw]
  }
});
// markを最外側に置き、==***赤太字***==を維持する。
const marks = baseSchema.spec.marks.addToStart('highlight', {
  toDOM: () => ['mark', 0], parseDOM: [{ tag: 'mark' }]
}).append({ strike: { toDOM: () => ['s', 0], parseDOM: [{ tag: 's' }, { tag: 'del' }] } });
const schema = new Schema({ nodes, marks });
const md = new MarkdownIt({ html: true }).use(callouts).use(mark);

// YAML・数式・Obsidianリンクは、未対応の編集で内容を失わないよう元記法を保持する。
md.block.ruler.before('fence', 'swak-raw-block', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
  const yaml = start === 0 && line === '---';
  const math = line === '$$';
  if (!yaml && !math) return false;
  let last = start + 1;
  while (last < end && state.src.slice(state.bMarks[last], state.eMarks[last]).trim() !== line) last++;
  if (last === end) return false;
  if (silent) return true;
  const token = state.push('swak_raw_block', '', 0);
  token.map = [start, last + 1];
  token.content = state.src.slice(state.bMarks[start], state.eMarks[last]);
  state.line = last + 1;
  return true;
});
md.inline.ruler.before('emphasis', 'swak-raw-inline', (state, silent) => {
  const match = /^(?:!?\[\[[^\n]*?\]\]|\$[^$\n]+\$)/.exec(state.src.slice(state.pos));
  if (!match) return false;
  if (!silent) state.push('swak_raw_inline', '', 0).content = match[0];
  state.pos += match[0].length;
  return true;
});
md.core.ruler.before('inline', 'swak-live-structure', state => {
  const output = [];
  state.tokens.forEach((token, index) => {
    if (token.type === 'list_item_open') {
      const inline = state.tokens[index + 2];
      const match = inline?.type === 'inline' && /^\[([ xX])\]\s/.exec(inline.content);
      if (match) {
        token.attrSet('checked', match[1].toLowerCase() === 'x' ? 'true' : 'false');
        inline.content = inline.content.slice(match[0].length);
      }
    }
    if (token.type === 'th_close' || token.type === 'td_close') output.push(new state.Token('paragraph_close', 'p', -1));
    output.push(token);
    if (token.type === 'th_open' || token.type === 'td_open') output.push(new state.Token('paragraph_open', 'p', 1));
  });
  state.tokens = output;
});
const alignment = token => ({ align: /text-align:(left|center|right)/.exec(token.attrGet('style') || '')?.[1] || null });
const parser = new MarkdownParser(schema, md, {
  ...defaultMarkdownParser.tokens,
  list_item: { block: 'list_item', getAttrs: token => ({ checked: token.attrGet('checked') === null ? null : token.attrGet('checked') === 'true' }) },
  table: { block: 'table' }, thead: { ignore: true }, tbody: { ignore: true }, tr: { block: 'table_row' },
  th: { block: 'table_header', getAttrs: alignment }, td: { block: 'table_cell', getAttrs: alignment },
  callout: { block: 'callout', getAttrs: token => ({ kind: token.attrGet('data-callout') || 'note', title: token.attrGet('data-callout-title') || '', fold: token.attrGet('data-callout-fold') || '' }) },
  mark: { mark: 'highlight' }, s: { mark: 'strike' },
  html_block: { node: 'raw_block', getAttrs: token => ({ raw: token.content }) },
  html_inline: { node: 'raw_inline', getAttrs: token => ({ raw: token.content }) },
  swak_raw_block: { node: 'raw_block', getAttrs: token => ({ raw: token.content }) },
  swak_raw_inline: { node: 'raw_inline', getAttrs: token => ({ raw: token.content }) }
});
const serializer = new MarkdownSerializer({
  ...defaultMarkdownSerializer.nodes,
  bullet_list(state, node) { state.renderList(node, '  ', () => '- '); },
  list_item(state, node) {
    if (node.attrs.checked !== null) state.write(node.attrs.checked ? '[x] ' : '[ ] ');
    state.renderContent(node);
  },
  callout(state, node) {
    state.wrapBlock('> ', null, node, () => {
      state.write(`[!${node.attrs.kind}]${node.attrs.fold}${node.attrs.title ? ' ' + node.attrs.title : ''}\n`);
      state.renderContent(node);
    });
  },
  table(state, node) {
    const rows = [];
    node.forEach(row => {
      const cells = [];
      row.forEach(cell => {
        const text = serializer.serialize(schema.topNodeType.create(null, cell.content));
        cells.push(text.replace(/\n+/g, '<br>').replace(/(?<!\\)\|/g, '\\|'));
      });
      rows.push('| ' + cells.join(' | ') + ' |');
    });
    const align = [];
    node.firstChild.forEach(cell => align.push(cell.attrs.align === 'center' ? ':---:' : cell.attrs.align === 'right' ? '---:' : cell.attrs.align === 'left' ? ':---' : '---'));
    rows.splice(1, 0, '| ' + align.join(' | ') + ' |');
    rows.forEach(row => state.write(row + '\n'));
    state.closeBlock(node);
  },
  raw_block(state, node) { state.write(node.attrs.raw); state.closeBlock(node); },
  raw_inline(state, node) { state.write(node.attrs.raw); }
}, {
  ...defaultMarkdownSerializer.marks,
  highlight: { open: '==', close: '==', mixable: false, expelEnclosingWhitespace: true },
  strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true }
});

function parseDocument(source) {
  const text = source.replace(/\r\n/g, '\n');
  const doc = parser.parse(text);
  const top = md.parse(text, {}).filter(token => token.map && token.level === 0 && token.nesting >= 0 && token.type !== 'inline');
  const lines = text.split('\n');
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);
  const originals = { byNode: new WeakMap(), entries: [] };
  if (top.length === doc.childCount) doc.forEach((node, _, index) => {
    const start = index ? offsets[top[index].map[0]] : 0;
    const end = index + 1 < top.length ? offsets[top[index + 1].map[0]] : text.length;
    const raw = text.slice(start, end);
    originals.byNode.set(node, raw);
    originals.entries.push({ node, raw });
  });
  return { doc, originals, eol: source.includes('\r\n') ? '\r\n' : '\n' };
}
function serializeDocument(doc, originals, eol = '\n') {
  const chunks = [];
  doc.forEach((node, _, index) => {
    const original = originals.entries[index];
    const raw = originals.byNode.get(node) ?? (original?.node.eq(node) ? original.raw : undefined);
    if (chunks.length && !chunks[chunks.length - 1].endsWith('\n')) chunks.push('\n\n');
    chunks.push(raw ?? serializer.serialize(schema.topNodeType.create(null, node)).trimEnd() + '\n\n');
  });
  return chunks.join('').replace(/\n/g, eol);
}

module.exports = { schema, parser, serializer, parseDocument, serializeDocument };
