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





let h,run;function fresh(){h=harness();run=h.run;run(`selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=true;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;var a=comActors[0];a.place=S.place;a.equipment={weapon:'practice_bow'};a.equipmentAmmo.weapon=20;a.hp=10000;S.equipment={weapon:'practice_gauntlet'};S.masteryAttacks=initialMastery('kaito');Math.random=()=>0;`)}
fresh();run("Math.random=()=>0.999;var gains=[];for(let i=0;i<5;i++){const before=S.masteryAttacks.fist;actorAttack(S,a,Date.now()+i);gains.push(S.masteryAttacks.fist-before)}");assert.deepEqual(JSON.parse(run('JSON.stringify(gains)')),[1,2,3,4,4]);assert.equal(run('S.fightingInstinct.stacks'),3);assert.equal(run('S.matchStats.masteryBonus'),9);
run("var other=comActors[1];other.place=S.place;other.hp=10000;var before=S.masteryAttacks.fist;actorAttack(S,other,Date.now())");assert.equal(run('S.masteryAttacks.fist-before'),1);run("S.equipment.weapon='wood_sword';var before=S.masteryAttacks.slash;actorAttack(S,other,Date.now())");assert.equal(run('S.masteryAttacks.slash-before'),2);
run("S.enemy=true;S.enemyPlayerId=other.id;escapeOpponent()");assert.equal(run('S.fightingInstinct'),null);
run("awardAttackMastery(S,a,'fist');move('森林区画')");assert.equal(run('S.fightingInstinct'),null);
fresh();run("var d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:S.place,generation:1});awardAttackMastery(S,d,'fist');awardAttackMastery(S,d,'fist');d.generation++;var before=S.masteryAttacks.fist;awardAttackMastery(S,d,'fist')");assert.equal(run('S.masteryAttacks.fist-before'),1);
// Active is exactly one normal attack, consumes cooldown only on a valid executed attack.
fresh();run('discoverOpponent(a);useCharacterSkill();useCharacterSkill()');assert.equal(run('S.pvpPending.skillId'),'step_break');assert.equal(run('S.characterSkillReadyAt||0'),0);h.advance(1000);
assert.equal(run('S.characterSkillReadyAt'),1061000);assert.equal(run('a.slowUntil'),1006000);assert.equal(run('a.nextActionAt'),3000500);assert.equal(run('S.masteryAttacks.fist'),10);assert.equal(run('S.hp'),180);assert.equal(run('a.hp'),9989);assert.equal(run("$('characterSkillBtn').disabled"),true);assert.equal(run("$('characterSkillCount').textContent.includes('60秒')"),true);
h.advance(5000);assert.equal(run('actionDelayMs(a,Date.now())'),0);run('discoverOpponent(a);useCharacterSkill()');assert.equal(run('S.pvpPending'),null);h.advance(55000);run('useCharacterSkill()');assert.equal(run('S.pvpPending.skillId'),'step_break');
fresh();run("Math.random=()=>0.999;var result=playerCombatRound(S,a,Date.now(),false,'step_break')");assert.equal(run('result.first.hit'),false);assert.equal(run('a.slowUntil||0'),0);assert.equal(run('S.characterSkillReadyAt'),1060000);
fresh();run("discoverOpponent(a);useCharacterSkill();a.place='森林区画'");h.advance(1000);assert.equal(run('S.characterSkillReadyAt||0'),0);assert.equal(run('S.masteryAttacks.fist'),9);assert.equal(run('S.busy'),false);
// COM actions really run at 1.5s intervals during the 5s debuff, then return to 1s.
fresh();run("a.nextActionAt=Date.now()+1000;stepCom=(actor,now)=>{actor.testActions=(actor.testActions||0)+1};applyActionSlow(a,S,CHARACTER_SKILLS.kaito.active,Date.now())");h.advance(1499);assert.equal(run('a.testActions||0'),0);h.advance(1);assert.equal(run('a.testActions'),1);assert.equal(run('a.nextActionAt'),1003000);h.advance(3000);assert.equal(run('a.testActions'),3);assert.equal(run('a.nextActionAt'),1006000);h.advance(1500);assert.equal(run('a.testActions'),4);assert.equal(run('a.nextActionAt'),1007000);
// Drone retaliation is delayed by 500ms, not removed; stale generations cannot hit.
function slowedDrone(){fresh();run("Object.assign(drones.bird,{spawned:true,hp:10000,area:S.place,generation:7});S.enemy=true;S.enemyPlayerId=null;S.enemyKind='bird';useCharacterSkill()");h.setNow(1001000);h.tickAction();}
slowedDrone();assert.equal(run('S.hp'),180);assert.equal(run('delayedDroneCounters.length'),1);h.advance(499);assert.equal(run('S.hp'),180);h.advance(1);assert.equal(run('S.hp'),163);assert.equal(run('delayedDroneCounters.length'),0);
slowedDrone();run('drones.bird.generation++');h.advance(500);assert.equal(run('S.hp'),180);
slowedDrone();run("S.enemy=false;S.busy=false;move('森林区画')");h.advance(500);assert.equal(run('S.hp'),180);
// Catch-up order includes pending player attacks, delayed drone counters and slowed COM actions.
function timeline(chunk){slowedDrone();run("a.nextActionAt=Date.now()+1000;applyActionSlow(a,S,CHARACTER_SKILLS.kaito.active,Date.now())");for(let i=0;i<9000;i+=chunk)h.advance(chunk);return run('JSON.stringify({S,comActors,drones,corpses,matchClock,delayedDroneCounters})')}
assert.equal(timeline(250),timeline(9000));
// A pending PvP hit must resolve before a later lethal drone counter during one large catch-up.
function mixedTimeline(chunk){fresh();run(`var b=comActors[1];b.place=S.place;b.hp=11;b.equipment={weapon:'practice_gun'};b.equipmentAmmo.weapon=20;b.nextActionAt=Date.now()+750;Object.assign(drones.bird,{spawned:true,hp:10000,area:S.place,generation:9,slowUntil:Date.now()+5000,slowActionDelayMs:500});stepCom=(actor,now)=>{strikeDrone(actor,drones.bird,now);actor.nextActionAt=3000000};discoverOpponent(b);useCharacterSkill()`);for(let i=0;i<2000;i+=chunk)h.advance(chunk);assert.equal(run('corpses.find(c=>c.ownerId===b.id).killerId'),run('S.id'));assert.equal(run('S.characterSkillReadyAt'),1061000);return run('JSON.stringify({S,comActors,drones,corpses,matchClock,delayedDroneCounters})')}
assert.equal(mixedTimeline(250),mixedTimeline(2000));
console.log('PASS: Kaito 1/2/3/4 mastery, target/escape/movement/generation resets, independent weapon XP, active hit/miss/cancel/CT UI, actual COM slowdown, delayed drone retaliation and background chronology');

fresh();run('renderCharacterSkills()');assert.equal(run("$('characterPassiveCount').textContent"),'0/3');run('S.fightingInstinct={targetKey:skillTargetKey(a),stacks:3};renderCharacterSkills()');assert.equal(run("$('characterPassiveCount').textContent"),'3/3');assert.equal(run("$('characterPassive').classList.contains('is-max')"),true);assert.equal(run("$('characterSkillCount').textContent"),'発動');
