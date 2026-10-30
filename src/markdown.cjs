const callouts = require('markdown-it-obsidian-callouts');
const mark = require('./mark.cjs');
const taskLists = require('markdown-it-task-lists');
const icons = require('../dist/icons.json');


function configureMarkdown(md) {
  md.use(callouts, { icons }).use(mark).use(taskLists);

  // コールアウトの描画でも標準プレビューのソース行対応を維持する。
  const renderCallout = md.renderer.rules.callout_open;
  md.renderer.rules.callout_open = (tokens, index, ...args) => {
    const line = tokens[index].map?.[0];
    const html = renderCallout(tokens, index, ...args);
    return Number.isInteger(line)
      ? html.replace('class="callout"', `class="callout code-line" data-line="${line}"`)
      : html;
  };
  return md;
}
module.exports = { configureMarkdown };
