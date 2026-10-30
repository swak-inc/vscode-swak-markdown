const { configureMarkdown } = require('./markdown.cjs');

exports.activate = context => {
  if (context) require('./live-provider.cjs').registerLiveEditor(context, require('vscode'));
  return { extendMarkdownIt: configureMarkdown };
};
