# カイトのスキル

## 闘争本能

同じ敵への攻撃で、熟練度獲得が1→2→3→4（以降4）。ガードも攻撃回数に含む。対象変更・明示的な逃走・区域移動・死亡でリセットし、1回攻撃後の通常探索復帰では維持。ドローンは種類だけでなく出現世代も区別。装備変更ではリセットせず、その攻撃で実際に使用した武器種へ加算。ボーナスは試合記録に集計。

## ステップブレイク

専用ボタンで通常攻撃と同時に使用。CT60秒。攻撃した生存対象へ（ガードでも発動）5秒間、行動間隔+500ms。通常攻撃のダメージ・ガード判定を使い、ガードでもCTを消費。実行前に対象が移動・死亡した場合は攻撃・CTとも消費しない。技能が付与された有効な攻撃のみCT開始。

COMの既存次回行動を500ms遅延し、効果中の各行動間隔を1000→1500msに変更。ドローンは減速中の反撃を500ms遅延。反撃は共有時系列で処理し、世代違い・対象の区域移動・死亡・試合終了時は古い反撃を適用しない。通常のドローン反撃は従来どおり。

## 共通基盤とUI

CHARACTER_SKILLSでキャラクター別定義。カイトだけ登録。専用パネルにパッシブスタック・次の獲得値・アクティブCTを表示。敵側に減速残り時間。参加者の自動反撃は追加しない。

kaito-skills.test.cjsでスタック・対象リセット・世代区別・武器種別加算・命中／外れ／キャンセル／CT・UI・実際のCOM行動間隔・ドローン遅延反撃と無効化・バックグラウンド時系列一致を検証。従来のダメージ比較と熟練度ペース比較は、同じランクまたはキャラボーナスなしの基準で検証する。

## Compact skill icons
The log ends at 62% of screen width; the skill dock occupies 63.5–75%, outside the right controls (76.5% onward). Inline SVG beast eyes show the passive stack badge (0/3 to 3/3). The foot-impact SVG is the active button, with a cooldown badge and accessible name. Icons stay mounted during refresh; only badges and button state change.
