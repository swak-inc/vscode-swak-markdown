const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHost } = require('./helpers/host.cjs');

test('編集の応答と保存通知を分離し、保存だけでUndo用の文書を再読込しない', async () => {
  const host = await createHost();
  await host.message({ type: 'ready' });
  await host.message({ type: 'edit', text: '更新した本文😀', version: 1 });
  await host.message({ type: 'action', action: 'save' });
  assert.equal(host.document.text, '更新した本文😀');
  assert.deepEqual(host.sent.map(item => item.type), ['document', 'ack', 'saved']);
  assert.equal(host.sent[1].version, 2);
  assert.equal(host.document.isDirty, false);
});

test('外部変更と古い編集が競合しても上書きせず、最新の編集内容を別タブに保持する', async () => {
  const host = await createHost();
  host.document.text = '外部の編集'; host.document.version++;
  host.change({ document: host.document, contentChanges: [{}] });
  await host.message({ type: 'edit', text: '古い送信内容', version: 1 });
  assert.equal(host.document.text, '外部の編集');
  assert.deepEqual(host.sent.map(item => item.type), ['document', 'conflict']);
  await host.message({ type: 'recover', text: '送信後も入力していた最新の本文' });
  assert.equal(host.recovered[0].content, '送信後も入力していた最新の本文');
});

test('反映失敗を報告し、閲覧切替は既存タブを使い、ソースだけ通常のエディターで開く', async () => {
  const host = await createHost();
  host.vscode.workspace.applyEdit = async () => false;
  await host.message({ type: 'edit', text: '更新した本文', version: 1 });
  assert.equal(host.sent[0].type, 'error');
  assert.equal(host.document.text, '元の本文');
  await host.commands.get('swak.openPreview')();
  assert.deepEqual(host.sent.at(-1), { type: 'switch', mode: 'preview' });
  assert.equal(host.opened.length, 0);
  await host.message({ type: 'action', action: 'source' });
  assert.equal(host.opened[0][2], 'default');
});
