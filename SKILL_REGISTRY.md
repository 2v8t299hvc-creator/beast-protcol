# キャラクタースキルの追加・変更

## 登録先

スキルは次の2か所で登録します。

- `CHARACTER_DEFS` 内の各キャラの `skills`：ID、名前、説明、画像、CTなどの情報。
- `SKILL_BEHAVIORS`：同じスキルIDに対応する効果・使用条件・表示・COM判断。

既存20種類（パッシブ8、フィールド4、アクティブ8）の動作を移行しました。キャラ名による分岐や、COM用の使用可能スキルIDのリストに追記する必要はありません。

キャラスキルと装備スキルは区別します。装備の効果設定とアイコンは `ITEM_DEFS` にあり、今回のレジストリはキャラスキルのものです。

## アクティブ

```js
new_strike: {
 kind: 'active',
 tooltip: '125%ダメージ。CT5秒',
 prepare(actor, target, now) {
  return {multiplier: 1.25, criticalChance: null};
 },
 comShouldUse(actor, now, target, kind) {
  return !!target && target.hp > 0;
 },
 onResolved(actor, target, hit, now, prepared) {
  // ダメージ確定後に付ける効果。必要な場合だけ指定。
 }
}
```

通常の攻撃スキルは、共通処理がCTを設定し、プレイヤー・COMともに `prepare` の結果を同じ攻撃計算へ渡します。`comShouldUse` は使用タイミングだけを判断します。新スキルはキャラ側の定義にも同じIDを設定してください。

主な追加フック：

| フック・設定 | 用途 |
|---|---|
| `canUse(actor)` | 武器・弾薬などの使用条件。falseなら使用不可 |
| `unavailableMessage` | プレイヤーが条件を満たさない場合の案内 |
| `onResolved(...)` | 通常のダメージ確定後に付与する効果 |
| `resolvePrepared(...)` | ゲイルシュートのように確定後の回復とログを専用処理にする場合 |
| `forceInjury(actor, target, skill, now)` | 攻撃後の怪我の強制付与条件 |
| `onInflictedInjury(actor, target, now)` | 怪我を付与した際にCOMの追撃判断用状態などを記録 |
| `comPressInjury(actor, now)` | 次のCOM行動で怪我の有利を追うかを判断 |
| `attack(actor, target, now, drone, preserve)` | ノクスの連射のように攻撃全体を独自実行する場合 |

`attack` は通常の攻撃準備より前に呼ばれるため、所有スキル・武器・残弾・CTの確認と処理はハンドラー側に必要です。既存のノクス処理は、弾切れ・撃破による終了、反撃回数、熟練度と耐久の処理順も保持しています。

ステップブレイクはCTをダメージ確定時に設定する既存仕様のため、`normalHitActive: true` と `resolveUnprepared` を使います。新しい一般的な倍率攻撃はこの形式を使う必要はありません。

## フィールド

- `execute(...)`：実際の効果。プレイヤーとCOMで共有する処理をここに置きます。引数はスキルに応じて設計します。
- `playerUse(actor, now)`：プレイヤー操作からの呼び出し。素材選択メニューを開く場合もここです。
- `comUse(actor, plan, now)`：COMが判断し、使用できたらtrueを返します。
- `comPhase`：`beforeRecovery` または `afterRecovery`。回復や製作判断に対する既存の優先順を保ちます。
- `canUse(actor)`：ボタンの追加の使用条件。`execute` 側でも条件を確認してください。
- `count(actor)`、`tooltip`：ボタン上の表示。
- `comCombatUse(actor, target, now)`：COMが対人戦の判断に入った際に使う効果。

共通のプレイヤー入口でCT・戦闘中・作業中などを確認しますが、直接呼ばれる効果処理も所有・必要素材・HP・CTなどを確認する設計です。既存の `burnSpirit` などの関数名は互換用の入口として残しています。

## パッシブ

| フック | 呼ばれる場面 |
|---|---|
| `onSearch(actor, now)` | 完了した探索の記録時。探索とストック探索で共通 |
| `onMove(actor, now, stacks)` | 移動コストを支払った後 |
| `extraMastery(actor, target, definition)` | 攻撃で得る追加の熟練度 |
| `consumeSearchBatch(actor)` | 蓄積を消費して既存の3個発見を発動する場合 |
| `statMultiplier(actor, stat, now)` | 能力値の倍率 |
| `recoveryBonus(actor)` | 休憩・治療の毎秒回復の加算 |
| `criticalBonus(actor, now)` | クリティカル率への加算 |
| `discoveryPenalty(actor, now)` | 被発見率からの減算 |
| `droneDamageBonus(actor)` | ドローンへのダメージ倍率への加算 |
| `extraDrops(actor)` | 追加ドロップ数 |
| `beforeDroneCorpse(actor, drone, now)` | 撃破後、死体生成前。解体屋のスタック獲得など |
| `afterDroneDefeat(actor, drone, now)` | 死体生成と撃破経験値処理後。魚型撃破時の回復など |
| `view(actor, now, target)` | カウンター・説明・最大状態の表示 |

`view` は `{stacks, max, suffix}` を基本とし、`count`、`label`、`isMax` で専用表示を上書きできます。倍率・回復量などの問い合わせ用フックは副作用を持たせないでください。

## 検証と今回の範囲

`node tests/skill-registry.test.cjs`

未登録の挙動や種類の不一致を起動時にも検出します。テストは仮の新パッシブ・フィールド・アクティブを登録し、プレイヤー・COMの効果実行、CT、表示、探索、撃破イベントまで到達することを確認します。

移行時は同一乱数・時刻の110シナリオで全20種類を変更前と比較しました。効果、数値、使用条件、CT、COMの優先順、ログ、HUD、乱数の進行は一致しています。

既存の状態異常・怪我・装備効果・ダメージ計算などの共通機構は維持しています。これまでなかった状態異常や発動タイミングが必要な場合は、その共通機構やフックを追加する実装も必要です。任意の新しい効果を書くだけで自動実装される仕組みではありません。

## 登録漏れの全体チェック

`node tools/validate-content.cjs` でキャラ・スキル・アイテム・レシピ・画像・配置などをまとめて確認できます。詳しくは [CONTENT_VALIDATION.md](CONTENT_VALIDATION.md) を参照してください。
