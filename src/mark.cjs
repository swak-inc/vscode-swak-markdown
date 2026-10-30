// markdown-it-mark (MIT) のトークン化を、日本語に隣接する複合装飾へ対応させる。
// 後処理は同プラグインを利用し、コード・エスケープ・強調との入れ子を維持する。
const mark = require('markdown-it-mark');

module.exports = (md) => {
  md.use(mark);
  md.inline.ruler.at('mark', (state, silent) => {
    if (silent || state.src[state.pos] !== '=') return false;
    const start = state.pos;
    const { length } = state.scanDelims(start, true);
    if (length < 2) return false;
    const canOpen = start + length < state.posMax && !/\s/u.test(state.src[start + length]);
    const canClose = start > 0 && !/\s/u.test(state.src[start - 1]);
    if (length % 2) state.push('text', '', 0).content = '=';
    for (let offset = length % 2; offset < length; offset += 2) {
      state.push('text', '', 0).content = '==';
      state.delimiters.push({
        marker: 0x3d,
        length: 0,
        jump: Math.floor(offset / 2),
        token: state.tokens.length - 1,
        end: -1,
        open: canOpen,
        close: canClose
      });
    }
    state.pos += length;
    return true;
  });
};
