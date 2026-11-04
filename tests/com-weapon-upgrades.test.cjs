const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
function setup(character='bjorn',weapon='wild_hammer'){
 const h=harness();h.run(`selectedCharacter='zakuro';startSelectedCharacter();initializeComActors(PLAYABLE_CHARACTERS.length-1);matchClock.section=5;matchClock.sectionEndsAt=Date.now()+1000000;matchClock.blocked=[];matchClock.nextBlocked=[];matchClock.competitive=false;
 var a=comActors.find(a=>a.character==='${character}');a.place='工業区画';a.hp=actorMax(a,'hp');a.st=0;a.bag=[];a.equipment={weapon:'${weapon}'};a.equipmentEffects={weapon:equipmentInstanceEffects('${weapon}')};a.exhausted={};a.dangerAreas={};a.noProgress=0;a.goal=null;a.characterFieldReadyAt=Date.now()+1000000;a.masteryAttacks={fist:30,slash:30,hammer:30,bow:30,gun:30};syncInventory(a);`);return h;
}
test('same-attack growth and durability immunity count as weapon upgrades',()=>{
 const {run}=setup();assert(run("comWeaponValue(a,'super_wild_hammer',{})>comWeaponValue(a,'wild_hammer')"));
 run("a.bag=[{id:'super_wild_hammer',count:1}];syncInventory(a)");assert(run('comEquipBetter(a,Date.now())'));assert.equal(run('a.equipment.weapon'),'super_wild_hammer');
 run("a.equipment.weapon='wild_hammer';a.equipmentEffects.weapon=equipmentInstanceEffects('wild_hammer');a.bag=[{id:'wild_hammer',count:1}];syncInventory(a);a.adaptivePlanCache=null");
 assert.equal(run('comCurrentPlan(a).id'),'super_wild_hammer');assert(run('comReadyWeaponTurn(a,comCurrentPlan(a),Date.now())'));
 assert(run('comEquipBetter(a,Date.now())'));assert.equal(run('a.equipment.weapon'),'super_wild_hammer');
});
test('equipped and found weapon growth is respected and cache refreshes on growth',()=>{
 const {run}=setup('bjorn','super_wild_hammer');run("a.equipmentEffects.weapon.bonusAttack=15;a.bag=[{id:'steel_hammer',count:1}];syncInventory(a)");
 assert(!run('comEquipBetter(a,Date.now())'));assert.equal(run('a.equipment.weapon'),'super_wild_hammer');
 run('comCurrentPlan(a);var oldKey=a.adaptivePlanCache.key;a.equipmentEffects.weapon.bonusAttack=18;comCurrentPlan(a)');assert(run('oldKey!==a.adaptivePlanCache.key'));
 run("a.bag=[{id:'super_wild_hammer',count:1,effects:equipmentInstanceEffects('super_wild_hammer',{bonusAttack:30})}];syncInventory(a)");
 assert(run('comEquipBetter(a,Date.now())'));assert.equal(run("equipmentState(a,'weapon').bonusAttack"),30);
});
test('all five weapon types convert an owned scale and finish a legendary weapon at zero stamina',()=>{
 for(const [character,current,target]of [['kaito','glass_knuckle','dragon_heart'],['flugel','kukri','dragon_buster'],['bjorn','wild_hammer','drag_eater'],['hayate','azusa_bow','dragon_killer'],['snow_leopard','laser_rifle','drag_energy_07']]){
  const {run}=setup(character,current);
  run(`var target='${target}',r=recipes.find(r=>r.id===target);a.bag=[{id:'dragon_scale',count:1},{id:'discharger',count:1},...Object.entries(r.need).filter(([id])=>id!=='drago_core').map(([id,count])=>({id,count}))];syncInventory(a);`);
  assert.equal(run('comCurrentPlan(a).id'),target);
  run('stepCom(a,Date.now())');assert.equal(run("actorOwned(a,'drago_core')"),1,character);assert.equal(run("actorOwned(a,'dragon_scale')"),0);
  for(let i=0;i<4&&run('a.equipment.weapon')!==target;i++)run('stepCom(a,Date.now())');
  assert.equal(run('a.equipment.weapon'),target,character);assert(!run("a.history.some(x=>x.text==='行動できるスタミナまで休憩')"));
 }
});
test('dragon route respects unavailable materials and does not use hidden world objects',()=>{
 const {run}=setup();run("a.bag=[{id:'dragon_scale',count:1}];syncInventory(a);a.exhausted=Object.fromEntries(Object.keys(regionStock).map(k=>[k,true]));a.adaptivePlanCache=null");
 assert.equal(run('comCurrentPlan(a).id'),null);assert.equal(run("actorOwned(a,'dragon_scale')"),1);
 run("a.exhausted={};a.adaptivePlanCache=null;var before=JSON.stringify(comCurrentPlan(a));for(const obj of Object.values(regionObjects).flat())obj.taken=true;a.adaptivePlanCache=null");
 assert.equal(run('JSON.stringify(comCurrentPlan(a))'),run('before'));
});
