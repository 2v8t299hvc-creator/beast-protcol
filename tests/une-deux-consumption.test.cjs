const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./character-catalog.test.cjs');
function setup(){const h=harness();h.run(`selectedCharacter='flugel';startSelectedCharacter();matchClock.section=1;matchClock.competitive=false;matchClock.blocked=[];matchClock.nextBlocked=[];
 S.place='山岳区画';S.hp=100000;S.equipment={weapon:'practice_sword'};S.equipmentEffects={};S.masteryAttacks={slash:30};
 var a=comActors[0],third=comActors[1];for(const x of [a,third]){x.place=S.place;x.hp=100000;x.equipment={weapon:'practice_sword'};x.equipmentEffects={};x.masteryAttacks={slash:30}}
 var d=drones.bird;Object.assign(d,{spawned:true,hp:100000,area:S.place,generation:1});
 Math.random=()=>.5;attackRoll=()=>0;attackCritical=()=>false;rollCritical=()=>false;rollBodyInjury=()=>false;combatDamage=()=>20;damageToDrone=()=>20;
 `);return h;}
test('initial hit applies posture; only the first follow-up receives the bonus',()=>{
 const {run}=setup();run("var initial=actorAttack(S,a,1000,false,'une_deux')");assert.equal(run('initial.damage'),15);assert(run('postureBonus(S,a,1001)'));
 assert.equal(run('a.postureBreaks[S.id]'),7000);assert(run('attackCriticalChance(S,\'slash\',null,a,1001)>=.25'));
 run('var first=actorAttack(S,a,2000),second=actorAttack(S,a,3000)');assert.equal(run('first.damage'),34);assert.equal(run('second.damage'),20);assert(!run('postureBonus(S,a,3000)'));
 assert(run('attackCriticalChance(S,\'slash\',null,a,3000)<.25'));
});
test('guarded follow-ups and third-party attacks clear all posture sources',()=>{
 const {run}=setup();run("actorAttack(S,a,1000,false,'une_deux');actorAccuracyBonus=()=>-100;var guarded=actorAttack(S,a,2000)");assert(run('guarded.guarded'));assert(!run('postureBonus(S,a,2001)'));
 run("actorAccuracyBonus=()=>0;S.characterSkillReadyAt=0;actorAttack(S,a,3000,false,'une_deux');a.postureBreaks.extra=9000;var other=actorAttack(third,a,4000)");assert.equal(run('other.damage'),20);assert.equal(run('Object.keys(a.postureBreaks).length'),0);
});
test('drone targets consume posture after the boosted hit; time expiry remains six seconds',()=>{
 const {run}=setup();run("var initial=strikeDrone(S,d,1000,'une_deux')");assert.equal(run('initial.damage'),15);assert(run('postureBonus(S,d,1001)'));
 run('var boosted=strikeDrone(S,d,2000),normal=strikeDrone(S,d,3000)');assert.equal(run('boosted.damage'),34);assert.equal(run('normal.damage'),20);
 run("S.characterSkillReadyAt=0;actorAttack(S,a,4000,false,'une_deux')");assert(run('postureBonus(S,a,9999)'));assert(!run('postureBonus(S,a,10000)'));
 run('var expired=actorAttack(S,a,10000)');assert.equal(run('expired.damage'),20);
});
test('drone counters remove posture but poison decay and exploration costs do not',()=>{
 const {run}=setup();run('S.postureBreaks={[a.id]:9000};var counter=droneCounterDamage(DRONE_DEFS.bird,S,1000)');assert(run('counter>0'));assert.equal(run('Object.keys(S.postureBreaks).length'),0);
 run("S.postureBreaks={[a.id]:9000};applyStatus('purplePoison',1000,S);updateStatusEffects(2000,S);paySearchCost(S,2000)");assert(run('postureBonus(a,S,2001)'));
});
test('in a multi-shot attack, only one projectile benefits and the description states the limit',()=>{
 const {run}=setup();run("actorAttack(S,a,1000,false,'une_deux');S.character='bat';S.equipment.weapon='practice_gun';S.equipmentAmmo.weapon=3;S.characterSkillReadyAt=0;var volley=executeDanse(S,a,2000)");
 assert.equal(run('volley.shots.length'),3);assert(run('volley.shots[0].damage>volley.shots[1].damage'));assert.equal(run('volley.shots[1].damage'),run('volley.shots[2].damage'));
 assert(run("CHARACTER_SKILL_BY_ID.une_deux.description.includes('攻撃を1回受けると解除')"));
});
