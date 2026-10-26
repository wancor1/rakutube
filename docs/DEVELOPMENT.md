# 開発

## 構成

- shared.js: 動画URLの整形、解像度の一覧と選択肢の判定。
- tooltip.js: ツールチップの表示と非表示。
- youtube.js: 共有ボタンの検出、アイコンの配置、動画の送信。
- background.js: y2downタブの再利用・作成、動画の受け渡し、保存用ページのバックグラウンド表示。
- youtube.css: アイコンとツールチップの外観。
- y2down.js: 動画追加の待ち行列、URL入力、解像度選択、完了結果の検出と保存先の送信。
- settings.html、settings.css、settings.js: 拡張機能アイコンから開く設定画面。
- icon.png: ユーザー作成の128pxアイコン。拡張機能一覧とツールバーで使用。
- tests/: テスト用ページと回帰テスト。

## テスト

Node.jsとnpmが必要。依存パッケージをインストールしてから実行する。

```sh
npm install
npx playwright install chromium
npm test
```

既存のPlaywrightとブラウザを使う場合は、それぞれのパスを指定できる。

```sh
node tests/run.cjs /absolute/path/to/playwright /absolute/path/to/browser
```

テスト用ページへの通信はHTMLに置き換える。実際のYouTubeやy2downにはアクセスしない。生成画像はtest-resultsに保存する。

設定のテストではchrome.storage.localをテスト用の保存先へ置き換える。全8解像度、保存・復元、保存失敗時の復帰、読み込み失敗、不正な保存値、指定した解像度が存在しない場合の停止を確認する。

handoff.cjsではタブ再利用、読み込み中の再送、動画追加の待ち行列、重複防止、完了順の自動クリック、設定の即時反映を確認する。

native-handoff.cjsは同じ引数で単独実行できる。分離プロファイルに拡張機能を読み込み、実際のメッセージAPIとストレージで確認する。外部通信は遮断し、ページはテストHTMLに置き換える。拡張機能が作るタブの最初の通信は差し替え前に始まる場合があるため、テスト側で同じタブをテストHTMLへ再遷移させる。追加の引数にEnhancerの展開フォルダを指定すると併用できる。

content scriptはmanifest.jsonに書かれた順番でテストする。ファイルを追加・分離した場合も、テスト側へ一覧を重複して書く必要はない。

## 配布物

Windows PowerShellでtools/package.ps1を実行すると、manifest.jsonから配布ファイルを集めてpackages内へZIPを作る。

BrowserPath引数にChromium系ブラウザの実行ファイルを指定するとCRXも生成する。SigningKey引数には既存のpemを指定できる。鍵の指定を省くと新しい鍵を作るため、同じ拡張IDで更新する場合は前の鍵を指定する。

配布ファイルはmanifest.jsonと、content_scriptsに指定したJavaScript・CSS、service worker、設定画面のHTML・CSS・JavaScript、manifestに指定したアイコン、LICENSE。テスト、作業計画、生成画像、署名用の秘密鍵は配布物に含めない。

packages内のCRX・秘密鍵と、生成したZIPはGitの対象外。公開前にステージされたファイルを確認する。
