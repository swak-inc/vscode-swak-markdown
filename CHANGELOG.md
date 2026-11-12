# Changelog / 変更履歴

## 1.1.6

- Separate consecutive tables with paragraph spacing, and use the compact H3 spacing after H4 headings, matching the Swak Obsidian theme 1.1.5. / 表が続く箇所に段落と同じ余白を入れ、H4直後もH3と同じコンパクトな余白にしました（Obsidianテーマ1.1.5と共通）。

## 1.1.5

- Restore compact spacing after H3 headings and add 6px before H2 headings in live, reading, and built-in previews, matching the Swak Obsidian theme. / ライブ・閲覧・標準プレビューでH3直後をコンパクトに戻し、H2の前を6px広げてObsidianテーマと揃えました。

## 1.1.4

- Share more comfortable body, paragraph, list, heading, table, callout, and property spacing with the Swak Obsidian theme. / 本文・段落・リスト・見出し・表・コールアウト・プロパティの余白を少し広げ、Obsidianテーマと共通化しました。
- Use normal spacing after H3 headings in live and reading views. / ライブ・閲覧表示でH3直後を通常の段落間隔へ戻しました。

## 1.1.3

- Save through the IDE's open-editor workflow and clear temporary in-tab notices when a delayed save confirmation arrives. Avoid leaving a false error notification after a successful save. / IDEの標準保存処理を使い、遅れて保存完了が通知された場合もタブ内の案内を解除します。保存成功後に誤ったエラー通知が残る問題を修正しました。
- Keep later edits marked as unsaved when an earlier save completes, and preserve editing and retry after unsuccessful saves. / 前の保存が完了しても、その後の追記は未保存として保持します。保存できなかった場合も編集と再保存を続けられます。

## 1.1.2

- Keep live preview editable after saving by checking save notifications and remaining unsaved changes, including repeated saves. / 保存通知と未保存状態を確認し、保存済みの再保存でもライブプレビューが編集不能にならないよう修正しました。
- Keep disk-save failures in the current tab so editing, undo, and retry remain available; recover separate copies only for synchronization failures or conflicting edits. / ディスク保存に失敗しても同じタブで編集・Undo・再保存できるようにし、別タブへの退避は同期失敗や編集競合時に限定しました。

## 1.1.1

- Match heading spacing after callouts to paragraphs and tables in live, reading, and built-in previews, while keeping the opening H1 and adjacent headings compact. / ライブ・閲覧・標準プレビューでコールアウト後の見出し余白を本文・テーブル後と統一し、冒頭のH1と見出しが連続する箇所はコンパクトに保ちます。

## 1.1.0

- Bring the shared Obsidian property card and chapter spacing into a documented release, including compact opening headings and 64px chapter gaps. / Obsidian共通のプロパティ表示と章の余白をまとめた更新です。冒頭の見出しはコンパクトに、章の区切りは64pxに揃えています。
- Clarify that property values are edited in Source and their original YAML is preserved during body editing. / プロパティはソースから編集し、本文編集では元のYAMLを保持することを明記しました。
- Refresh light/dark screenshots with shared property and meeting samples, and document the Obsidian PDF export workflow. / 共通のプロパティ・会議資料サンプルでライト／ダーク画像を更新し、ObsidianでのPDF出力手順を案内しました。

## 1.0.4

- Display YAML frontmatter as a readable property card in live, reading, and built-in previews, using the shared Obsidian design. / YAMLを項目名・値のプロパティ欄として表示し、ライブ・閲覧・標準プレビューをObsidianと同じデザインに揃えました。
- Preserve original YAML formatting and comments when editing the body; edit properties in Source. / 本文編集時もYAMLの書式とコメントを保持します。プロパティの変更はソースから行えます。

## 1.0.3

- Keep the first H1 compact even after YAML frontmatter or introductory content; retain the chapter gap for later H1 headings. / YAMLや前置きの後でも最初のH1は通常の余白にし、2つ目以降のH1だけ章の区切りとして間隔を広げます。

## 1.0.2

- Align heading sizes, heading-to-heading gaps, H3 body spacing, and callout layout with Obsidian; keep the opening agenda compact while retaining 64px chapter breaks. / 見出しサイズ・見出し同士とH3本文の間隔・コールアウトの配置をObsidianに揃え、冒頭アジェンダはコンパクトに、章の区切りは64pxに統一しました。
- Remove the empty title paragraph from callout bodies so lists start directly below the title in live preview. / コールアウトのタイトルに由来する空段落を取り除き、ライブプレビューでもタイトル直後に箇条書きを表示します。

## 1.0.1

- Match the Obsidian theme's 64px spacing before H1 chapters in the built-in preview, live editor, and reading view. / 標準プレビュー・ライブ編集・閲覧表示で、本文からH1へ移る上余白をObsidianテーマと同じ64pxに揃えました。

## 1.0.0

- First stable release of Swak Markdown, with editable live preview, reading view, a collapsible and resizable outline, and light/dark Swak styling. / ライブプレビュー編集・閲覧・開閉と幅調整に対応した目次・ライト／ダークのSwakスタイルを備えた初回正式版です。

## 0.3.8

- Separate English and Japanese README sections and add the Marketplace installation link. / READMEの説明をEnglish・日本語に分け、Marketplaceからの導入リンクを追加しました。
- Replace the extension icon with the official Swak stacked black logo. / 拡張アイコンを公式のSwak縦組み・黒ロゴに差し替えました。

## 0.3.7

- Disable HTML form submission in the custom editor and clarify external-image requests in the privacy description. / カスタムエディターでHTMLフォームの送信を禁止し、外部画像の通信について明記しました。
- Use GitHub Issues for support and GitHub private vulnerability reporting for security reports. / サポートはGitHub Issues、脆弱性の報告はGitHubの非公開窓口に統一しました。

## 0.3.6

- Move the extension to its own repository and pin shared theme assets for standalone builds. / 拡張を専用リポジトリへ分離し、共通テーマの版を固定して単体ビルドに対応しました。

- Delay outline divider hover highlighting by 300 ms; highlight immediately while dragging or using keyboard focus. / 目次の境界線はホバーから300ms後に強調し、ドラッグ・キーボード操作では即座に反応します。
- Prepare bilingual documentation, light/dark screenshots, and packaging metadata for public distribution. / 公開配布向けに英日併記の文書、ライト・ダークの画像、配布情報を整備しました。

## 0.3.0–0.3.5

- Add a hierarchical outline with current-position tracking, indentation guides, branch and global folding, and a resizable full-height divider. / 現在位置の追従、インデント線、個別・全体の開閉、画面下まで伸びる幅調整境界を持つ階層目次を追加しました。

## 0.2.0–0.2.1

- Add live editing, save/undo/redo, conflict recovery, and reading view in the same tab. Fix input handling caused by duplicate editor dependencies. / ライブ編集、保存・Undo・Redo、競合時の入力退避、同じタブでの閲覧切替を追加し、編集エンジンの重複読み込みによる入力不具合を修正しました。

## 0.1.0

- Bring Swak styling, callouts, and highlights to the built-in Markdown preview. / 標準MarkdownプレビューにSwakの配色・コールアウト・ハイライトを追加しました。
