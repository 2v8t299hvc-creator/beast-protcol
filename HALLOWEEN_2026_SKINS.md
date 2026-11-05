# 2026 Halloween skins

Added to the existing skin selector: 満月の暴れ屋カイト, マッドドクタービヨルン, 夜天の吸血鬼ノクス. Each uses `halloween_2026` within its own character's skin list. Existing default and alternate skins remain selectable. Existing opponent skin selection automatically includes these skins with its unchanged rules. No calendar cutoff, purchase gate or unlock condition was requested, so none was added.

The approved source files were retrieved and inspected. Nox uses the final illustration with the small pumpkin-lantern bat familiar at the upper right, not the earlier version without it. Source filenames, identities, original hashes and optimized asset hashes are recorded in `assets/skins/halloween_2026_sources.json`.

Backgrounds were removed from the source art where necessary; Bjorn's existing alpha was retained. Source character pixels and composition were retained before resizing and WebP compression. A generated Kaito cutout trial changed the artwork and was discarded; it is not a game asset. Final assets use the approved source images themselves. Kaito/Bjorn are 768×1152, Nox is 768×1024; all include alpha.

Validation: basic/content/UI suites (67 results), each new skin selected through `selectCharacterSkin`, match start carries the selected skin, `actorArt` resolves its new file, and all character definitions excluding `skins` equal their pre-change values. Rendering was inspected against a dark background. Safari gameplay remains user-tested.

2026-11-04: カイトの輪郭に残った白い縁を除去し、明暗両背景で確認。修正版は別ファイル名で配信し、以前の画像キャッシュを回避。能力・バランスの変更なし。

輪郭修正：半透明の縁に残った白背景色を除去。外周3pxの範囲だけ近隣色を延長し、毛先・服・肌などの内部は維持。ラズは髪の隙間に残った白背景も清掃。明暗の背景と拡大表示で確認し、別ファイル名で配信して以前の画像キャッシュを回避。
