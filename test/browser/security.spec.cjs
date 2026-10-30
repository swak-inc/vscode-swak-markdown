const { test, expect } = require('@playwright/test');
const { setup } = require('../helpers/browser.cjs');

for (const method of ['get', 'post']) {
  test(`閲覧内のHTMLフォームを押しても${method.toUpperCase()}送信・画面遷移・文書変更をしない`, async ({ page }) => {
    const source = `<form action="https://audit.invalid/report" method="${method}"><input name="sample" value="audit-only"><button type="submit">送信テスト</button></form>\n`;
    const requests = [];
    page.on('request', request => {
      if (new URL(request.url()).hostname === 'audit.invalid') requests.push(request.url());
    });
    const { host, errors } = await setup(page, source);
    expect(host.panel.webview.options.enableForms).toBe(false);
    await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
    // CSPで中止した遷移後のevaluate待機を避け、ブラウザ自身の拒否を確認する。
    await Promise.all([
      page.waitForEvent('console', { predicate: message => message.text().includes("form-action 'none'"), timeout: 5000 }),
      page.getByRole('button', { name: '送信テスト', exact: true }).click({ noWaitAfter: true })
    ]);
    expect(page.url()).toBe('https://swak.test/editor');
    expect(requests).toEqual([]);
    expect(host.document.text).toBe(source);
    expect(host.document.isDirty).toBe(false);
    expect(errors).toEqual([]);
  });
}
