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

## 2026-11-06: stalled early builds and HP-funded progress

The November 6 replay showed Bjorn consuming his equipped heated frying pan for fried eggs after dropping his practice hammer, then spending roughly four minutes unarmed. Both Bjorn and Jerk also repeatedly visited water areas while their actual weapon plans needed bamboo/cloth. Three shared decisions are corrected:

- The post-hit quiet interval restricts stationary treatment/rest; it no longer redirects otherwise ordinary early-game building to the final-area PvP-only search. Immediate under-fire reactions, deliberate injury pressure and actual final-area decisions remain separate priorities.
- Material movement uses the current plan's materials. Low stamina no longer silently adds water/drinks to its destination scoring. Explicit recovery plans still gather stamina supplies.
- A COM with spare HP continues at low/zero stamina instead of resting to half its stamina bar. It budgets the real stamina deficit for three searches plus a relocation, including temporary injury costs, and requires at least 35% of maximum HP (minimum 20 HP) left afterward. Actual searches/movement still pay their ordinary HP costs; free crafting/equipping do not gain an added cost. Low HP retains treatment/rest. Lethal movement is rejected, and the last-resort search checks injury costs as well as the stamina deficit.
- COM cooking plans exclude recipes that would spend the sole equipped weapon. All COM crafting checks likewise require either a usable weapon result or a spare usable weapon if the equipped weapon is consumed. Normal weapon upgrades can still use their equipped predecessor. Core/player crafting and recipe consumption rules are unchanged.

Validation: `node tools/test.cjs --suite com,content` (96 checks). `tests/com-growth-recovery.test.cjs` covers quiet-period gathering, zero-ST movement/search and crafting with real costs, low-HP survival, sole-weapon cooking, spare re-equipping and normal weapon upgrades. Match-level growth/win-rate improvements must still be evaluated in subsequent play records.

## 2026-11-06: conserve combat supplies after completing the build

The 13:43 replay showed improved Bjorn growth, but repeated HP-funded searches drained endgame supplies (recorded search-deficit costs alone: Flugel at least 1,673 HP; Zakuro at least 1,373 HP).

- Outside urgent combat, late-game COM preserves HP consumables worth 60 or more per use while above 35% HP. Smaller supplies remain usable. At or below 35% HP, or in combat/under fire, the reserve remains available; freezing and cooldown rules still apply. Stamina supplies worth at least 50 require at least 90% of their amount to be missing outside combat.
- Final-search recovery no longer treats every blind search as combat. After three failed PvP searches, a COM short of search stamina takes one short stamina-rest action at most once per three seconds. Search continues afterward; there is no half-bar rest requirement. Recent incoming attacks and deliberate injury pressure bypass this breather.
- After six misses, a safe COM can reconsider its area through ordinary paid movement, with at least 12 seconds between patrol attempts. Destination scoring uses public legal areas and personal visits, never live opponent positions. A confirmed local death-scent mark retains priority. Relocation resets miss history.
- Once an epic weapon and rare-or-better main armor are equipped, optional armor/accessory crafting waits until medium/large HP stock (60+ per use) reaches 300 total, or the policy's smaller large-recovery target. Weapon updates and opportunistic found-equipment swaps remain available. Personal reserve changes invalidate the plan cache.
- Without a crafting, recovery, ammunition or hunting objective, three ordinary searches at low stamina are followed by a short stamina-rest action when the personal quiet-period rule permits it. Purposeful HP-funded building/gathering continues under the existing survival budget.

Validation: `node tools/test.cjs --suite com,content` (104 checks), including `tests/com-reserve-conservation.test.cjs`. These rules do not grant supplies or opponent knowledge, and their match-level effect still requires subsequent play records.
