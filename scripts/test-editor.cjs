const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const root = path.resolve(__dirname, '..');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'swak-extension-test-'));
  try {
    const workspace = path.join(directory, 'workspace');
    const userData = path.join(directory, 'user-data');
    await fs.mkdir(workspace);
    await fs.mkdir(path.join(userData, 'User'), { recursive: true });
    await fs.writeFile(path.join(userData, 'User/settings.json'), JSON.stringify({ 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoCheckUpdates': false, 'extensions.autoUpdate': false, 'workbench.startupEditor': 'none' }));
    const executable = process.env.SWAK_EDITOR_EXECUTABLE || (process.platform === 'darwin' ? '/Applications/Visual Studio Code.app/Contents/MacOS/Code' : 'code');
    const args = [workspace, '--new-window', '--user-data-dir=' + userData, '--extensions-dir=' + path.join(directory, 'extensions'), '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', '--extensionDevelopmentPath=' + root, '--extensionTestsPath=' + path.join(root, 'test/extension-host/index.cjs')];
    const environment = { ...process.env, SWAK_EDITOR_TEST_DIR: workspace };
    delete environment.ELECTRON_RUN_AS_NODE;
    await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { stdio: 'inherit', env: environment });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error('エディターテストの終了コード: ' + code)));
    });
    const result = JSON.parse(await fs.readFile(path.join(workspace, 'result.json'), 'utf8'));
    if (result.passed !== 4) throw new Error('エディターテストの完了記録がありません');
    console.log('[swak][editor-test] 🏁 検証完了 - ' + JSON.stringify(result));
  } finally { await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
}

main().catch(error => { console.error('[swak][editor-test] ❌ 検証失敗 -', error); process.exitCode = 1; });
