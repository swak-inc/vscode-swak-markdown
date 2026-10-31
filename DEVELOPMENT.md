# Development / 開発

## Build & Verify / ビルド・検証

Run from this directory with Node.js 20 or later. / Node.js 20以上で、このディレクトリから実行します。

```sh
npm ci --ignore-scripts
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:editor
npm run package
```

Install the resulting VSIX locally. / 生成したVSIXをローカルにインストールします。

```sh
antigravity-ide --install-extension dist/swak-markdown-preview.vsix
# VS Code
code --install-extension dist/swak-markdown-preview.vsix
```

Reload the editor window after updating. / 更新後はエディターのウィンドウを再読み込みします。

`test:editor` launches the installed VS Code in a temporary profile and workspace, tests activation, editor commands, tab reuse, and document saving, then removes its temporary files. On macOS it uses `/Applications/Visual Studio Code.app`; set `SWAK_EDITOR_EXECUTABLE` to use another executable. Browser tests separately verify actual webview typing and rendering.

`test:editor` は、一時プロファイルとワークスペースでインストール済みVS Codeを起動し、有効化・編集コマンド・タブ再利用・保存を検証して一時ファイルを片付けます。macOSでは `/Applications/Visual Studio Code.app` を使い、別の実行ファイルは `SWAK_EDITOR_EXECUTABLE` で指定できます。Webview内の実打鍵・描画は別途ブラウザテストで検証します。

## Shared Styling / 共通スタイル

The canonical colors and callout icons live in the [Swak Obsidian theme](https://github.com/swak-inc/obsidian-theme-swak). This repository includes a fixed [snapshot](vendor/swak-theme/theme.css) with its source revision and file hashes in [source.json](vendor/swak-theme/source.json). Builds verify that snapshot and require no sibling checkout or network access for theme assets. [`media/preview.css`](media/preview.css) supplies base preview layout; [`media/live.css`](media/live.css) handles the editor layout.

配色とコールアウトアイコンの正本は [SwakのObsidianテーマ](https://github.com/swak-inc/obsidian-theme-swak) です。このリポジトリには固定した[コピー](vendor/swak-theme/theme.css)を収録し、元のコミットとファイルのハッシュを [source.json](vendor/swak-theme/source.json) に記録します。ビルド時に一致を検証するため、隣のcloneやテーマ取得のための通信は不要です。[`media/preview.css`](media/preview.css) がプレビューの基礎レイアウト、[`media/live.css`](media/live.css) が編集画面の調整です。

Update the theme in its canonical repository, commit it, then import that revision. Do not edit the snapshot directly. The same command updates public sample documents used by tests and screenshots.

テーマは正本で修正・コミットした後、その版を取り込みます。コピーは直接編集しません。テスト・撮影に使う公開サンプルも同じコマンドで更新します。

```sh
npm run sync:theme -- ../obsidian-theme-swak HEAD
npm run build
npm test
npm run test:browser
npm run screenshots
```

The editor uses ProseMirror and the VS Code Custom Text Editor API. ProseMirror packages and `orderedmap` resolve to a single ESM entry to avoid mixing incompatible copies of their classes.

編集はProseMirrorとVS Code Custom Text Editor APIで実装しています。ProseMirror各パッケージと `orderedmap` のESMエントリーを統一し、別々のクラスが混在する問題を避けています。

Browser tests load the built assets and provider-generated HTML with an isolated host bridge. They cover typing, Japanese IME, tables, saves, undo/redo, view switching, outline navigation, folding, and resizing.

ブラウザテストは、ビルド済みファイルと本体が生成したHTMLを独立したホスト接続で検証します。打鍵、日本語IME、表、保存、Undo/Redo、表示切替、目次の移動・開閉・幅調整が対象です。

## Screenshots / スクリーンショット

```sh
npm run screenshots
```

The script renders the public sample Markdown using the actual webview assets in isolated Chromium. Light/dark classes and editor color variables reproduce the IDE host inputs. Images capture the content pane, without simulated IDE chrome. The extension icon uses the official `swak-logo_icon-stacked_black.png` brand asset unchanged, stored as `media/marketplace/icon.png`. Marketplace requires a raster icon rather than SVG.

公開サンプルのMarkdownを拡張本体のWebview資材で独立したChromiumに描画します。ライト・ダークのクラスと色変数でIDEからの入力を再現し、IDEの外枠を合成せず本文ペインを撮影します。拡張アイコンは公式ブランド素材 `swak-logo_icon-stacked_black.png` を加工せず、`media/marketplace/icon.png` として収録しています。MarketplaceのアイコンはSVGに対応しないため、PNG版を使用します。

## Packaging / 配布物

The extension is packaged from this repository's root. Its repository metadata resolves README and image links to `swak-inc/vscode-swak-markdown`. Push reviewed changes before uploading the VSIX to Marketplace so those URLs resolve.

このリポジトリのルートから拡張をパッケージ化します。READMEと画像のリンクは、リポジトリ情報に基づいて `swak-inc/vscode-swak-markdown` を参照します。MarketplaceへVSIXをアップロードする前に、確認済みの変更をGitHubへ反映します。

Generated bundles and VSIX files are ignored by Git. Source, tests, maintenance scripts, and the upstream snapshot are excluded from the VSIX. Compiled theme styles and required license notices remain in the distribution.

生成したバンドル・VSIXはGit追跡対象外です。ソース・テスト・保守スクリプト・元テーマのコピーはVSIXへ含めず、変換済みスタイルと必要なライセンス表記を配布物に同梱します。
