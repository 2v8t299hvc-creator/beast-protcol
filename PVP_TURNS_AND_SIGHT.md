# 対人戦の反撃廃止・COM索敵情報

- 参加者同士の1回の攻撃は攻撃者の通常攻撃1回のみ。プレイヤー対COM、COM対COMとも自動通常反撃なし。
- 攻撃されただけでは守備側の弾数・熟練度・行動時間を消費しない。自分の索敵と予定行動から選んだ攻撃は別。
- ドローンの反撃と、装備による反射・耐久減少効果は継続。
- COMの戦闘／逃走判断には、自分の有料索敵で獲得したsource:searchの発見情報が必須。プレイヤーが発見・攻撃準備してもCOMへ発見情報を渡さない。
- 発見した行動で即移動はせず、次の自身の行動で戦闘・逃走等を判断。
- 移動時に自他の発見情報を失効。滞在バージョンも照合し、一度移動した相手の再入場を過去の発見で追跡しない。
- COMのHP・残弾等による撤退基準は維持。今回、熟練度閾値やダメージ式は変更しない。
- pvp-awareness.test.cjsで反撃なし・相互の発見非共有・索敵成否・発見と逃走の行動分離・再入場を確認。

## Equal combat feedback wait (2026-10-27)
COM attacks now delay their next paid action by the same 900ms feedback period used by the player. The earliest next action is hit time + 1000ms + any active action slowdown + 900ms. This applies to hits, misses, participant fights and drone fights; defenders receive no extra lock. Existing later schedules stay intact. With guaranteed re-discovery, successive attacks are 2900ms apart for either side (search 1000ms, attack 1000ms, feedback 900ms), excluding human input time.
