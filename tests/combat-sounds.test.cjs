const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
function setup(){
 const h=harness();h.run(`startSelectedCharacter();matchClock.section=1;matchClock.sectionEndsAt=9000000;matchClock.blocked=[];matchClock.nextBlocked=[];matchClock.competitive=false;
 S.place='森林区画';S.hp=100000;S.equipment={};S.equipmentAmmo={};S.equipmentEffects={};S.matchEvents=[];
 var shooter=comActors[0],victim=comActors[1];
 for(const a of comActors){a.hp=100000;a.place='海岸区画';a.matchEvents=[];a.equipment={};a.equipmentAmmo={};a.equipmentEffects={}}
 shooter.place=victim.place='山岳区画';shooter.equipment.weapon='practice_gun';shooter.equipmentAmmo.weapon=30;
 Math.random=()=>.1;`);return h;
}
test('gunshot rarity probabilities have exact boundaries and no generic fallback',()=>{
 const {run}=setup();
 for(const [id,p]of [['practice_gun',1],['handgun',.75],['sniper_rifle',.5],['magma_blaster',.25],['drag_energy_07',0]]){
  run(`shooter.equipment.weapon='${id}'`);assert.equal(run("combatSoundSpec(shooter,'gun').chance"),p);
  if(p>0)assert.equal(run(`emitCombatSound(shooter,'gun',1000,()=>${p-.000001})?.kind`),'gunshot');
  if(p<1)assert.equal(run(`emitCombatSound(shooter,'gun',1000,()=>${p})`),null);
 }
 run("shooter.equipment.weapon='magma_blaster'");assert.equal(run("emitCombatSound(shooter,'gun',1000,()=>.9)"),null);
 assert.equal(run("combatSoundSpec(shooter,'fist').kind"),'noise');
 assert.equal(run("emitCombatSound(shooter,'fist',1000,()=>.2)"),null);
 assert.equal(run("emitCombatSound(shooter,'fist',1000,()=>.19999).kind"),'noise');
});
test('only living participants in different areas hear sounds, without attacker identity',()=>{
 const {run}=setup();run("comActors[2].hp=0;var sound=emitCombatSound(shooter,'gun',1000)");
 assert.equal(run('sound.listeners.length'),7);assert(run('sound.listeners.includes(S.id)'));assert(!run('sound.listeners.includes(shooter.id)'));assert(!run('sound.listeners.includes(victim.id)'));assert(!run('sound.listeners.includes(comActors[2].id)'));
 assert.equal(run("JSON.stringify(S.matchEvents[0].data)"),JSON.stringify({kind:'gunshot',area:'山岳区画'}));
 assert(run("$('log').children.some(e=>e.textContent.includes('銃声だ。山岳区画の方から聞こえる'))"));
 assert.equal(run("S.matchEvents.filter(e=>e.type==='sound-heard').length"),1);
 run("emitCombatSound(shooter,'gun',1100)");assert.equal(run("S.matchEvents.filter(e=>e.type==='sound-heard').length"),2);
 assert.equal(run("$('log').children.filter(e=>e.textContent.includes('銃声だ。山岳区画')).length"),1);
 assert.equal(run("emitCombatSound({kind:'bird',place:shooter.place,hp:30},'fist',1200,()=>0)"),null);
 run('matchClock.ended=true');assert.equal(run("emitCombatSound(shooter,'gun',1300)"),null);
});
test('actual PvP and drone attacks include guarded and final shots; empty guns use noise',()=>{
 for(const drone of [false,true]){
  const {run}=setup();run(`shooter.equipmentAmmo.weapon=1;Math.random=()=>.999999;
   var drone=drones.bird;Object.assign(drone,{spawned:true,hp:100000,area:shooter.place,generation:1});
   var hit=${drone?'strikeDrone(shooter,drone,1000)':'actorAttack(shooter,victim,1000)'};`);
  assert(run('hit.guarded'));assert.equal(run('shooter.equipmentAmmo.weapon'),0);assert.equal(run('S.lastHeardCombatSound.kind'),'gunshot');
  run("Math.random=()=>0;actorAttack(shooter,victim,2000)");assert.equal(run('S.lastHeardCombatSound.kind'),'noise');
  assert.equal(run("equipmentState(shooter,'weapon').wearAttacks"),1);
 }
});
test('volley emits per projectile while durability still counts one action',()=>{
 const {run}=setup();run("shooter.character='bat';shooter.equipment.weapon='practice_gun';shooter.equipmentAmmo.weapon=3;var volley=executeDanse(shooter,victim,1000)");
 assert.equal(run('volley.shots.length'),3);assert.equal(run("shooter.matchEvents.filter(e=>e.type==='sound-emitted').length"),3);
 assert.equal(run("equipmentState(shooter,'weapon').wearAttacks"),1);
});
test('ranged wear is strictly lower while grace, immunity, retaliation and melee remain intact',()=>{
 const {run}=setup();
 for(const uses of [11,40,80,200])for(const durability of [10,5,1]){
  const state=JSON.stringify({wearAttacks:uses,durability});
  const baseline=run(`weaponDurabilityChance(${state},'fist')`);
  for(const type of ['slash','hammer'])assert.equal(run(`weaponDurabilityChance(${state},'${type}')`),baseline);
  assert.equal(run(`weaponDurabilityChance(${state},'bow')`),baseline*.65);
  assert.equal(run(`weaponDurabilityChance(${state},'gun')`),baseline*.4);
 }
 for(const type of ['fist','bow','gun'])assert.equal(run(`weaponDurabilityChance({wearAttacks:10,durability:10},'${type}')`),0);
 run("shooter.equipment.weapon='handgun';Object.assign(equipmentState(shooter,'weapon'),{wearAttacks:10,durability:10});Math.random=()=>.03;recordWeaponUse(shooter,'gun',1000)");
 assert.equal(run("equipmentState(shooter,'weapon').durability"),10);
 run("recordWeaponUse(shooter,'gun',2000,1)");assert.equal(run("equipmentState(shooter,'weapon').durability"),9);
 run("shooter.equipment.weapon='amalgam_bow';Math.random=()=>0;for(let i=0;i<200;i++)recordWeaponUse(shooter,'bow',3000,1)");
 assert.equal(run("equipmentState(shooter,'weapon').durability"),10);
});

test('human attacks also inform distant COMs and silent legendary guns stay silent',()=>{
 const {run}=setup();run("S.place=victim.place;S.equipment.weapon='practice_gun';S.equipmentAmmo.weapon=1;actorAttack(S,victim,1000)");
 assert.equal(run('comActors[3].lastHeardCombatSound.kind'),'gunshot');
 assert.equal(run('S.lastHeardCombatSound'),undefined);
 run("S.equipment.weapon='drag_energy_07';S.equipmentAmmo.weapon=1;var beforeSounds=S.matchEvents.filter(e=>e.type==='sound-emitted').length;actorAttack(S,victim,2000)");
 assert.equal(run("S.matchEvents.filter(e=>e.type==='sound-emitted').length"),run('beforeSounds'));
});
