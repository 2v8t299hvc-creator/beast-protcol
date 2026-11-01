# COMの武器更新・ドラゴコア経由の製作

- 武器評価は装備個体と製作予定の新品を区別する。成長した攻撃力、熟練度、命中補正、残り耐久、耐久低下無効、成長・吸収等の主要特性を評価する。
- 固有効果は計画用の重みとして評価する。実際の攻撃力・ダメージ・レシピは変更しない。
- 弾薬不要の評価加点は65から18へ変更する。レーザーライフルの利便性だけで、レジェンダリー銃への更新が阻まれないようにする。
- 装備変更と拾得判断では、拾った個体の成長値も見る。計画キャッシュは装備・所持品の個体情報が変わった場合に更新する。
- 逆鱗またはドラゴコアをすでに所持していて、実用性が上がる得意武器種のレジェンダリー武器を製作できる見込みがあれば、その武器ルートを優先する。
- 入手見込みは公開配置、封鎖予告、自分が確認した物資切れ・危険区画だけから判断する。他参加者の所持品や未発見の落下場所は見ない。
- 完成までの不足素材を入手できない場合は無理に逆鱗をコアへ変えず、通常の装備計画を使う。ドラゴン防具の製作ルートは残す。
- 通常の戦闘・緊急回復・退避を優先した後、可能な武器更新とその中間素材の製作はスタミナ休憩より先に処理する。HPを使う探索判断やスキル戦術の変更は別途行う。


## 2026-11-02: observed swap loop and recovery decisions

The 2026-11-01T22-28-04-167Z replay showed Zakuro alternating a durability-3 Kukri and a fresh Army Knife. The repair replacement override chose the knife while the normal ranking immediately chose the worn Kukri again. Equipment swaps now use one strict weapon-value ordering, including the actual 30% half-broken attack penalty. Instance wear and growth remain preserved. Planning may still seek a replacement before breakage; equipping requires a positive value gain.

COM injury treatment requires a quiet interval of its treatment duration plus 8 seconds since the last personally received hit in the current area. Relocation clears that local danger condition. The same interval prevents stationary HP/stamina recovery after attacks; consumable recovery remains available. In competitive section 9 onward, or with one open area, COM forgoes injury treatment and long HP/stamina rest. When short of resources it performs paid searches, consumes recovery items when usable, and heals only enough to avoid a lethal search cost if necessary. Existing search discovery probabilities are unchanged.

Shared inventory removal consumes matching stacks in ascending quantity order, preserving surviving slot order and instance metadata. This covers player and COM consumables, crafting ingredients, ammunition, and field-skill materials.

Regression: `node --test tests/com-recovery-stacks-regression.test.cjs tests/com-weapon-upgrades.test.cjs tests/com-endgame-decisions.test.cjs`.
