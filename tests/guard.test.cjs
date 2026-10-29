// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


let h,run;function fresh(){h=harness();run=h.run;run("matchClock.section=1;matchClock.competitive=true;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];var a=comActors[0];a.place=S.place;a.hp=10000;a.nextActionAt=Date.now()+180000;S.character='hayate';S.masteryAttacks={fist:0,slash:0,hammer:0,bow:0,gun:0};a.masteryAttacks={...S.masteryAttacks};attackRoll=()=>0;rollCritical=()=>false;Math.random=()=>0");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Each weapon and bare hands contact for half of the same ordinary attack when guarded.
for(const weapon of [null,'practice_gauntlet','wood_sword','wood_mallet','japanese_bow','handgun']){
 fresh();run(`S.equipment.weapon=${JSON.stringify(weapon)};S.equipmentAmmo.weapon=20;var ordinary=actorAttack(S,a,Date.now())`);const full=run('ordinary.damage');
 fresh();run(`S.equipment.weapon=${JSON.stringify(weapon)};S.equipmentAmmo.weapon=20;Math.random=()=>.999;var guarded=actorAttack(S,a,Date.now())`);eq('guarded.hit',true);eq('guarded.guarded',true);eq('guarded.critical',false);eq('guarded.damage',Math.max(1,Math.floor(full/2)));eq('S.matchStats.guardedAttacks',1);eq('a.matchStats.guards',1);
}
// Exact old accuracy boundary decides guard instead of missing; equipment reduces guard chance.
fresh();run("S.equipment.weapon='japanese_bow';S.equipmentAmmo.weapon=20;Math.random=()=>.849999;var first=actorAttack(S,a,Date.now())");eq('first.guarded',false);
fresh();run("S.equipment.weapon='japanese_bow';S.equipmentAmmo.weapon=20;Math.random=()=>.85;var blocked=actorAttack(S,a,Date.now())");eq('blocked.guarded',true);
fresh();run("S.equipment.weapon='japanese_bow';S.equipment.accessory='optical_sight';S.equipmentAmmo.weapon=20;Math.random=()=>.85;var first=actorAttack(S,a,Date.now())");eq('first.guarded',false);
// Guard cannot roll critical, even if crit would otherwise be forced.
fresh();run("rollCritical=()=>{throw Error('guard must not roll critical')};Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.critical',false);
// Total damage includes the eruption before halving; ammo/attack counters/mastery still advance once.
fresh();run("S.equipment.weapon='magma_blaster';S.equipmentAmmo.weapon=8;equipmentState(S,'weapon').attacks=2;Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.effect.fixedDamage',15);eq('result.damage',21);eq('S.equipmentAmmo.weapon',7);eq('S.masteryAttacks.gun',1);eq('equipmentState(S,"weapon").attacks',0);
// Minimum one damage after armor, never zero.
fresh();run("S.equipment={};a.level=15;a.equipment={head:'steampunk_goggles',arm:'obsidian_armguard',body:'charged_suit',legs:'diamond_boots',accessory:'mythic_telescope'};Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.damage',1);
// Contact effects and active skills continue on a guard; lifesteal uses actual reduced HP loss.
fresh();run("S.equipment.weapon='blizzard_cannon';S.equipmentAmmo.weapon=4;Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.guarded',true);eq('result.effect.frozen',true);eq('a.frozenUntil',1004000);
fresh();run("S.equipment.weapon='assassin_knife';Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.effect.poison',true);eq('statusStacks("purplePoison",a)',1);
fresh();run("S.equipment.weapon='eros_bow';S.equipmentAmmo.weapon=16;S.hp=100;Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.healing',Math.ceil(run('result.dealt')*.05));
fresh();run("S.character='kaito';Math.random=()=>.999;var result=actorAttack(S,a,Date.now(),false,'step_break')");eq('result.characterSkill.applied',true);eq('a.slowUntil',1005000);
// A guarded drone strike also damages, consumes ammo, and gives a normal single counterattack.
fresh();run("S.equipment.weapon='handgun';S.equipmentAmmo.weapon=1;var d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:S.place});Math.random=()=>.999;var result=strikeDrone(S,d,Date.now())");eq('result.guarded',true);eq('result.damage',8);eq('S.equipmentAmmo.weapon',0);eq('result.counter',18);eq('S.matchStats.droneAttacks',1);
// COM attacks and incoming notification use the same guard result and real damage.
fresh();run("a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;Math.random=()=>.999;var result=actorAttack(a,S,Date.now());showIncomingDamage(a,result,Date.now());logPlayerAttack(a,S,result,Date.now())");eq('result.guarded',true);assert(run("$('incomingText').textContent.includes('ガード')"));assert(run('a.history.at(-1).text.includes("ガード")'));
// COM estimates no longer treat guards as zero; forecasting consumes no randomness.
fresh();run("Math.random=()=>{throw Error('forecast rolled')};var estimate=evaluateCombat(S,a,Date.now())");assert(run('estimate.turns>0'));
// Guard kills still award XP and finalize a single corpse.
fresh();run("a.hp=1;Math.random=()=>.999;var result=playerCombatRound(S,a,Date.now())");eq('result.first.guarded',true);eq('a.hp',0);eq('S.matchStats.killXp',10);eq('corpses.filter(c=>c.ownerId===a.id).length',1);
console.log('PASS: all weapon types guard for half, probability/equipment edges, no guard crit, total fixed damage halving, minimum1, effects/skill/lifesteal/ammo/mastery, drone and COM parity, logs, forecast and kill XP');
