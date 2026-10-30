const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/browser',
  workers: 1,
  use: { browserName: 'chromium', headless: true },
  reporter: 'list'
});
