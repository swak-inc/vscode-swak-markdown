const { registerLiveEditor } = require('../../src/live-provider.cjs');

async function createHost(text = '元の本文') {
  const uri = path => ({ scheme: 'file', toString: () => path });
  const sent = [], recovered = [], opened = [];
  const commands = new Map();
  let change, save, receive, provider;
  const disposable = { dispose() {} };
  const document = {
    uri: uri('/test.md'), version: 1, isDirty: false, text,
    getText() { return this.text; }, positionAt(offset) { return offset; },
    async save() { this.isDirty = false; change({ document: this, contentChanges: [] }); save(this); return true; }
  };
  const vscode = {
    Uri: { joinPath: (base, ...parts) => uri(base + '/' + parts.join('/')) },
    ViewColumn: { Active: 1, Beside: 2 },
    Range: class { constructor(from, to) { this.from = from; this.to = to; } },
    WorkspaceEdit: class { replace(uri, range, text) { Object.assign(this, { uri, range, text }); } },
    workspace: {
      onDidChangeTextDocument(fn) { change = fn; return disposable; },
      onDidSaveTextDocument(fn) { save = fn; return disposable; },
      async applyEdit(edit) {
        document.text = document.text.slice(0, edit.range.from) + edit.text + document.text.slice(edit.range.to);
        document.version++; document.isDirty = true;
        change({ document, contentChanges: [edit] }); return true;
      },
      async openTextDocument(value) { recovered.push(value); return value; }
    },
    window: {
      tabGroups: { activeTabGroup: { activeTab: { input: { uri: document.uri } } } },
      registerCustomEditorProvider(type, value) { provider = value; return disposable; },
      showTextDocument: async () => {}, showWarningMessage() {}, showErrorMessage() {}
    },
    commands: { registerCommand(name, handler) { commands.set(name, handler); return disposable; }, executeCommand: async (...args) => opened.push(args) }
  };
  const panel = {
    webview: { cspSource: 'https://swak.test', asWebviewUri: value => uri('https://swak.test' + value), postMessage: async value => sent.push(value), onDidReceiveMessage(fn) { receive = fn; return disposable; } },
    reveal() {},
    onDidDispose() {}
  };
  registerLiveEditor({ extensionUri: uri('/extension'), subscriptions: [] }, vscode);
  await provider.resolveCustomTextEditor(document, panel);
  const message = async value => { receive(value); await new Promise(resolve => setImmediate(resolve)); };
  return { document, sent, recovered, opened, message, change, vscode, panel, commands };
}

module.exports = { createHost };
