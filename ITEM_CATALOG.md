# 装備・アイテムの追加と変更

`index.html` の `ITEM_DEFS` が、全装備・アイテムの登録元です。既存の `names`、`recipes`、`EQUIPMENT_DEFS` などは `buildItemTables` が生成する互換用テーブルです。生成されたテーブルに後から定義を追記する運用はやめ、該当アイテムの定義を編集します。

## 登録例

```js
{
 id: 'new_drink',
 name: '新しいドリンク',
 rarity: 'rare',
 recovery: {group: 'stamina', amount: 60},
 craftGroup: 'recovery',
 fallback: '🧃',
 art: ['stamina_01', 0],
 findCount: 3,
 recipes: [
  {category: 'item', need: {water: 1, energy_fruit: 1}, count: 2, desc: 'スタミナ60回復'}
 ]
}
```

この定義から名前、等級、回復機能、製作分類、画像、発見時個数、製作レシピを生成します。`findCount` は探索・補給などで使う標準の1セット個数、レシピの `count` は製作個数です。省略時はそれぞれ1です。

## 主なフィールド

| フィールド | 用途 |
|---|---|
| `id`, `name` | 重複しない内部IDと表示名 |
| `rarity` | `common` / `uncommon` / `rare` / `epic` / `legendary`。既存処理の省略時扱いはcommon |
| `equipment` | `slot`, `attack`, `defense`。武器には `weaponType`、弾薬武器には `ammoType`, `capacity` も指定 |
| `effect` | 名前・説明・吸収率など、既存の装備効果が読む設定 |
| `skillIcon` | 装備スキルのアイコン `{id, art}`。`art` は実際の画像パス |
| `recovery` | `{group: 'hp' または 'stamina', amount: 回復量}` |
| `craftGroup` | 素材・回復などの製作分類。武器と防具は装備設定から分類 |
| `art` | `[画像シートID, 0〜3のセル番号]`。単体画像は3番目に `'single'` を指定 |
| `fallback` | アイコン未読込時などの絵文字 |
| `recipes` | 製作方法の配列。同じ完成品に複数の製作方法を登録可能 |
| `singleStack` | trueなら魚と同じく1枠に1個。装備は指定しなくても1個 |
| `carryLimit` | 弾薬の携行上限。既存の弾薬数制限にも反映 |
| `findCount` | 通常の1セット個数 |
| `startingWeapon` | 準備時間に選べる練習用武器に登録する場合だけtrue |

画像シートのURLは `ITEM_ART_SHEETS` に1回登録し、各アイテムの `art` から参照します。同じシートの4セルを使う場合は、URLをアイテムごとに複製する必要はありません。

銃・弓の装備定義で無限装填数が必要な場合、JavaScriptの `Infinity` を使えます。今回の集約でもレーザーライフルなどの無限弾薬設定は保持しています。

## 順序の互換性

既存レシピの `order` と `ITEM_TABLE_ORDER` は、これまでの表示順・抽選候補順・COMの同点時の選択順を保つための情報です。新しいアイテムやレシピを追加するときは変更不要です。新規レシピには `order` を付けなければ既存の後ろに追加されます。

## この定義とは別に設定するもの

- 区画への配置：`regionStock`。
- ドローンの固定ドロップ、特別な補給枠、COMの固定目標：それぞれの設定。
- 鉱物として食べられる・望遠鏡から生成されるなど、専用の候補リスト。
- これまで存在しなかった新しい特殊効果の処理。

新アイテムを定義しても、入手経路が自動で作られるわけではありません。既存の吸収・回復などは設定を流用できますが、新しい効果名や任意のパラメータを書くだけでは動作しません。

## 検証

`node tests/item-catalog.test.cjs`

実際のゲームスクリプトで、追加アイテムの製作・装備・回復・分類・画像・所持数制限を検証します。起動時の `validateItemDefinitions` では、ID重複、名前不足、等級、装備設定、画像シート参照、回復量、レシピ素材の存在と個数を検査します。

今回の移行では268種類・201レシピを集約し、171個の分散した初期化・上書き文を置き換えました。数値、レシピ順、画像割り当て、区画配置、ドローン設定、同一乱数・時刻での試合初期状態を移行前と比較しています。

## 登録漏れの全体チェック

`node tools/validate-content.cjs` でキャラ・スキル・アイテム・レシピ・画像・配置などをまとめて確認できます。詳しくは [CONTENT_VALIDATION.md](CONTENT_VALIDATION.md) を参照してください。
