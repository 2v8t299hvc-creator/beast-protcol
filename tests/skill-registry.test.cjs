// New skills must work through normal player/COM paths without a hard-coded ID whitelist.
const assert=require('node:assert/strict');const {harness}=require('./character-catalog.test.cjs');
let {run}=harness();
assert.equal(run('validateSkillBehaviors(CHARACTER_DEFS,SKILL_BEHAVIORS)'),true);
assert.equal(run('Object.keys(SKILL_BEHAVIORS).length'),run('new Set(CHARACTER_DEFS.flatMap(c=>Object.values(c.skills).map(s=>s.id))).size'));
for(const edit of ["delete behaviors.step_break","behaviors.step_break={...behaviors.step_break,kind:'field'}","behaviors.physics_blow={...behaviors.physics_blow,comShouldUse:null}","behaviors.herb_gathering={...behaviors.herb_gathering,execute:null}","behaviors.weapon_modification={...behaviors.weapon_modification,comPhase:'unknown'}"]){
 assert.throws(()=>run(`(()=>{const behaviors={...SKILL_BEHAVIORS};${edit};return validateSkillBehaviors(CHARACTER_DEFS,behaviors)})()`));
}
const metadata=`CHARACTER_DEFS.push({...CHARACTER_DEFS[0],id:'skill_test',name:'スキル登録テスト',skills:{
 passive:{id:'test_passive',name:'テストの足取り',description:'探索でスタミナ2回復',icon:CHARACTER_DEFS[0].skills.passive.icon},
 field:{id:'test_field',name:'テストの休息',description:'スタミナ3回復',icon:CHARACTER_DEFS[0].skills.active.icon,cooldownMs:7000},
 active:{id:'test_active',name:'テスト打撃',description:'125%攻撃',icon:CHARACTER_DEFS[0].skills.active.icon,cooldownMs:5000}
 }});\n`;
const behaviors=`Object.assign(SKILL_BEHAVIORS,{
 test_passive:{kind:'passive',onSearch(actor){actor.st+=2},beforeDroneCorpse(actor){actor.testBeforeCorpse=(actor.testBeforeCorpse||0)+1},afterDroneDefeat(actor){actor.testAfterDefeat=(actor.testAfterDefeat||0)+1;return 0},droneDamageBonus(){return .2},extraDrops(){return 1},view(){return {stacks:1,max:1,suffix:'（登録テスト）'}}},
 test_field:{kind:'field',comPhase:'beforeRecovery',tooltip:'テストの休息',execute(actor,now){if(now<(actor.characterFieldReadyAt||0))return false;actor.st+=3;actor.characterFieldReadyAt=now+7000;return true},playerUse(actor,now){this.execute(actor,now)},comUse(actor,plan,now){return this.execute(actor,now)}},
 test_active:{kind:'active',tooltip:'テスト打撃',prepare(){return {multiplier:1.25,criticalChance:null}},comShouldUse(actor,now,target){return !!target&&target.hp>0},comPressInjury(){return true},onResolved(actor,target){target.testDebuff=actor.id}}
 });\n`;
({run}=harness(false,source=>source.replace('validateCharacterDefinitions(CHARACTER_DEFS);',metadata+'validateCharacterDefinitions(CHARACTER_DEFS);').replace('validateSkillBehaviors(CHARACTER_DEFS,SKILL_BEHAVIORS);',behaviors+'validateSkillBehaviors(CHARACTER_DEFS,SKILL_BEHAVIORS);')));
run("selectedCharacter='skill_test';startSelectedCharacter();matchClock.section=1;matchClock.sectionEndsAt=Date.now()+1000000;S.place='山岳区画';S.equipment={weapon:'practice_gauntlet'};S.equipmentEffects={};S.masteryAttacks={fist:9};S.st=10;S.bag=[];syncInventory();var a=comActors[0];a.place=S.place;a.hp=10000;a.equipment={};a.bodyInjuries={};rollBodyInjury=()=>false;");
run('recordExploration(S,1000000)');assert.equal(run('S.st'),12);
run('useCharacterFieldSkill()');assert.equal(run('S.st'),15);assert(run('S.characterFieldReadyAt>0'));
run('useCharacterFieldSkill()');assert.equal(run('S.st'),15);
run("S.enemy=true;S.enemyPlayerId=a.id;renderCharacterSkills()");
assert.equal(run("$('characterSkillBtn').title"),'テスト打撃');
assert.equal(run("$('characterPassiveCount').textContent"),'1/1');
assert.equal(run('comCharacterSkill(S,1000000,a)'),'test_active');
run("var result=actorAttack(S,a,1000000,false,'test_active')");
assert.equal(run('result.characterSkill.id'),'test_active');assert.equal(run('result.characterSkill.multiplier'),1.25);
assert.equal(run('a.testDebuff'),run('S.id'));assert.equal(run('S.characterSkillReadyAt'),1005000);
assert.equal(run('comCharacterSkill(S,1004999,a)'),null);assert.equal(run('comCharacterSkill(S,1005000,a)'),'test_active');
run("a.character='skill_test';a.equipment={weapon:'practice_gauntlet'};a.equipmentEffects={};a.masteryAttacks={fist:9};a.characterSkillReadyAt=0;a.characterFieldReadyAt=0;a.st=10;");
assert.equal(run('tryComFieldSkill(a,{},1000000,\'afterRecovery\')'),false);
assert.equal(run('tryComFieldSkill(a,{},1000000,\'beforeRecovery\')'),true);assert.equal(run('a.st'),13);
assert.equal(run('tryComFieldSkill(a,{},1000001,\'beforeRecovery\')'),false);
run("var comResult=actorAttack(a,S,1000000,false,comCharacterSkill(a,1000000,S))");
assert.equal(run('comResult.characterSkill.id'),'test_active');assert.equal(run('S.testDebuff'),run('a.id'));
assert.equal(run('comShouldPressInjury(a,1000000)'),true);
assert.equal(run('dismantlerDamageBonus(S)'),.2);assert.equal(run('dismantlerExtraDrops(S)'),1);
run("S.hp=actorMax(S,'hp');var d=drones.fish;Object.assign(d,{spawned:true,hp:1,area:S.place,generation:1});strikeDrone(S,d,1000000)");
assert.equal(run('S.testBeforeCorpse'),1);assert.equal(run('S.testAfterDefeat'),1);
console.log('PASS: skill validation and new passive/field/active registration reach player/COM execution, HUD, cooldowns and effects');
