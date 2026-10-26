# ヒョウガ（ユキヒョウ銃COM）

- 仮COM com-02を正式種族 snow_leopard に置換。正式名は「ヒョウガ」。参加者総数10人は維持。
- 初期熟練は銃D+（累積20）、他武器はF。練習用の銃で出発。
- 制作ルートはスナイパーライフル→簡易アームガード→ラバースーツ→レーザーライフル。素材探索・回復・装備更新は共通AIを使用。
- 武器・弾薬選択を actor.preferredWeaponType / comAmmoType に一般化。銃キャラは銃弾を集め装填し、弓へ持ち替えない。
- actorArtで遭遇画面・被ダメージ通知・死亡通知の画像を切り替え。
- assets/characters/snow_leopard_encounter_transparent.webp は承認済みマント案（細い尾）の透過画像。画像生成ツールで背景除去し、アルファを保ってWebP変換。RGBA・四隅alpha0を確認。
- 固有スキルは未導入。独自成長は今後設定。
- tests/snow-leopard.test.cjs と既存10人戦シミュレーションで検証。
