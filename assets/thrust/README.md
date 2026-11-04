# 刺突武器・針のグラフィック（2026-11-05）

既存アイテムの描画スタイルに合わせた背景透過の専用イラスト。各256px WebPを単体画像として共通アイテム描画へ登録し、所持品・発見・製作・装備・図鑑で使用する。既存の能力値・レシピ・素材配置は変更しない。

| ID | 表示名 | 画像 |
|---|---|---|
| needle | 針 | needle.webp |
| practice_spear | 練習用の槍 | practice_spear.webp |
| short_spear | 短槍 | short_spear.webp |
| bamboo_spear | 竹槍 | bamboo_spear.webp |
| black_spear | 黒槍 | black_spear.webp |
| athena_spear | アテナの槍 | athena_spear.webp |
| iron_spear | 鉄槍 | iron_spear.webp |
| machine_spear | 機械神の槍 | machine_spear.webp |
| gungnir | 神槍グングニル | gungnir.webp |
| japanese_spear | 和槍 | japanese_spear.webp |
| nihongo | 日本号 | nihongo.webp |
| warrior_spear | 武人の槍 | warrior_spear.webp |
| otegine | 御手杵 | otegine.webp |
| tonbokiri | 蜻蛉切 | tonbokiri.webp |
| rapier | レイピア | rapier.webp |
| silver_rapier | 白銀のレイピア | silver_rapier.webp |
| flamberge | フランベルジュ | flamberge.webp |
| dragon_checkmate | 竜剣チェックメイト | dragon_checkmate.webp |

画像生成は組み込み画像生成機能を使用。生成指示・元画像の識別名とハッシュ・配信画像のハッシュは `art-manifest.json` に記録。透過と明暗背景での輪郭、48pxへの縮小時の見え方を確認。

検証：`node --test tests/smoke.test.cjs tests/random-supplies.test.cjs tests/content-validation.test.cjs tests/encyclopedia.test.cjs`（47件合格）。18枚すべてのRGBAデコード・透明画素・共通描画へのURL反映を確認。変更前後の全アイテムの能力・効果・等級・レシピ・回復量も一致。
