const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},setAttribute(k,v){this[k]=v},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext("globalThis.seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}",context);
 vm.runInContext(source,context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.character='bat';S.equipment={weapon:'practice_bow'};S.equipmentAmmo={weapon:20};S.masteryAttacks={fist:0,slash:0,hammer:0,bow:0,gun:0};var a=comActors[0];a.place=S.place;a.hp=10000;a.equipment={};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;combatDamage=()=>20;var day=matchClock.startedAt+30000,night=day+360000;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Temporal effects use the supplied action time, even when wall time is still daytime.
fresh();eq('isNightAt(night-1)',false);eq('isNightAt(night)',true);eq('actorCriticalChance(S,"bow",night-1)',.03);eq('actorCriticalChance(S,"bow",night)',.05);run('var dayRate=actorDiscoveryRate(S,a,night-1),nightRate=actorDiscoveryRate(S,a,night)');assert(Math.abs(run('dayRate-nightRate')-.07)<1e-12);eq('actorDiscoveryRate(a,S,night)',run('dayRate'));
for(const [time,shots,damage,multi] of [['day',6,30,.25],['night',8,32,.2]]){
 fresh();run(`var result=actorAttack(S,a,${time},false,'danse_macabre')`);eq('result.shots.length',shots);eq('result.damage',damage);eq('S.equipmentAmmo.weapon',20-shots);eq('S.masteryAttacks.bow',shots);eq('S.xp',shots);eq('S.matchStats.pvpAttacks',shots);eq('result.characterSkill.multiplier',multi);eq('S.characterSkillReadyAt',run(time)+60000);eq('actorAttack(S,a,'+time+'+59999,false,"danse_macabre")',null);
}
// Ammo, invalid equipment, early defeat and unlimited weapons have no phantom shots/fist fallback.
fresh();run("S.equipmentAmmo.weapon=2;var result=actorAttack(S,a,day,false,'danse_macabre')");eq('result.shots.length',2);eq('result.damage',10);eq('S.equipmentAmmo.weapon',0);eq('S.masteryAttacks.fist',0);
for(const weapon of [null,'practice_gauntlet','practice_sword','practice_hammer']){fresh();run(`S.equipment.weapon=${JSON.stringify(weapon)};var result=actorAttack(S,a,day,false,'danse_macabre')`);eq('result',null);eq('S.characterSkillReadyAt||0',0);eq('S.masteryAttacks.bow',0)}
fresh();run("S.equipmentAmmo.weapon=0;var result=actorAttack(S,a,day,false,'danse_macabre')");eq('result',null);eq('S.characterSkillReadyAt||0',0);
fresh();run("a.hp=6;var result=actorAttack(S,a,day,false,'danse_macabre')");eq('result.shots.length',2);eq('result.dealt',6);eq('S.equipmentAmmo.weapon',18);
fresh();run("S.equipment.weapon='laser_rifle';S.equipmentAmmo.weapon=0;var result=actorAttack(S,a,night,false,'danse_macabre')");eq('result.shots.length',8);eq('S.masteryAttacks.gun',8);eq('weaponAmmo(S.equipment.weapon,S.equipmentAmmo.weapon)',Infinity);
// Independent per-shot guard and crit draws, plus single ammo/mastery/event accounting.
fresh();run("var critCalls=0;rollCritical=()=>++critCalls%2===0;var result=actorAttack(S,a,day,false,'danse_macabre')");eq('critCalls',6);eq('result.shots.filter(x=>x.critical).length',3);
fresh();run("Math.random=()=>.999;rollCritical=()=>{throw Error('guarded shot rolled crit')};var result=actorAttack(S,a,night,false,'danse_macabre')");eq('result.guarded',true);eq('result.shots.length',8);eq('result.damage',16);eq('S.matchStats.guardedAttacks',8);
// Weapon attack-count effects run per shot; the volley receives only one drone counter.
fresh();run("S.equipment.weapon='magma_blaster';S.equipmentAmmo.weapon=8;var d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:S.place});damageToDrone=()=>20;var result=strikeDrone(S,d,day,'danse_macabre')");eq('result.shots.length',6);eq('result.effect.fixedDamage',30);eq('equipmentState(S,"weapon").attacks',0);eq('S.equipmentAmmo.weapon',2);eq('result.counter',18);eq('S.hp',162);eq('S.matchStats.damageTaken',18);
fresh();run("var d=drones.bird;Object.assign(d,{spawned:true,hp:6,area:S.place});damageToDrone=()=>20;var result=strikeDrone(S,d,day,'danse_macabre')");eq('result.shots.length',2);eq('result.counter',0);eq('result.defeated',true);eq('corpses.filter(x=>x.kind==="drone").length',1);eq('S.matchStats.killXp',30);
// Delayed counters are also scheduled once, not once per shot.
fresh();run("var d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:S.place,slowUntil:day+5000,slowActionDelayMs:500});damageToDrone=()=>20;var result=strikeDrone(S,d,day,'danse_macabre')");eq('result.counterPending',true);eq('delayedDroneCounters.length',1);
// Real player and COM attack entry points execute one volley on their normal action interval.
fresh();run("matchClock.competitive=true;discoverOpponent(a);useCharacterSkill()");h.advance(1000);eq('S.equipmentAmmo.weapon',14);eq('S.matchStats.pvpAttacks',6);eq('S.characterSkillReadyAt',1061000);
fresh();run("matchClock.competitive=true;handleComCombatDecision=()=>false;var c=comActors[5];c.place=S.place;c.equipment={weapon:'practice_gun'};c.equipmentAmmo.weapon=3;observeOpponent(c,S,1000000);comFightOpponent(c,1000000)");eq('c.characterSkillReadyAt',1060000);eq('c.equipmentAmmo.weapon',0);eq('c.matchStats.pvpAttacks',3);eq('comCharacterSkill(c,1060000)',null);
fresh();run("S.equipmentAmmo.weapon=0;S.enemy=true;renderCharacterSkills(day)");eq("$('characterSkillBtn').disabled",true);
console.log('PASS: Nox timestamped night stealth/crit, day6/night8 volleys, ammo/equipment/kill/CT, unlimited ammo, per-shot guard/crit/mastery/XP/weapon effects, one drone counter and corpse, actual player/COM and UI');
