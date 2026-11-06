const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHost } = require('./helpers/host.cjs');

test('編集の応答と保存通知を分離し、保存だけでUndo用の文書を再読込しない', async () => {
  const host = await createHost();
  await host.message({ type: 'ready' });
  await host.message({ type: 'edit', text: '更新した本文😀', version: 1 });
  await host.message({ type: 'action', action: 'save' });
  assert.equal(host.document.text, '更新した本文😀');
  assert.equal(host.sent.filter(item => item.type === 'document').length, 1);
  assert.equal(host.sent.some(item => item.type === 'error'), false);
  assert.deepEqual(host.sent.at(-1), { type: 'saved', dirty: false });
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

test('保存済み文書の再保存では保存APIを呼ばず、保存状態を通知する', async () => {
  const host = await createHost();
  host.document.save = async () => { throw new Error('保存済み文書には不要な呼出し'); };
  await host.message({ type: 'action', action: 'save' });
  assert.deepEqual(host.sent, [{ type: 'saved', dirty: false }]);
});

test('保存通知後にAPIがfalseを返しても、実際に保存された状態を維持する', async () => {
  const host = await createHost();
  const save = host.document.save.bind(host.document);
  host.document.save = async () => { await save(); return false; };
  await host.message({ type: 'edit', text: '保存された本文', version: 1 });
  await host.message({ type: 'action', action: 'save' });
  assert.equal(host.document.isDirty, false);
  assert.deepEqual(host.sent.at(-1), { type: 'saved', dirty: false });
  assert.equal(host.sent.some(message => ['error', 'saveUnconfirmed'].includes(message.type)), false);
});

test('保存通知後に新しい変更が残っていれば、APIのfalseを致命的エラーにせず未保存を表示する', async () => {
  const host = await createHost();
  const save = host.document.save.bind(host.document);
  host.document.save = async () => { await save(); host.document.isDirty = true; return false; };
  await host.message({ type: 'edit', text: '編集を続ける本文', version: 1 });
  await host.message({ type: 'action', action: 'save' });
  assert.equal(host.sent.some(message => ['error', 'saveUnconfirmed'].includes(message.type)), false);
  assert.equal(host.document.isDirty, true);
  assert.deepEqual(host.sent.at(-1), { type: 'saved', dirty: true });
});

for (const failure of ['false', 'throw']) {
  test(`保存の${failure}は編集反映エラーと分け、未保存の本文を維持する`, async () => {
    const host = await createHost();
    host.document.save = async () => {
      if (failure === 'throw') throw new Error('保存先に書き込めません');
      return false;
    };
    await host.message({ type: 'edit', text: '維持する本文', version: 1 });
    await host.message({ type: 'action', action: 'save' });
    assert.equal(host.sent.at(-1).type, 'saveUnconfirmed');
    assert.equal(host.document.text, '維持する本文');
    assert.equal(host.document.isDirty, true);
    assert.equal(host.sent.some(message => message.type === 'error'), false);
    assert.deepEqual(host.errors, []);
  });
}

test('保存APIの応答より遅れて完了通知が届いても、撤回できないエラー通知を残さない', async () => {
  const host = await createHost();
  const completeSave = host.document.save.bind(host.document);
  host.document.save = async () => false;
  await host.message({ type: 'edit', text: '遅れて保存される本文', version: 1 });
  await host.message({ type: 'action', action: 'save' });
  assert.equal(host.sent.at(-1).type, 'saveUnconfirmed');
  assert.equal(host.document.isDirty, true);
  assert.deepEqual(host.errors, []);
  assert.deepEqual(host.saveRequests, [host.document.uri]);
  await completeSave();
  assert.deepEqual(host.sent.at(-1), { type: 'saved', dirty: false });
  assert.deepEqual(host.errors, []);
  assert.deepEqual(host.recovered, []);
});
