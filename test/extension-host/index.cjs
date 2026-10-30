const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

async function waitFor(check) {
  const deadline = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('エディター状態の更新がタイムアウトしました');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

exports.run = async () => {
  assert.ok(process.env.SWAK_EDITOR_TEST_DIR, '独立した検証用ワークスペースが必要です');
  const source = '# Verification / 検証\n\n本文です。\n\n> [!tip] Recommendation\n> Keep this text.\n';
  const file = path.join(process.env.SWAK_EDITOR_TEST_DIR, 'sample.md');
  const uri = vscode.Uri.file(file);
  await fs.writeFile(file, source);
  const extension = vscode.extensions.getExtension('swak-inc.swak-markdown-preview');
  assert.ok(extension);
  const api = await extension.activate();
  assert.equal(typeof api.extendMarkdownIt, 'function');
  console.log('[swak][editor-test] ✅ 拡張を有効化 - VS Code [' + vscode.version + ']');
  const settings = vscode.workspace.getConfiguration('workbench').get('editorAssociations');
  const document = await vscode.workspace.openTextDocument(uri);
  const customTabs = () => vscode.window.tabGroups.all.flatMap(group => group.tabs).filter(tab => tab.input instanceof vscode.TabInputCustom && tab.input.viewType === 'swak.markdown.live');
  await vscode.commands.executeCommand('swak.openLive', uri);
  await waitFor(() => customTabs().length === 1);
  assert.equal(customTabs()[0].input.uri.toString(), uri.toString());
  assert.equal(document.getText(), source);
  assert.equal(document.isDirty, false);
  console.log('[swak][editor-test] ✅ Markdownを変更せずカスタムエディターを開く');
  await vscode.commands.executeCommand('swak.openPreview', uri);
  await vscode.commands.executeCommand('swak.openLive', uri);
  assert.equal(customTabs().length, 1);
  assert.equal(document.getText(), source);
  console.log('[swak][editor-test] ✅ 閲覧とライブ編集のコマンドが同じタブを使う');
  const edit = new vscode.WorkspaceEdit();
  edit.insert(uri, document.positionAt(source.length), '\n追加の本文。\n');
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  assert.equal(await document.save(), true);
  assert.equal(await fs.readFile(file, 'utf8'), source + '\n追加の本文。\n');
  await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
  await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === uri.toString());
  assert.deepEqual(vscode.workspace.getConfiguration('workbench').get('editorAssociations'), settings);
  console.log('[swak][editor-test] ✅ 文書の保存と標準エディターへの切替・既定設定の維持');
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await fs.writeFile(path.join(process.env.SWAK_EDITOR_TEST_DIR, 'result.json'), JSON.stringify({ editor: vscode.version, passed: 4 }));
};
