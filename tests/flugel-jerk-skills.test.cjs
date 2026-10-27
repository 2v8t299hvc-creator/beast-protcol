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






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.character='flugel';S.equipment={weapon:'practice_gauntlet'};S.masteryAttacks={fist:0,slash:0,hammer:0,bow:0,gun:0};var a=comActors[0];a.place=S.place;a.hp=10000;a.equipment={};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;combatDamage=()=>20;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Every sixth completed search (not attempted/cancelled search), shared by normal and stock search.
fresh();run('var flags=[];for(let i=0;i<12;i++){recordExploration(S,1000000+i);flags.push(consumeEfficiency(S))}');assert.deepEqual(JSON.parse(run('JSON.stringify(flags)')),[false,false,false,false,false,true,false,false,false,false,false,true]);eq('S.efficiencySearches',0);eq('consumeEfficiency(S)',false);
fresh();run("S.efficiencySearches=5;primary();S.actionToken++");h.tickAction();eq('S.efficiencySearches',5);
fresh();run("S.efficiencySearches=5;S.st=20;Object.assign(drones.bird,{spawned:true,hp:50,area:S.place});primary()");h.tickAction();eq('S.enemy',false);eq('S.discoveryQueue.length',2);eq('new Set([S.pendingFound,...S.discoveryQueue].map(x=>x.uid)).size',3);eq('S.st',17);eq('S.efficiencySearches',0);eq('S.matchStats.multiSearches',1);
fresh();run("S.efficiencySearches=5;var obj=regionObjects[S.place].find(o=>!o.taken);pushStock(obj);takeFound(0)");h.tickAction();eq('S.pendingFound.uid',run('obj.uid'));eq('S.discoveryQueue.length',2);eq('new Set([S.pendingFound,...S.discoveryQueue].map(x=>x.uid)).size',3);
fresh();run("S.efficiencySearches=5;var objs=regionObjects[S.place];for(const o of objs)o.taken=true;objs[0].taken=objs[1].taken=false;primary()");h.tickAction();eq('S.discoveryQueue.length',1);eq('S.pendingFound.taken',false);
fresh();run("S.efficiencySearches=5;for(const o of regionObjects[S.place])o.taken=true;primary()");h.tickAction();eq('S.pendingFound',null);eq('S.discoveryQueue.length',0);eq('S.efficiencySearches',0);
fresh();run("var c=comActors[3];c.place=S.place;c.hp=180;c.st=120;c.bag=[];syncInventory(c);c.efficiencySearches=5;c.equipment={weapon:'practice_sword'};c.enemy=c.opponent=c.loot=null;comCurrentPlan=()=>({id:null,missing:{},needed:{},crafts:[]});comEquipBetter=()=>false;comWants=()=>true;Object.assign(drones.bird,{spawned:true,hp:50,area:c.place});stepCom(c,1000000)");eq('c.enemy',null);eq('c.bag.reduce((n,x)=>n+x.count,0)',3);eq('c.efficiencySearches',0);
// Une Deux itself deals75%, and only subsequent attacks by the source get damage+70% / crit+25points.
fresh();run("var result=actorAttack(S,a,1000000,false,'une_deux')");eq('result.damage',15);eq('S.characterSkillReadyAt',1080000);eq('a.postureBreaks[S.id]',1006000);run('var follow=actorAttack(S,a,1000001)');eq('follow.damage',34);eq('postureBonus(S,a,1005999)',true);eq('postureBonus(S,a,1006000)',false);run('var expired=actorAttack(S,a,1006000)');eq('expired.damage',20);
fresh();run("actorAttack(S,a,1000000,false,'une_deux');var third=comActors[1];third.place=S.place;var result=actorAttack(third,a,1000001)");eq('result.damage',20);eq('attackCriticalChance(third,"fist",null,a,1000001)',.03);eq('attackCriticalChance(S,"fist",null,a,1000001)',.28);
for(const [rng,crit] of [[.719999,false],[.72,true]]){fresh();run(`actorAttack(S,a,1000000,false,'une_deux');Math.random=()=>${rng};var result=actorAttack(S,a,1000001)`);eq('result.critical',crit)}
fresh();run("actorAttack(S,a,1000000,false,'une_deux');Math.random=()=>.999;var result=actorAttack(S,a,1000001)");eq('result.guarded',true);eq('result.critical',false);eq('result.damage',17);
fresh();run("Math.random=()=>.999;var result=actorAttack(S,a,1000000,false,'une_deux')");eq('result.damage',7);eq('a.postureBreaks[S.id]',1006000);
fresh();run("var d=drones.bird;Object.assign(d,{spawned:true,hp:50,area:S.place});damageToDrone=()=>20;var result=strikeDrone(S,d,1000000,'une_deux');var follow=strikeDrone(S,d,1000001)");eq('result.damage',15);eq('follow.damage',34);eq('S.characterSkillReadyAt',1080000);
fresh();run("a.place='森林区画';var result=actorAttack(S,a,1000000,false,'une_deux')");eq('result',null);eq('S.characterSkillReadyAt||0',0);
// All five water areas and land boundaries, with hand penalties and no sticky bonus after leaving.
for(const area of ['海岸区画','港湾区画','湖畔区画','水没施設区画','海底研究区画','山岳区画','地下機構区画']){
 fresh();run(`S.character='jerk';S.place=${JSON.stringify(area)};S.equipment={weapon:'practice_gauntlet',head:'goggles'};var atk=totalStat('attack',S),def=totalStat('defense',S);S.character='kaito';var normalAtk=totalStat('attack',S),normalDef=totalStat('defense',S)`);const water=run(`isWaterArea(${JSON.stringify(area)})`);eq('atk',run('normalAtk')*(water?1.1:1));eq('def',run('normalDef')*(water?1.1:1));
}
fresh();run("S.character='jerk';S.place='海岸区画';a.place=S.place;var result=actorAttack(S,a,1000000,false,'outlaw_bite')");eq('result.damage',26);eq('S.characterSkillReadyAt',1090000);eq('a.biteUntil',1003000);eq('isMovementLocked(a,1002999)',true);eq('isMovementLocked(a,1003000)',false);
fresh();run("S.character='jerk';var result=actorAttack(S,a,1000000,false,'outlaw_bite')");eq('result.damage',22);eq('a.biteUntil',1003000);
fresh();run("S.character='jerk';Math.random=()=>.999;actorAttack(S,a,1000000,false,'outlaw_bite')");eq('a.biteUntil',1003000);
// Movement is blocked atomically for player/COM, but attacks, searches and disengagement remain possible.
fresh();run("S.biteUntil=1003000;var st=S.st;move('森林区画')");eq('S.place','山岳区画');eq('S.st',run('st'));run('var result=actorAttack(S,a,1000000)');eq('result.damage',20);run('primary()');h.tickAction();eq('S.ticks',1);h.setNow(1003000);run("S.pendingFound=null;S.discoveryQueue=[];closeModal();S.busy=false;S.enemy=false;move('森林区画')");eq('S.place','森林区画');
fresh();run("a.hp=180;a.biteUntil=1003000;var place=a.place,st=a.st;var moved=comMove(a,1002999,'test')");eq('moved',false);eq('a.place',run('place'));eq('a.st',run('st'));eq('safeComRetreat(a,1002999)',false);eq('safeComRetreat(a,1003000)',true);run("var moved=comMove(a,1003000,'test')");eq('moved',true);
fresh();run("matchClock.competitive=true;discoverOpponent(a);S.biteUntil=1003000;escapeOpponent()");eq('S.enemy',false);eq('S.place','山岳区画');eq('isMovementLocked(S,1000000)',true);
// Fish heals once, capped at maxHP, including max level; it is independent of location and other drone kills.
fresh();run("S.character='jerk';S.level=15;S.hp=30;var d=drones.fish;Object.assign(d,{spawned:true,hp:1,area:S.place});var result=strikeDrone(S,d,1000000)");eq('result.marineHealing',150);eq('S.hp',180);eq('strikeDrone(S,d,1000001)',null);eq('S.hp',180);
fresh();run("S.character='jerk';S.level=15;S.hp=260;var d=drones.fish;Object.assign(d,{spawned:true,hp:1,area:S.place});var result=strikeDrone(S,d,1000000)");eq('S.hp',264);eq('result.marineHealing',4);
fresh();run("S.character='jerk';S.level=15;S.hp=30;var d=drones.bird;Object.assign(d,{spawned:true,hp:1,area:S.place});var result=strikeDrone(S,d,1000000)");eq('result.marineHealing',0);eq('S.hp',30);
// Actual COM entry points use the skills, and render helpers expose state/expiry.
fresh();run("matchClock.competitive=true;handleComCombatDecision=()=>false;var c=comActors[3];c.place=S.place;observeOpponent(c,S,1000000);comFightOpponent(c,1000000)");eq('c.characterSkillReadyAt',1080000);eq('S.postureBreaks[c.id]',1006000);
fresh();run("matchClock.competitive=true;handleComCombatDecision=()=>false;var c=comActors[4];c.place=S.place;observeOpponent(c,S,1000000);comFightOpponent(c,1000000)");eq('c.characterSkillReadyAt',1090000);eq('S.biteUntil',1003000);
fresh();run("S.biteUntil=1003000;S.postureBreaks={[a.id]:1006000};renderStatusEffects();renderCharacterSkills(1000000)");assert(run("$('statusEffects').innerHTML.includes('姿勢崩し')"));assert(run("$('statusEffects').innerHTML.includes('区域移動不可')"));eq("$('characterPassiveCount').textContent",'0/6');

// Separate sources keep separate six-second windows; retrying during cooldown cannot refresh one.
fresh();run("actorAttack(S,a,1000000,false,'une_deux');var c=comActors[3];c.place=S.place;actorAttack(c,a,1001000,false,'une_deux');actorAttack(S,a,1002000,false,'une_deux')");eq('a.postureBreaks[S.id]',1006000);eq('a.postureBreaks[c.id]',1007000);eq('postureBonus(S,a,1006000)',false);eq('postureBonus(c,a,1006000)',true);
fresh();run("S.efficiencySearches=5;S.bag=Array.from({length:6},()=>({id:'wood',count:10}));syncInventory(S);primary()");h.tickAction();eq('S.discoveryQueue.length',2);eq('S.bag.length',6);run('decideFound(false)');eq('S.discoveryQueue.length',1);eq('S.bag.length',6);
fresh();run("var c=comActors[4];c.place=S.place;c.level=15;c.hp=20;var d=drones.fish;Object.assign(d,{spawned:true,hp:1,area:S.place});var result=strikeDrone(c,d,1000000,comCharacterSkill(c,1000000))");eq('c.hp',170);eq('result.marineHealing',150);eq('c.characterSkillReadyAt',1090000);
// Respawning creates a new drone with neither debuff carried over.
fresh();run("matchClock.section=2;var d=drones.bird;Object.assign(d,{spawned:false,hp:0,respawnAt:1000001,biteUntil:2000000,postureBreaks:{[S.id]:2000000}});updateDrones(1000001)");eq('d.biteUntil',0);eq('Object.keys(d.postureBreaks).length',0);
console.log('PASS: sixth-search guarantees/stock/shortage/unique physical objects/COM, source-specific posture damage/crit/expiry/guard/drone, five water areas, bite movement/allowed actions/deadlines, fish heal cap/once/max-level, real COM activation and UI');
