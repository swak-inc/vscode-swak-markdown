const crypto = require('node:crypto');
const { minimalEdit } = require('./text-edit.cjs');

function registerLiveEditor(context, vscode) {
  const viewType = 'swak.markdown.live';
  const panels = new Map();
  const initialModes = new Map();
  const activeUri = candidate => candidate?.scheme ? candidate : vscode.window.tabGroups.activeTabGroup.activeTab?.input?.uri || vscode.window.activeTextEditor?.document.uri;
  const open = async (uri, mode) => {
    if (!uri) return;
    const type = mode === 'source' ? 'default' : viewType;
    if (type === viewType) initialModes.set(uri.toString(), mode);
    await vscode.commands.executeCommand('vscode.openWith', uri, type, vscode.ViewColumn.Active);
  };
  const provider = {
    async resolveCustomTextEditor(document, panel) {
      const root = context.extensionUri;
      const directory = vscode.Uri.joinPath(document.uri, '..');
      panel.webview.options = { enableScripts: true, enableForms: false, localResourceRoots: [root, directory] };
      panels.set(document.uri.toString(), panel);
      let applying = false;
      let queue = Promise.resolve();
      const send = () => panel.webview.postMessage({ type: 'document', text: document.getText(), version: document.version, dirty: document.isDirty });
      const changes = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === document.uri.toString() && event.contentChanges.length && !applying) send();
      });
      const saves = vscode.workspace.onDidSaveTextDocument(saved => {
        if (saved.uri.toString() === document.uri.toString()) panel.webview.postMessage({ type: 'saved' });
      });
      const messages = panel.webview.onDidReceiveMessage(message => {
        queue = queue.then(async () => {
          if (message?.type === 'ready') {
            await send();
            const mode = initialModes.get(document.uri.toString());
            initialModes.delete(document.uri.toString());
            if (mode) await panel.webview.postMessage({ type: 'switch', mode });
            return;
          }
          if (message?.type === 'recover' && typeof message.text === 'string') {
            const recovery = await vscode.workspace.openTextDocument({ content: message.text, language: 'markdown' });
            await vscode.window.showTextDocument(recovery, vscode.ViewColumn.Beside);
            vscode.window.showWarningMessage('Swakの編集内容を未保存の別タブに退避しました。元ファイルと見比べて確認してください。');
            return;
          }
          if (message?.type === 'edit' && typeof message.text === 'string' && Number.isInteger(message.version)) {
            if (message.version !== document.version) {
              await panel.webview.postMessage({ type: 'conflict' });
              return;
            }
            const before = document.getText();
            if (before !== message.text) {
              const diff = minimalEdit(before, message.text);
              const edit = new vscode.WorkspaceEdit();
              edit.replace(document.uri, new vscode.Range(document.positionAt(diff.from), document.positionAt(diff.to)), diff.text);
              applying = true;
              try {
                if (!await vscode.workspace.applyEdit(edit)) throw new Error('編集内容を文書へ反映できませんでした。');
              } finally { applying = false; }
            }
            return panel.webview.postMessage({ type: 'ack', version: document.version, dirty: document.isDirty });
          }
          if (message?.type === 'action') {
            if (message.action === 'save' && !await document.save()) throw new Error('文書を保存できませんでした。編集内容は未保存のまま保持しています。');
            if (message.action === 'source') await open(document.uri, 'source');
          }
        }).catch(error => {
          panel.webview.postMessage({ type: 'error', message: error.message });
          vscode.window.showErrorMessage(`Swak: ${error.message}`);
        });
      });
      panel.onDidDispose(() => {
        changes.dispose(); saves.dispose(); messages.dispose();
        if (panels.get(document.uri.toString()) === panel) panels.delete(document.uri.toString());
      });
      const nonce = crypto.randomBytes(18).toString('base64');
      const uri = path => panel.webview.asWebviewUri(vscode.Uri.joinPath(root, path)).toString();
      const escape = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      panel.webview.html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action 'none'; img-src ${panel.webview.cspSource} https: data:; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${panel.webview.cspSource};">
        <base href="${escape(panel.webview.asWebviewUri(directory).toString())}/">
        <link rel="stylesheet" href="${uri('dist/live-vendor.css')}">
        <link rel="stylesheet" href="${uri('dist/katex/katex.min.css')}">
        <link rel="stylesheet" href="${uri('dist/theme.css')}">
        <link rel="stylesheet" href="${uri('media/preview.css')}">
        <link rel="stylesheet" href="${uri('media/live.css')}">
        </head><body class="vscode-body">
        <nav id="toolbar" aria-label="Swak Markdown"><div class="modes">
          <button data-mode="live" class="selected" aria-pressed="true">ライブプレビュー</button><button data-mode="preview" aria-pressed="false">プレビュー</button><button data-action="source">ソース</button><span class="toolbar-separator" aria-hidden="true"></span><button id="outline-toggle" aria-controls="outline" aria-expanded="true">目次</button>
        </div><div class="formatting">
          <button data-command="undo" title="元に戻す (⌘Z)">↶</button><button data-command="redo" title="やり直す (⇧⌘Z)">↷</button>
          <button data-command="bold" title="太字 (⌘B)"><b>B</b></button><button data-command="italic" title="斜体 (⌘I)"><i>I</i></button>
          <button data-command="highlight" title="ハイライト">マーカー</button>
          <button data-command="h1">H1</button><button data-command="h2">H2</button><button data-command="h3">H3</button>
          <button data-command="paragraph" title="本文">本文</button><button data-action="save" title="保存 (⌘S)">保存</button>
          <span id="status" role="status">読み込み中</span>
        </div></nav><div id="notice" role="alert" hidden></div>
        <div id="document-layout"><div id="document-content"><main id="editor"></main><main id="preview" class="markdown-body" hidden></main></div>
          <aside id="outline" aria-label="目次"><div id="outline-resize" role="separator" aria-orientation="vertical" aria-label="本文と目次の幅を調整" aria-controls="document-content outline" tabindex="0" title="ドラッグで幅を調整・ダブルクリックで初期幅に戻す"></div><div class="outline-header"><span>目次</span><div class="outline-actions">
            <button id="outline-expand-all" aria-label="目次をすべて展開" title="すべて展開" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5-5 5 5M7 15l5 5 5-5"/></svg></button>
            <button id="outline-collapse-all" aria-label="目次をすべて折りたたむ" title="すべて折りたたむ" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 5 5 5-5M7 20l5-5 5 5"/></svg></button>
            <button id="outline-close" aria-label="目次を閉じる" title="目次を閉じる">×</button>
          </div></div>
            <nav aria-label="見出し一覧"><ol id="outline-list"></ol><p id="outline-empty">見出しがありません</p></nav>
          </aside>
        </div>
        <script nonce="${nonce}" src="${uri('dist/live.js')}"></script></body></html>`;
    }
  };
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(viewType, provider, { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false }));
  for (const [command, mode] of [['swak.openLive', 'live'], ['swak.openPreview', 'preview']]) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async candidate => {
      const uri = activeUri(candidate);
      const panel = uri && panels.get(uri.toString());
      if (panel) { panel.reveal(vscode.ViewColumn.Active); return panel.webview.postMessage({ type: 'switch', mode }); }
      await open(uri, mode);
    }));
  }
}
module.exports = { registerLiveEditor };
