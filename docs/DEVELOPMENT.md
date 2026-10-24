# 開発

## 構成

- shared.js: 動画URLの整形、解像度の一覧と選択肢の判定。
- tooltip.js: ツールチップの表示と非表示。
- youtube.js: 共有ボタンの検出、アイコンの配置、y2downへの遷移。
- youtube.css: アイコンとツールチップの外観。
- y2down.js: 設定の取得、URL入力、解像度選択、クリック前の確認。
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

content scriptはmanifest.jsonに書かれた順番でテストする。ファイルを追加・分離した場合も、テスト側へ一覧を重複して書く必要はない。

## 配布物

Windows PowerShellでtools/package.ps1を実行すると、manifest.jsonから配布ファイルを集めてpackages内へZIPを作る。

BrowserPath引数にChromium系ブラウザの実行ファイルを指定するとCRXも生成する。SigningKey引数には既存のpemを指定できる。鍵の指定を省くと新しい鍵を作るため、同じ拡張IDで更新する場合は前の鍵を指定する。

配布ファイルはmanifest.jsonと、content_scriptsに指定したJavaScript・CSS、設定画面のHTML・CSS・JavaScript、manifestに指定したアイコン、LICENSE。テスト、作業計画、生成画像、署名用の秘密鍵は配布物に含めない。

packages内のCRX・秘密鍵と、生成したZIPはGitの対象外。公開前にステージされたファイルを確認する。
