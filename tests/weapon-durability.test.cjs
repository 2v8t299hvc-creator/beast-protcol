// Exercise the real game script: weapon lifetime, combat timing and item-instance transfers.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 const elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return 1000000}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:()=>1,clearTimeout(){},setInterval(){},console});
 vm.runInContext('Math.random=()=>.5',context);
 vm.runInContext(source,context);vm.runInContext('startSelectedCharacter()',context);
 const run=s=>vm.runInContext(s,context);
 run(`matchClock.section=1;matchClock.sectionEndsAt=9000000;matchClock.blocked=[];matchClock.nextBlocked=[];
 S.place='山岳区画';S.bag=[];syncInventory();S.equipment={};S.equipmentAmmo={};S.equipmentEffects={};S.hp=100000;S.st=100;
 var target=comActors[0];target.place=S.place;target.hp=100000;target.equipment={};target.equipmentEffects={};
 var d=drones.bird;Object.assign(d,{spawned:true,hp:100000,area:S.place,generation:1});`);
 return run;
}
let run;function fresh(){run=harness()}const eq=(s,v)=>assert.equal(run(s),v,s);
function equip(id){run(`receive('${id}',1);equip('${id}')`)}
// A weapon's own uses, never global mastery or another copy's counter, determine wear.
fresh();equip('ragglove');eq('equipmentState(S,"weapon").durability',100);
run(`Math.random=()=>0;for(let i=0;i<10;i++)recordWeaponUse(S,'fist')`);eq('equipmentState(S,"weapon").durability',100);eq('equipmentState(S,"weapon").wearAttacks',10);
run(`recordWeaponUse(S,'fist')`);eq('equipmentState(S,"weapon").durability',90);
assert(run(`weaponDurabilityChance({wearAttacks:30,durability:100})>weaponDurabilityChance({wearAttacks:20,durability:100})`));
assert(run(`weaponDurabilityChance({wearAttacks:30,durability:20})>weaponDurabilityChance({wearAttacks:30,durability:100})`));
run(`Math.random=()=>.999999;for(let i=0;i<1000;i++)recordWeaponUse(S,'fist')`);eq('S.equipment.weapon','ragglove');eq('equipmentState(S,"weapon").durability',90);
// Exact probability distribution over ten losses (no external armor effects).
fresh();const rates=JSON.parse(run(`JSON.stringify((()=>{
 let alive=Array(11).fill(0);alive[0]=1;const rates={};
 for(let n=1;n<=80;n++){const next=Array(11).fill(0);next[10]=alive[10];for(let losses=0;losses<10;losses++){
 const p=weaponDurabilityChance({wearAttacks:n,durability:100-losses*10});next[losses]+=alive[losses]*(1-p);next[losses+1]+=alive[losses]*p;
 }alive=next;if([10,40,60,70,80].includes(n))rates[n]=alive[10];}return rates;
})())`));assert.equal(rates[10],0);assert(rates[40]<.02);assert(rates[60]>.5&&rates[60]<.6);assert(rates[70]>.85&&rates[70]<.95);assert(rates[80]>.98&&rates[80]<.999);
console.log('Break probability after 40/60/70/80 attacks:',[40,60,70,80].map(n=>(rates[n]*100).toFixed(2)+'%').join(' / '));
// Actual guarded player and COM attacks each count once; an empty ranged weapon does not wear.
for(const actor of ['S','target']){
 fresh();run(`receive('practice_sword',1,null,${actor});equipActor(${actor},${actor}.bag.findIndex(x=>x.id==='practice_sword'));equipmentState(${actor},'weapon').wearAttacks=10;Math.random=()=>.999999;var result=actorAttack(${actor},${actor==='S'?'target':'S'},Date.now())`);
 eq('result.guarded',true);eq(`equipmentState(${actor},'weapon').wearAttacks`,11);
}
fresh();equip('practice_gun');run(`S.equipmentAmmo.weapon=0;actorAttack(S,target,Date.now());strikeDrone(S,d,Date.now())`);eq('equipmentState(S,"weapon").wearAttacks',0);
// The final loaded shot still wears the gun; reloading doesn't reset its history.
run(`S.equipmentAmmo.weapon=1;actorAttack(S,target,Date.now());receive('bullets',20);reloadActor(S)`);eq('equipmentState(S,"weapon").wearAttacks',1);
// The breaking blow applies full damage and effects, then leaves no weapon/ammunition/state.
fresh();equip('magma_blaster');run(`Object.assign(equipmentState(S,'weapon'),{durability:10,wearAttacks:20,attacks:2});Math.random=()=>0;var result=actorAttack(S,target,Date.now())`);
eq('result.effect.fixedDamage',15);assert(run('result.damage>15'));eq('S.equipment.weapon',null);eq('S.equipmentAmmo.weapon',undefined);eq('S.equipmentEffects.weapon',undefined);eq('actorWeaponType(S)','fist');eq('S.matchStats.weaponsBroken',1);
run(`actorAttack(S,target,Date.now())`);eq('S.matchStats.weaponsBroken',1);
// A lethal breaking strike still grants corpse bonuses from that weapon.
fresh();equip('beast_fang');run(`Object.assign(equipmentState(S,'weapon'),{durability:10,wearAttacks:20});target.hp=1;Math.random=()=>0;var result=playerCombatRound(S,target,Date.now())`);
eq('S.equipment.weapon',null);eq(`result.corpse.items.filter(x=>x.source==='ワイルドハント').length`,2);
// Drone combat uses the same rules, including lethal hit rewards before breakage.
fresh();equip('beast_fang');run(`Object.assign(equipmentState(S,'weapon'),{durability:10,wearAttacks:20});d.hp=1;Math.random=()=>0;var result=strikeDrone(S,d,Date.now())`);
eq('result.defeated',true);eq('S.equipment.weapon',null);eq(`result.body.items.filter(x=>x.source==='ワイルドハント').length`,2);
// Existing special weapons ignore natural decay and retaliatory durability loss.
for(const id of ['amalgam_bow','super_wild_hammer','orichalcum','dragon_heart','dragon_buster','drag_eater','drag_energy_07','dragon_killer']){
 fresh();equip(id);run(`Math.random=()=>0;for(let i=0;i<200;i++)recordWeaponUse(S,equipmentDef(S.equipment.weapon).weaponType);damageEquipmentDurability(S,'weapon',1000)`);eq('S.equipment.weapon',id);eq('equipmentState(S,"weapon").durability',100);assert(run(`weaponDurabilityLabel('${id}').includes('∞')`));
}
// Both armor retaliation hooks work even within the ordinary ten-attack grace period.
for(const [weapon,slot,armor] of [['handgun','body','charged_suit'],['wood_sword','arm','steel_armguard']]){
 fresh();equip(weapon);run(`target.equipment['${slot}']='${armor}';Math.random=()=>.5;actorAttack(S,target,Date.now());actorAttack(S,target,Date.now()+1)`);eq('equipmentState(S,"weapon").durability',99);
 run(`equipmentState(S,'weapon').durability=1;actorAttack(S,target,Date.now()+100000)`);eq('S.equipment.weapon',null);
}
// A volley gets one wear roll after all shots, including when armor retaliation breaks it.
for(const drone of [false,true]){
 fresh();equip('practice_gun');run(`S.character='bat';Object.assign(equipmentState(S,'weapon'),{durability:10,wearAttacks:20});Math.random=()=>0;var volley=executeDanse(S,${drone?'d':'target'},Date.now(),${drone})`);
 assert(run('volley.shots.length>=6'));eq('S.equipment.weapon',null);eq('S.matchStats.weaponsBroken',1);
}
fresh();equip('practice_gun');run(`S.character='bat';target.equipment.body='charged_suit';equipmentState(S,'weapon').durability=1;Math.random=()=>.5;var volley=executeDanse(S,target,Date.now())`);assert(run('volley.shots.length>=6'));eq('S.equipment.weapon',null);
// Unequip, swap to the same ID, ground pickup and corpse transfer preserve the individual instance.
fresh();equip('ragglove');run(`Object.assign(equipmentState(S,'weapon'),{durability:40,wearAttacks:45});receive('ragglove',1);equipActor(S,0)`);eq('equipmentState(S,"weapon").durability',100);eq('S.bag[0].effects.durability',40);
run(`equipActor(S,0);unequip('weapon');discardStack(0);addFound(S.found.pop());decideFound(true);equip('ragglove')`);eq('equipmentState(S,"weapon").durability',40);eq('equipmentState(S,"weapon").wearAttacks',45);
run(`var body=createPlayerCorpse(S);var entry=body.items.find(x=>x.id==='ragglove'&&x.effects?.wearAttacks===45);receive(entry.id,1,entry,target);equipActor(target,target.bag.findIndex(x=>x.id==='ragglove'))`);eq('equipmentState(target,"weapon").durability',40);eq('equipmentState(target,"weapon").wearAttacks',45);
// Crafting consumes the worn ingredient; both bag and worn-input paths create a new weapon.
for(const worn of [false,true]){
 fresh();equip('ragglove');run(`Object.assign(equipmentState(S,'weapon'),{durability:20,wearAttacks:60});${worn?'':"unequip('weapon');"}receive('cloth',1);var made=craftActor(S,recipes.find(r=>r.id==='glove'))`);eq('made',true);run(`equip('glove')`);eq('equipmentState(S,"weapon").durability',100);eq('equipmentState(S,"weapon").wearAttacks',0);
}
fresh();equip('ragglove');run(`S.character='raku';S.modificationStacks=100;Object.assign(equipmentState(S,'weapon'),{durability:10,wearAttacks:70});modifyEquippedWeapon(S)`);eq('equipmentState(S,"weapon").durability',100);eq('equipmentState(S,"weapon").wearAttacks',0);
// Old items without wear metadata are safe; uninitialized natural weapons get a fresh state.
fresh();run(`S.equipment.weapon='wood_sword';S.equipmentEffects={weapon:{id:'wood_sword',bonusAttack:3}}`);eq('equipmentState(S,"weapon").durability',100);eq('equipmentState(S,"weapon").bonusAttack',3);
// Visibility and final match snapshots preserve the same condition without a shallow alias.
run(`equipmentState(S,'weapon').durability=20;showEquipment();refresh();var snap=snapshotMatchActor(S);equipmentState(S,'weapon').durability=10`);assert(run(`$('modalBody').innerHTML.includes('耐久20/100・破損注意')`));assert(run(`$('weapon').textContent.includes('耐久20/100')`));eq('snap.equipmentEffects.weapon.durability',20);
console.log('PASS: protected early attacks; rising probabilistic wear; player/COM/PvP/drone/guard/ammo/volley timing; break fallback; immunity and armor CT; kill effects; item-instance transfers; fresh crafting/modification; UI and match snapshots.');
