# 差し替え用キャラクター・背景画像

v1.1から、以下の画像をGitHubの指定位置に登録すると自動で表示されます。未登録の場合は従来の画像を使用します。

## カイト
- `assets/characters/kaito_stand.png` — 左下の標準立ち絵（背景透過PNGを推奨）

## 地域背景
- `assets/backgrounds/factory.png` — 廃工場
- `assets/backgrounds/lab.png` — 研究所
- `assets/backgrounds/storage.png` — 倉庫
- `assets/backgrounds/plaza.png` — 演習広場
- `assets/backgrounds/residence.png` — 居住区
- `assets/backgrounds/maintenance.png` — 整備場

背景の推奨比率は16:9、立ち絵は背景透過の縦長。マップ画像は画面全体にcover表示されます。

画像の割り当ては `index.html` の `stageArtRegistry` にまとまっています。今後マップやキャラが増えたらここに登録してください。

※ 表情差分・戦闘差分は未実装。現在は標準立ち絵1種類です。
