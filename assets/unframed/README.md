# 枠なしの水辺アイテム画像

元の `assets/icon_water_1.png`〜`icon_water_5.png`、`icon_water_gear_1.png`〜`icon_water_gear_3.png` に描き込まれていたカード背景と金属枠を除去した透過画像です。実際のゲームでは31種類がこれらのシートを参照します。4分割の位置とアイテムIDの対応は維持し、`ITEM_ART_SHEETS` の参照先だけを変更しています。

図鑑・探索・バッグ・製作・装備・死体などは、同じ `itemIconHTML` と画像レジストリを使うため、表示先ごとに別の絵は登録していません。元のPNGは参照用として残しています。

Built-in ImageGenで背景抽出を実施。プロンプトの共通要件：

> Edit the existing 2x2 item atlas. Remove only the dark square card backgrounds, metallic outer borders and cross-shaped separators. Keep each original object in its original quadrant with its colors, silhouette, materials and illustrated style. Keep food plates, bowls, garnish and steam as parts of the object. Deliver clean object cutouts on genuine alpha transparency with transparent spacing. No tiles, plaques, card outlines, text or new objects. For the unused blueprint quadrant, remove its surrounding HUD and grid and retain the armor drawing.

生成された透過PNGを表示確認後、ゲーム用WebPへ変換しています。図鑑の等級色のボタン枠とは別で、画像自体に四角い背景はありません。
