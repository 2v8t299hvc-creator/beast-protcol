// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext("globalThis.seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}",context);
 vm.runInContext(source,context);vm.runInContext('comActors.splice(1)',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;const eq=(s,v)=>assert.equal(run(s),v,s);
function fixture(){h=harness();run=s=>h.run(s);run(`selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];globalThis.a=comActors[0];a.place=S.place;a.starterWeapon='practice_bow';a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;a.nextActionAt=3000000;a.matchStats={};a.matchEvents=[];S.matchStats={};S.matchEvents=[];Math.random=()=>0;`)}
fixture();eq('evaluateCombat(a,S,Date.now()).action','attack');run('S.equipment.body="passion_bikini"');eq('evaluateCombat(a,S,Date.now()).action','retreat');
fixture();run('a.masteryAttacks.bow=0');eq('evaluateCombat(a,S,Date.now()).action','retreat');run('a.masteryAttacks.bow=26');eq('evaluateCombat(a,S,Date.now()).action','attack');
// Finite ammunition and reload timing matter; a low-HP finishing blow does not require a full magazine.
fixture();run('a.equipment.weapon="strong_bow";a.equipmentAmmo.weapon=1');eq('evaluateCombat(a,S,Date.now()).ammoShort',true);eq('evaluateCombat(a,S,Date.now()).action','retreat');run('receive("arrows",20,null,a)');eq('evaluateCombat(a,S,Date.now()).action','attack');run('a.equipmentAmmo.weapon=0');eq('evaluateCombat(a,S,Date.now()).action','reload');run('handleComCombatDecision(a,S,Date.now(),"player")');eq('a.equipmentAmmo.weapon',8);eq('a.inventory.arrows',12);eq('a.matchStats.reloads',1);
fixture();run('a.hp=10;S.hp=1');eq('evaluateCombat(a,S,Date.now()).action','attack');
// Recover only when available and useful; freeze/shared cooldowns remove recovery from the plan.
fixture();run('a.hp=100;S.hp=150;a.bag=[];syncInventory(a)');eq('evaluateCombat(a,S,Date.now()).action','retreat');run('receive("kit",1,null,a)');eq('evaluateCombat(a,S,Date.now()).action','heal');run('a.frozenUntil=Date.now()+4000');eq('evaluateCombat(a,S,Date.now()).action','retreat');eq('evaluateCombat(a,S,Date.now()+4000).action','heal');
run('a.frozenUntil=0;handleComCombatDecision(a,S,Date.now(),"player")');eq('a.hp',160);eq('a.inventory.kit||0',0);eq('a.matchStats.recoveryItems',1);
// Enemy private state cannot change an estimate. Pure estimates never consume ammo, items, RNG or skill state.
fixture();const before=run('JSON.stringify({a,S})'),decision=run('JSON.stringify(evaluateCombat(a,S,Date.now()))');eq('JSON.stringify({a,S})',before);run('S.bag=[{id:"kit",count:999}];S.inventory={kit:999};S.masteryAttacks={fist:250};S.equipmentAmmo.weapon=999;S.equipmentEffects={weapon:{readyAt:9999999}}');eq('JSON.stringify(evaluateCombat(a,S,Date.now()))',decision);
run('a.observedOpponents={kaito:{damage:100,weapon:S.equipment.weapon,level:S.level,defense:totalStat("defense",a),body:a.equipment.body,at:Date.now()}}');eq('evaluateCombat(a,S,Date.now()).action','retreat');
// Retreat is real movement and records the reason, but having no safe area must not cause a retreat loop.
fixture();run('S.equipment.weapon="apollo_bow";S.equipmentAmmo.weapon=16;a.opponent={id:S.id};globalThis.oldPlace=a.place;comFightOpponent(a,Date.now())');assert(run('a.place!==oldPlace'));eq('a.matchStats.retreats',1);assert(run('a.matchEvents.some(e=>e.type==="retreat")'));
fixture();run('a.hp=10;matchClock.blocked=Object.keys(regionStock).filter(x=>x!==a.place);a.bag=[];syncInventory(a);a.opponent={id:S.id};comFightOpponent(a,Date.now())');eq('a.matchStats.retreats||0',0);assert(run('a.matchStats.pvpAttacks>0||a.hp===0'));
// Drone decisions use the same supply model; no ghost attack when the target has respawned.
fixture();run('globalThis.d=drones.bird;Object.assign(d,{spawned:true,hp:50,area:a.place,generation:7});a.enemy={kind:"bird",generation:7};comFight(a,Date.now())');eq('a.matchStats.droneAttacks',1);eq('a.matchStats.damageTaken',18);eq('a.equipmentAmmo.weapon',19);
// Full, sealed report: crafting, actual HP loss, corpse stripping and post-victory looting.
fixture();run(`S.bag=[];syncInventory();receive('japanese_bow',1);receive('wood',1);craft('strong_bow','weapon');equip('strong_bow');a.equipment.weapon='azusa_bow';a.equipmentAmmo.weapon=7;a.bag=[{id:'kit',count:2}];syncInventory(a);a.hp=1;playerCombatRound(S,a,Date.now())`);
eq('matchClock.result','win');eq('S.matchStats.crafts',1);eq('S.matchStats.crafted.strong_bow',1);eq('S.matchStats.pvpAttacks',1);eq('S.matchStats.damageDealt',1);eq('S.matchStats.playerKills',1);
eq('a.equipment.weapon',null);eq('a.bag.length',0);eq('matchClock.record.actors[1].final.equipment.weapon','azusa_bow');eq('matchClock.record.actors[1].final.equipmentAmmo.weapon',7);eq('matchClock.record.actors[1].final.bag[0].id','kit');
assert(run('$("modalBody").innerHTML.includes("showMatchReport()")'));run('globalThis.savedRecord=JSON.stringify(matchClock.record);showMatchReport()');eq('$("modalTitle").textContent','📊 試合の記録');assert(run('$("modalBody").innerHTML.includes("梓弓")'));assert(run('$("modalBody").innerHTML.includes("強弓 ×1")'));
run('showMatchResult();openCorpse(a.corpseId);takeCorpseItem(0,S.corpseVisit.token);showMatchReport()');eq('S.inventory.kit',2);eq('JSON.stringify(matchClock.record)',''+run('savedRecord'));
// A loss offers the same report and preserves Kaito's pre-corpse loadout.
fixture();run('S.hp=1;a.opponent={id:S.id};comFightOpponent(a,Date.now())');eq('matchClock.result','eliminated');eq('matchClock.record.winnerId','hayate');eq('matchClock.record.actors[0].final.equipment.weapon','practice_gauntlet');eq('S.equipment.weapon',null);assert(run('$("modalBody").innerHTML.includes("showMatchReport()")'));run('showMatchReport()');eq('$("modalTitle").textContent','📊 試合の記録');
// Reports cannot expose opponents before the match ends. Bounded events retain total counters.
fixture();run('modal("test","before");showMatchReport()');eq('$("modalTitle").textContent','test');run('for(let i=0;i<250;i++){bumpMatchStat(a,"searches");recordMatchEvent(a,"decision","event"+i,Date.now())}');eq('a.matchEvents.length',200);eq('a.matchEvents[0].text','event50');eq('a.matchStats.searches',250);
// The global closure also seals both final loadouts and offers the report.
fixture();run('matchClock.section=9;matchClock.sectionEndsAt=1001000;matchClock.nextBlocked=Object.keys(regionStock)');h.advance(1000);eq('matchClock.result','draw');eq('matchClock.record.elapsed',1);eq('matchClock.record.actors[1].final.equipment.weapon','practice_bow');run('showMatchReport()');eq('$("modalTitle").textContent','📊 試合の記録');
console.log('PASS: armor/mastery/ammo-aware choices, useful recovery/freeze timing, non-cheating pure estimates, observed hits, real retreat/last-area fallback and sealed post-match stats/loadouts/timeline');
