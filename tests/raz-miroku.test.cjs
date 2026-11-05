const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
function setup(character='miroku'){
 const {run,context}=harness();run(`selectedCharacter='${character}';startSelectedCharacter();matchClock.section=3;matchClock.sectionEndsAt=Date.now()+1000000;matchClock.nextBlocked=[];matchClock.blocked=[];S.place='山岳区画';S.bag=[];syncInventory();S.hp=10000;S.st=100;S.equipment={};S.equipmentEffects={};S.equipmentAmmo={};var now=Date.now(),victim=comActors[0];victim.place=S.place;victim.hp=100000;victim.equipment={};victim.equipmentEffects={};`);return {run,context};
}
test('expanded roster keeps nine distinct COMs, excludes the player and samples both new characters',()=>{
 const {run}=harness();run('var seed=17;Math.random=()=>{seed=seed*16807%2147483647;return seed/2147483647};selectedCharacter="kaito";startSelectedCharacter();var seen=new Set()');
 for(let i=0;i<20;i++){run('initializeComActors();for(const a of comActors)seen.add(a.character)');assert.equal(run('comActors.length'),9);assert.equal(run('new Set(comActors.map(a=>a.character)).size'),9);assert(!run('comActors.some(a=>a.character===S.character)'));}
 assert(run('seen.has("raz")&&seen.has("miroku")'));assert.equal(run('CHARACTER_DEFS.length'),12);
 for(const c of ['raz','miroku']){const {run}=harness();run(`showCharacterSelection('${c}');startSelectedCharacter()`);assert.equal(run('S.character'),c);assert.equal(run('comActors.length'),9);assert(run('!!actorArt(S)'));}
});
test('scavenger counts a new player corpse once, including own kills; drones never give stacks',()=>{
 const {run}=setup('raz');run(`var c=createPlayerCorpse(victim,S.place,now,S.id);var attack=totalStat('attack'),defense=totalStat('defense');openCorpse(c.id)`);
 assert.equal(run('S.scavengerStacks'),1);assert.equal(run('totalStat("attack")'),run('attack*1.03'));assert.equal(run('totalStat("defense")'),run('defense'));assert.equal(run('actorCriticalChance(S)'),.04);
 run('discoverCorpseFor(S,c,now);discoverCorpseFor(S,createDroneCorpse("bird",S.place,now),now)');assert.equal(run('S.scavengerStacks'),1);
});
test('scent snapshots existing corpse IDs, guarantees discovery and removes expired/closed/consumed marks',()=>{
 const {run}=setup('raz');run(`var bird=createDroneCorpse('bird','森林区画',now),player=createCorpse('player','死体','神殿区画',[],now);SKILL_BEHAVIORS.death_scent.execute(S,now);var future=createCorpse('player','後から発生','公園区画',[],now)`);
 assert.equal(run('S.scentCorpseIds.length'),2);assert.equal(run('corpseDiscoveryRate(bird,S)'),1);assert(!run('S.scentCorpseIds.includes(future.id)'));
 assert.equal(run('scentAreas(S,bird.expiresAt+1).includes("森林区画")'),false);run('matchClock.blocked=["神殿区画"]');assert.equal(run('scentAreas(S,now).includes("神殿区画")'),false);
 run('matchClock.blocked=[];discoverCorpseFor(S,player,now)');assert(!run('S.scentCorpseIds.includes(player.id)'));
 run('showMap(false)');assert(run('$("modalBody").innerHTML.includes("死臭")'));
});
test('a marked local corpse wins the next paid player search even with an opponent present',()=>{
 const {run,context}=setup('raz');const timers=[];context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return 1};
 run(`var c=createCorpse('player','新しい死体',S.place,[],now);SKILL_BEHAVIORS.death_scent.execute(S,now);var st=S.st,searches=matchStats(S).searches||0;primary()`);assert.equal(run('S.st'),run('st-3'));const task=timers.find(t=>t.ms===1000);assert(task);task.fn();assert.equal(run('S.corpseVisit.id'),run('c.id'));assert.equal(run('S.scavengerStacks'),1);assert.equal(run('matchStats(S).searches'),run('searches+1'));
});
test('dragon corpse remains until its area closes; ordinary drone corpses expire normally',()=>{
 const {run}=setup('raz');run(`var dragon=createDroneCorpse('dragon',S.place,now),bird=createDroneCorpse('bird',S.place,now);`);assert(run('corpseAvailable(dragon,now+9999999)'));assert(!run('corpseAvailable(bird,now+9999999)'));run('matchClock.blocked=[S.place]');assert(!run('corpseAvailable(dragon,now)'));
});
test('Miroku fifth and tenth attacks are critical across PvP/drone encounters',()=>{
 const {run}=setup();run(`Math.random=()=>0;S.equipment.weapon='practice_spear';S.equipmentEffects.weapon=equipmentInstanceEffects('practice_spear');var d=drones.scorpion;Object.assign(d,{spawned:true,hp:100000,area:S.place})`);
 for(let i=1;i<=10;i++){const result=run(i%2?'actorAttack(S,victim,now)':'strikeDrone(S,d,now)');assert.equal(result.critical,i%5===0,'attack '+i);assert.equal(result.type,'thrust');}
 assert.equal(run('S.flashAttacks'),10);assert.equal(run('equipmentState(S,"weapon").wearAttacks'),10);
});
test('dual-type knife uses higher proficiency, ties choose slash; only selected type earns attack mastery',()=>{
 const {run}=setup();run(`S.equipment.weapon='survival_knife';S.equipmentEffects.weapon=equipmentInstanceEffects('survival_knife');S.masteryAttacks.slash=14;S.masteryAttacks.thrust=20;Math.random=()=>0`);assert.equal(run('weaponType()'),'thrust');run('actorAttack(S,victim,now)');assert.equal(run('S.masteryAttacks.slash'),14);assert.equal(run('S.masteryAttacks.thrust'),21);assert.equal(run('equipmentState(S,"weapon").wearAttacks'),1);
 run('S.masteryAttacks.slash=21');assert.equal(run('weaponType()'),'slash');
});
test('wood gathering respects inventory capacity and cooldown without losing a failed use',()=>{
 const {run}=setup();run(`S.bag=Array.from({length:6},()=>({id:'stone',count:10}));syncInventory()`);assert(!run('SKILL_BEHAVIORS.wood_gathering.execute(S,now)'));assert.equal(run('S.characterFieldReadyAt||0'),0);
 run('S.bag=[];syncInventory()');assert(run('SKILL_BEHAVIORS.wood_gathering.execute(S,now)'));assert.equal(run('S.inventory.wood'),1);assert(!run('SKILL_BEHAVIORS.wood_gathering.execute(S,now+29999)'));assert(run('SKILL_BEHAVIORS.wood_gathering.execute(S,now+30000)'));assert.equal(run('S.inventory.wood'),2);
});
test('thrust weapon effects cover guards, critical stamina, injury, persistent kill growth and immunity',()=>{
 const {run}=setup('kaito');run(`S.equipment.weapon='practice_spear';S.masteryAttacks.thrust=120;Math.random=()=>.96;victim.equipment.weapon='athena_spear'`);assert(run('actorAttack(S,victim,now).guarded'));run('victim.equipment={}');assert(!run('actorAttack(S,victim,now).guarded'));
 run(`S.equipment.weapon='gungnir';S.st=0;applyCriticalWeaponEffects(S,victim,true,now)`);assert.equal(run('S.st'),40);
 run(`S.equipment.weapon='dragon_checkmate';S.equipmentEffects.weapon=equipmentInstanceEffects('dragon_checkmate');Math.random=()=>0;applyCriticalWeaponEffects(S,victim,true,now);recordWeaponUse(S,'thrust',now)`);assert.equal(run('victim.injuryUntil'),run('now+5000'));assert.equal(run('equipmentState(S,"weapon").durability'),10);
 run(`S.equipment.weapon='tonbokiri';S.equipmentEffects.weapon=equipmentInstanceEffects('tonbokiri');var before=totalStat('attack');awardDefeatXp(S,{kind:'bird',level:1},now);awardDefeatXp(S,victim,now)`);assert.equal(run('equipmentState(S,"weapon").bonusAttack'),7);assert(run('totalStat("attack")>=before+7'));
});
test('new skills and thrust routes work for COMs without inspecting hidden opponents',()=>{
 const {run}=setup('kaito');run(`initializeComActors(PLAYABLE_CHARACTERS.length-1);var a=comActors.find(x=>x.character==='miroku');a.place='森林区画';a.equipment.weapon='practice_spear';a.equipmentEffects={weapon:equipmentInstanceEffects('practice_spear')};a.bag=[];syncInventory(a);var plan=comPlan(a,'machine_spear')`);assert(run('plan.missing.survival_knife>0'));assert(run('plan.missing.bamboo_pole>0'));assert.equal(run('comWeaponTypes(a)[0]'),'thrust');run("a.bag=[{id:'survival_knife',count:1}];syncInventory(a);comEquipBetter(a,now)");assert.equal(run('a.preferredWeaponType'),'thrust');assert.equal(run('comWeaponTypes(a)[0]'),'thrust');
 run(`a=comActors.find(x=>x.character==='raz');a.place='山岳区画';a.hp=actorMax(a,'hp');a.st=100;var c=createCorpse('player','死体','森林区画',[],now);SKILL_BEHAVIORS.death_scent.execute(a,now);stepCom(a,now+1000)`);assert.equal(run('a.place'),'森林区画');run('stepCom(a,now+2000)');assert.equal(run('a.scavengerStacks'),1);
});

test('death scent boosts only the first corpse discovery, including later corpses; markers persist without guarantees',()=>{
 const {run}=setup('raz');
 run(`var first=createCorpse('player','印1',S.place,[],now),second=createDroneCorpse('bird','森林区画',now);var firstBase=corpseDiscoveryRate(first,S),secondBase=corpseDiscoveryRate(second,S);SKILL_BEHAVIORS.death_scent.execute(S,now);var later=createDroneCorpse('fish',S.place,now);`);
 assert.equal(run('corpseDiscoveryRate(later,S)'),1);
 run('discoverCorpseFor(S,later,now)');assert.equal(run('S.scentDiscoveryBoost'),false);
 assert.equal(run('corpseDiscoveryRate(first,S)'),run('firstBase'));
 assert.equal(run('corpseDiscoveryRate(second,S)'),run('secondBase'));
 assert.equal(run('markedLocalCorpse(S,now)'),null);assert(run('scentAreas(S,now).includes("森林区画")'));
 assert.equal(run('S.scavengerStacks||0'),0);
 run('SKILL_BEHAVIORS.death_scent.execute(S,now+60000);discoverCorpseFor(S,first,now+60000)');
 assert.equal(run('S.scentDiscoveryBoost'),false);assert.equal(run('S.scavengerStacks'),1);
 assert.equal(run('corpseDiscoveryRate(second,S)'),run('secondBase'));
});
test('COM corpse discovery consumes its own single boost without consuming player boost',()=>{
 const {run}=setup('raz');run(`var a=comActors[0];a.character='raz';a.characterFieldReadyAt=0;var c=createCorpse('player','死体',a.place,[],now);SKILL_BEHAVIORS.death_scent.execute(a,now);SKILL_BEHAVIORS.death_scent.execute(S,now);discoverCorpseFor(a,c,now)`);
 assert.equal(run('a.scentDiscoveryBoost'),false);assert.equal(run('S.scentDiscoveryBoost'),true);assert.equal(run('a.scavengerStacks'),1);
});
