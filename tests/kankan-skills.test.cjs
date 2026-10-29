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






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.character='kankan';S.equipment={weapon:'practice_gauntlet'};var a=comActors[0];a.place=S.place;a.hp=10000;a.equipment={};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Qigong adds1 per second, preserves existing weapon bonuses, clamps recovery and leaves injury time at10sec.
fresh();eq('treatmentRate(S)',3);eq('restRecoveryRate(S)',6);run("S.equipment.weapon='spirit_sword'");eq('treatmentRate(S)',run("3+EQUIPMENT_SPECIAL_EFFECTS.spirit_sword.treatmentBonus"));
fresh();run("S.hp=100;toggleRecoveryMode('hp')");h.advance(1000);eq('S.hp',103);run("S.st=0;toggleRecoveryMode('stamina')");h.advance(1000);eq('S.st',6);eq('S.hp',103);
fresh();run("S.hp=179;toggleRecoveryMode('hp')");h.advance(1000);eq('S.hp',180);eq('S.recoveryMode',null);
fresh();run("S.hp=100;S.bodyInjuries={head:{at:1}};beginBodyTreatment(S,'head',1000000);updateRecoveryMode(1009999)");eq('hasBodyInjury(S,"head")',true);run('updateRecoveryMode(1010000)');eq('hasBodyInjury(S,"head")',false);eq('S.hp',100);
// Exact currentHP40% cost (floor) -> same numeric percent attack bonus; no HP change at expiry.
for(const [hp,cost] of [[180,72],[264,105],[101,40],[3,1]]){fresh();run(`S.hp=${hp};var attack=totalStat('attack',S,1000000),defense=totalStat('defense',S,1000000);var ok=burnSpirit(S,1000000)`);eq('ok',true);eq('S.hp',hp-cost);eq('S.burningSpiritPower',cost);eq('S.burningSpiritUntil',1030000);eq('S.characterFieldReadyAt',1120000);eq('totalStat("attack",S,1000001)',run('attack')*(1+cost/100));eq('totalStat("defense",S,1000001)',run('defense'));eq('totalStat("attack",S,1030000)',run('attack'));eq('S.hp',hp-cost)}
for(const hp of [0,1,2]){fresh();run(`S.hp=${hp};var ok=burnSpirit(S,1000000)`);eq('ok',false);eq('S.characterFieldReadyAt||0',0);eq('S.hp',hp)}
fresh();run("burnSpirit(S,1000000);var oldHp=S.hp;var blocked=burnSpirit(S,1119999)");eq('blocked',false);eq('S.hp',run('oldHp'));eq('burnSpirit(S,1120000)',true);eq('S.burningSpiritPower',43);eq('S.hp',65);
// Actual damage uses action timestamp rather than the later wall clock, including empty-magazine fists.
fresh();run("var base=totalStat('attack',S,1000000);burnSpirit(S,1000000);combatDamage=(attack)=>Math.floor(attack)");h.setNow(2000000);run('var active=actorAttack(S,a,1000001),expired=actorAttack(S,a,1030000)');eq('active.damage',Math.floor(run('base')*1.72));eq('expired.damage',Math.floor(run('base')));
fresh();run("S.equipment.weapon='practice_gun';S.equipmentAmmo.weapon=0;burnSpirit(S,1000000);combatDamage=(attack)=>Math.floor(attack);var result=actorAttack(S,a,1000001)");eq('result.type','fist');eq('result.damage',Math.floor(11*1.72));
// Real field button and COM field/rest/emergency treatment paths.
fresh();run('useCharacterFieldSkill()');eq('S.hp',108);eq('S.characterFieldReadyAt',1120000);run('renderCharacterSkills(1000000);renderStatusEffects()');eq("$('characterSkillBtn').hidden",true);eq("$('characterFieldBtn').hidden",false);eq("$('characterPassiveCount').textContent",'+1');assert(run("$('statusEffects').innerHTML.includes('攻撃力＋72%')"));
fresh();run("var c=comActors[7];c.place=S.place;c.hp=180;c.st=120;stepCom(c,1000000)");eq('c.hp',108);eq('c.burningSpiritPower',72);eq('c.characterFieldReadyAt',1120000);
fresh();run("var c=comActors[7];c.place=S.place;c.hp=180;c.st=0;c.bag=[];syncInventory(c);stepCom(c,1000000)");eq('c.st',6);
fresh();run("var c=comActors[7];c.place=S.place;c.hp=1;c.st=120;c.bag=[];syncInventory(c);comRecoveryPlan=()=>null;stepCom(c,1000000)");eq('c.hp',4);
function recovery(chunk){fresh();run("S.hp=100;toggleRecoveryMode('hp')");for(let t=0;t<10000;t+=chunk)h.advance(chunk);return run('S.hp')}
assert.equal(recovery(1000),recovery(10000));eq('S.hp',130);
console.log('PASS: Kankan HP/ST recovery+1, weapon stacking/caps, unchanged injury channel, exact HP cost/attack%/30sec/120sec boundaries, timestamped damage and empty ammo, real field/COM and catch-up');
