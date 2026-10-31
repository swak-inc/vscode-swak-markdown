const callouts = require('markdown-it-obsidian-callouts');

module.exports = function configureCallouts(md, options) {
  md.use(callouts, options);
  // タイトルだけだった段落は本文ではない。空のコールアウトには編集用の段落を残す。
  md.core.ruler.after('obsidian-callouts', 'swak-callout-body', state => {
    const tokens = state.tokens;
    for (let index = 0; index < tokens.length; index++) {
      if (tokens[index].type === 'callout_open'
        && tokens[index + 1]?.type === 'paragraph_open'
        && tokens[index + 2]?.type === 'inline' && !tokens[index + 2].content.trim()
        && tokens[index + 3]?.type === 'paragraph_close'
        && tokens[index + 4]?.type !== 'callout_close') {
        tokens.splice(index + 1, 3);
      }
    }
  });
};
