function minimalEdit(before, after) {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  // UTF-16のサロゲートペアの途中で編集範囲を切らない。
  if (from && /[\uD800-\uDBFF]/.test(before[from - 1])) from--;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > from && newEnd > from && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  if (oldEnd < before.length && /[\uDC00-\uDFFF]/.test(before[oldEnd])) { oldEnd++; newEnd++; }
  return { from, to: oldEnd, text: after.slice(from, newEnd) };
}
module.exports = { minimalEdit };
