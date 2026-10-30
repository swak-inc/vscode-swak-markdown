import MarkdownIt from 'markdown-it';
import katexPlugin from '@vscode/markdown-it-katex';
import highlight from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import { configureMarkdown } from './markdown.cjs';

const markdown = configureMarkdown(new MarkdownIt({
  html: true,
  highlight(code, language) {
    return language && highlight.getLanguage(language)
      ? highlight.highlight(code, { language, ignoreIllegals: true }).value
      : '';
  }
})).use(katexPlugin.default || katexPlugin, { throwOnError: false, trust: false });

export const renderPreview = text => DOMPurify.sanitize(markdown.render(text));
