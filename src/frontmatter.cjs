const YAML = require('yaml');

// 表示だけを構造化し、保存時はコメント・引用符・並び順を含め元のYAMLを使う。
function propertyRows(raw) {
  try {
    const document = YAML.parseDocument(raw.split('\n').slice(1, -1).join('\n'), {
      stringKeys: true, intAsBigInt: true
    });
    if (document.errors.length || document.warnings.length) return null;
    const values = document.toJS({ mapAsMap: true, maxAliasCount: 100 });
    if (values === null) return [];
    if (!(values instanceof Map)) return null;
    return [...values].map(([key, value]) => ({
      key: String(key),
      value: value === null ? '—' : typeof value === 'object'
        ? YAML.stringify(value, { lineWidth: 0 }).trimEnd() : String(value)
    }));
  } catch {
    return null;
  }
}

function propertiesDOM(raw, line) {
  const rows = propertyRows(raw);
  const attrs = { class: 'metadata-container swak-properties', role: 'region', 'aria-label': 'プロパティ', title: 'ソース表示から編集できます' };
  if (Number.isInteger(line)) {
    attrs.class += ' code-line';
    attrs['data-line'] = String(line);
  }
  return ['section', attrs,
    ['div', { class: 'metadata-properties-heading' }, ['span', { class: 'metadata-properties-title' }, 'プロパティ']],
    rows === null
      ? ['pre', { class: 'swak-properties-source' }, ['code', {}, raw]]
      : ['div', { class: 'metadata-properties' }, ...rows.map(({ key, value }) =>
        ['div', { class: 'metadata-property' },
          ['div', { class: 'metadata-property-key' },
            ['span', { class: 'metadata-property-icon', 'aria-hidden': 'true' },
              ['http://www.w3.org/2000/svg svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
                ['http://www.w3.org/2000/svg path', { d: 'M4 5h16M4 12h16M4 19h10' }]]],
            ['span', { class: 'metadata-property-key-input' }, key]],
          ['div', { class: 'metadata-property-value' }, ['div', { class: 'metadata-input-longtext' }, value]]])]
  ];
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function renderDOM(spec) {
  if (typeof spec === 'string') return escapeHtml(spec);
  const [name, attrs, ...children] = spec;
  const tag = name.split(' ').pop();
  return `<${tag}${Object.entries(attrs).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('')}>${children.map(renderDOM).join('')}</${tag}>`;
}

function frontmatter(md) {
  // VS Code標準のfront_matter（fenceの前）より先に扱い、全プレビューを同じ表示にする。
  md.block.ruler.before('code', 'swak-frontmatter', (state, start, end, silent) => {
    if (start !== 0 || state.bMarks[start] !== 0 || state.tShift[start] !== 0) return false;
    if (state.src.slice(0, state.eMarks[start]).trim() !== '---') return false;
    let last = start + 1;
    while (last < end && !/^(---|\.\.\.)\s*$/.test(state.src.slice(state.bMarks[last], state.eMarks[last]))) last++;
    if (last === end) return false;
    if (silent) return true;
    const token = state.push('swak_frontmatter', '', 0);
    token.block = true;
    token.map = [start, last + 1];
    token.content = state.src.slice(0, state.eMarks[last]);
    state.line = last + 1;
    return true;
  });
  md.renderer.rules.swak_frontmatter = (tokens, index) => renderDOM(propertiesDOM(tokens[index].content, tokens[index].map?.[0])) + '\n';
}

module.exports = { frontmatter, propertiesDOM, propertyRows };
