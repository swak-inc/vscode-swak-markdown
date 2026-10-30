const { expect } = require('@playwright/test');
const path = require('node:path');
const { createHost } = require('./host.cjs');

async function setup(page, text) {
  const host = await createHost(text);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://swak.test') return route.abort();
    if (url.pathname === '/editor') return route.fulfill({ contentType: 'text/html', body: host.panel.webview.html });
    if (!url.pathname.startsWith('/extension/')) return route.abort();
    const file = path.resolve(__dirname, '../..', url.pathname.slice('/extension/'.length));
    await route.fulfill({ path: file });
  });
  host.panel.webview.postMessage = message => page.evaluate(message => window.postMessage(message, '*'), message);
  await page.exposeFunction('postToHost', message => host.message(message));
  await page.addInitScript(() => { window.acquireVsCodeApi = () => ({ postMessage: window.postToHost }); });
  await page.goto('https://swak.test/editor');
  await expect(page.locator('.ProseMirror')).toBeVisible();
  return { host, errors };
}

module.exports = { setup };
