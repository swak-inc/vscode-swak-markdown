import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { exampleSetup } from 'prosemirror-example-setup';
import { tableEditing, goToNextCell } from 'prosemirror-tables';
import { keymap } from 'prosemirror-keymap';
import { toggleMark, setBlockType } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { schema, parseDocument, serializeDocument } from './live-model.cjs';
import icons from '../dist/icons.json';
import { renderPreview } from './preview.js';
import { createOutline } from './outline.js';

const api = acquireVsCodeApi();
const status = document.getElementById('status');
const notice = document.getElementById('notice');
let view, model, version, baseText = '', currentText = '', sentText = null, nextAction = null, blocked = false, recovered = false;
let mode = 'live';
const editorElement = document.getElementById('editor');
const previewElement = document.getElementById('preview');
const outline = createOutline({
  getRoot: () => mode === 'live' ? view?.dom : previewElement,
  onNavigate(heading) {
    if (mode !== 'live' || !view) return;
    const position = view.posAtDOM(heading, 0);
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position))));
    view.focus();
  }
});

function switchMode(next) {
  mode = next;
  editorElement.hidden = mode !== 'live';
  previewElement.hidden = mode !== 'preview';
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('selected', button.dataset.mode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  document.querySelectorAll('[data-command]').forEach(button => { button.hidden = mode !== 'live'; });
  if (mode === 'preview') previewElement.innerHTML = renderPreview(currentText);
  else view?.focus();
  outline.refresh();
}

function sendPending() {
  if (blocked || sentText !== null || !view || view.composing) return;
  if (currentText !== baseText) {
    sentText = currentText;
    api.postMessage({ type: 'edit', text: sentText, version });
  } else if (nextAction) {
    api.postMessage({ type: 'action', action: nextAction });
    nextAction = null;
  }
}
function action(name) {
  if (['live', 'preview'].includes(name)) return switchMode(name);
  if (blocked && name === 'source') return api.postMessage({ type: 'action', action: name });
  nextAction = name; sendPending();
}
function fail(message) {
  blocked = true;
  notice.textContent = message;
  notice.hidden = false;
  view?.setProps({ editable: () => false });
}
function recover() {
  if (recovered || !view) return;
  recovered = true;
  api.postMessage({ type: 'recover', text: currentText });
}

function calloutView(node, editor, getPos) {
  let currentNode = node;
  const dom = document.createElement('div');
  dom.className = 'callout';
  const title = dom.appendChild(document.createElement('div'));
  title.className = 'callout-title';
  title.contentEditable = 'false';
  const icon = title.appendChild(document.createElement('span'));
  icon.className = 'callout-title-icon';
  const input = title.appendChild(document.createElement('input'));
  input.className = 'callout-title-inner';
  input.setAttribute('aria-label', 'コールアウトのタイトル');
  const fold = title.appendChild(document.createElement('button'));
  fold.className = 'swak-fold';
  fold.setAttribute('aria-label', 'コールアウトを開閉');
  const contentDOM = dom.appendChild(document.createElement('div'));
  contentDOM.className = 'callout-content';
  let collapsed = node.attrs.fold === '-';
  function paint() {
    dom.dataset.callout = currentNode.attrs.kind;
    input.value = currentNode.attrs.title;
    input.placeholder = currentNode.attrs.kind;
    icon.innerHTML = icons[currentNode.attrs.kind] || icons.note || '';
    fold.hidden = !currentNode.attrs.fold;
    fold.textContent = collapsed ? '›' : '⌄';
    fold.setAttribute('aria-expanded', String(!collapsed));
    contentDOM.hidden = collapsed;
  }
  input.addEventListener('change', () => {
    const title = input.value.replace(/[\r\n]/g, ' ');
    editor.dispatch(editor.state.tr.setNodeMarkup(getPos(), null, { ...currentNode.attrs, title }));
  });
  fold.addEventListener('click', () => { collapsed = !collapsed; paint(); });
  paint();
  return {
    dom, contentDOM,
    update(next) { if (next.type !== currentNode.type) return false; currentNode = next; paint(); return true; },
    stopEvent: event => title.contains(event.target),
    ignoreMutation: mutation => title.contains(mutation.target) || mutation.type === 'attributes'
  };
}
function listItemView(node, editor, getPos) {
  let currentNode = node;
  const dom = document.createElement('li');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.className = 'task-list-item-checkbox'; checkbox.contentEditable = 'false';
  checkbox.setAttribute('aria-label', 'タスクの完了状態');
  dom.appendChild(checkbox);
  const contentDOM = dom.appendChild(document.createElement('div'));
  contentDOM.className = 'swak-list-content';
  function paint() { checkbox.hidden = currentNode.attrs.checked === null; checkbox.checked = !!currentNode.attrs.checked; dom.className = checkbox.hidden ? '' : 'task-list-item'; }
  checkbox.addEventListener('change', () => editor.dispatch(editor.state.tr.setNodeMarkup(getPos(), null, { ...currentNode.attrs, checked: checkbox.checked })));
  paint();
  return { dom, contentDOM, update(next) { if (next.type !== currentNode.type) return false; currentNode = next; paint(); return true; }, stopEvent: event => event.target === checkbox, ignoreMutation: mutation => mutation.target === checkbox || (mutation.target === dom && mutation.type === 'attributes') };
}
function createState(doc) {
  return EditorState.create({ doc, plugins: [
    keymap({ 'Mod-s': () => { action('save'); return true; }, Tab: goToNextCell(1), 'Shift-Tab': goToNextCell(-1) }),
    ...exampleSetup({ schema, menuBar: false }), tableEditing()
  ] });
}
function load(text, nextVersion, dirty) {
  model = parseDocument(text);
  version = nextVersion; baseText = currentText = text;
  if (view) view.updateState(createState(model.doc));
  else view = new EditorView(document.getElementById('editor'), {
    state: createState(model.doc),
    attributes: { class: 'markdown-body', 'aria-label': 'Swak ライブプレビュー', spellcheck: 'false' },
    nodeViews: { callout: calloutView, list_item: listItemView },
    dispatchTransaction(transaction) {
      view.updateState(view.state.apply(transaction));
      if (transaction.docChanged) {
        currentText = serializeDocument(view.state.doc, model.originals, model.eol);
        status.textContent = '未保存';
        sendPending();
        outline.refresh();
      }
    },
    handleDOMEvents: {
      compositionend: () => { queueMicrotask(sendPending); return false; },
      click: (_, event) => { if (event.target.closest('a')) event.preventDefault(); return false; }
    }
  });
  status.textContent = dirty ? '未保存' : '保存済み';
  if (mode === 'preview') previewElement.innerHTML = renderPreview(currentText);
  outline.refresh();
}
window.addEventListener('message', event => {
  const message = event.data;
  try {
    if (message?.type === 'document') {
      if (view && (sentText !== null || currentText !== baseText)) {
        recover();
        return fail('別の画面で更新されました。今回の編集内容を未保存の別タブへ退避しました。');
      }
      load(message.text, message.version, message.dirty);
    } else if (message?.type === 'ack') {
      if (sentText !== null) baseText = sentText;
      sentText = null; version = message.version;
      status.textContent = message.dirty ? '未保存' : '保存済み';
      sendPending();
    } else if (message?.type === 'saved') status.textContent = currentText === baseText ? '保存済み' : '未保存';
    else if (message?.type === 'switch') action(message.mode);
    else if (message?.type === 'conflict') { recover(); fail('競合した編集内容は別タブへ退避しました。元ファイルを開き直して確認してください。'); }
    else if (message?.type === 'error') { recover(); fail(message.message); }
  } catch (error) { fail(`読み込めない記法があります。ソース表示で確認してください。${error.message}`); }
});
const commands = {
  undo, redo,
  bold: toggleMark(schema.marks.strong), italic: toggleMark(schema.marks.em), highlight: toggleMark(schema.marks.highlight),
  h1: setBlockType(schema.nodes.heading, { level: 1 }), h2: setBlockType(schema.nodes.heading, { level: 2 }), h3: setBlockType(schema.nodes.heading, { level: 3 }), paragraph: setBlockType(schema.nodes.paragraph)
};
document.getElementById('toolbar').addEventListener('mousedown', event => { if (event.target.closest('[data-command]')) event.preventDefault(); });
document.getElementById('toolbar').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.mode) switchMode(button.dataset.mode);
  if (button?.dataset.action) action(button.dataset.action);
  if (button?.dataset.command && view) { commands[button.dataset.command]?.(view.state, view.dispatch, view); view.focus(); }
});
api.postMessage({ type: 'ready' });
