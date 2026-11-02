# ラズ実装ドラフト（未公開）

ブランチ: `feature/raz-corpse-tracking-draft`。公開版 `main` には未反映。

## コード追加済み
- キャラクター `raz` （斬りD／鈍器D、各14熟練ポイント）
- 屍肉漁り: 初回のプレイヤー死体発見でスタック、攻撃+3%/スタック、クリティカル率+1ポイント/スタック。同一死亡者の重複なし。COMの撃破時は確認済みとしてカウント
- 死臭追跡: CT60秒、使用時点で生存する対象死体IDを記録。プレイヤー・bird・fish・dog・dragonのみ。種類と数は表示せず区域にマークを表示。該当死体を優先発見し、発見率100%。COMも探知区域を移動候補として評価
- ドラゴン型ドローン死体: 時間による消滅を廃止し、区域封鎖で利用不可

## 未完了・リリース禁止条件
- 採用したラズの立ち絵とスキルアイコン2枚の実ファイルは未登録。コードは次の未存在パスを参照:
  - `assets/characters/raz.webp`
  - `assets/inline-art/skills/characters/carrion_scavenger.webp`
  - `assets/inline-art/skills/characters/scent_tracking.webp`
  別の絵で代用せず、今回のチャットで採用した最終画像・2アイコンを利用すること。
- 実プレイ、Nodeテストスイート、コンテンツバリデーションは未実施。JavaScriptの構文解析は通過。
- 既存COMが複数の死体を発見した場合、回収の優先順位と新パッシブの扱いを実地テスト。
- UI・マップが待機所や封鎖境界でも正しく動作するか検証。
- 画像登録後、`node tools/validate-content.cjs` と `node tests/skill-registry.test.cjs` 等を実行し、回帰テストが通ってからPRを作成すること。

現時点の変更を `main` にマージしないでください。
