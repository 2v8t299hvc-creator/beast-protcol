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






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.character='snow_leopard';S.equipment={weapon:'practice_gauntlet'};S.masteryAttacks={fist:0,slash:0,hammer:0,bow:0,gun:0};S.st=0;var a=comActors[4];a.place=S.place;a.hp=180;a.equipment={};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Footwork counts completed ordinary/stock/encounter searches through the shared hook.
fresh();run('for(let i=0;i<9;i++)recordExploration(S,1000000+i)');eq('S.st',0);eq('S.footworkSearches',9);run('recordExploration(S,1000010)');eq('S.st',10);eq('S.footworkSearches',0);run('for(let i=0;i<20;i++)recordExploration(S,1000020+i)');eq('S.st',30);
run('S.st=119;for(let i=0;i<10;i++)recordExploration(S,1000100+i)');eq('S.st',120);eq('S.footworkSearches',0);
fresh();run("S.character='kaito';for(let i=0;i<10;i++)recordExploration(S,1000000+i)");eq('S.st',0);
fresh();run("var c=comActors[1];c.st=0;for(let i=0;i<10;i++)recordExploration(c,1000000+i)");eq('c.st',10);
// 110% applies to the single attack; crit chance scales from the ordinary rate to total40%.
fresh();run('var normal=actorAttack(S,a,1000000).damage;a.hp=180;var result=actorAttack(S,a,1000000,false,\'white_target\')');eq('result.damage',Math.floor(run('normal')*1.1));eq('S.characterSkillReadyAt',1060000);eq('result.characterSkill.criticalChance',.4);
run("a.hp=90;var chance=whiteTargetCriticalChance(S,a)");assert(Math.abs(run('chance')-.215)<1e-12);
for(const [roll,crit] of [[.599999,false],[.6,true]]){fresh();run(`Math.random=()=>${roll};var result=actorAttack(S,a,1000000,false,'white_target')`);eq('result.critical',crit)}
fresh();run("a.hp=1;var result=actorAttack(S,a,1000000,false,'white_target')");eq('a.hp',0);eq('S.characterSkillReadyAt',1005000);eq('comCharacterSkill(S,1004999)',null);eq('comCharacterSkill(S,1005000)','white_target');
fresh();run("Math.random=()=>.999;var result=actorAttack(S,a,1000000,false,'white_target')");eq('result.guarded',true);eq('result.critical',false);
fresh();run("var d=drones.bird;Object.assign(d,{spawned:true,hp:1,area:S.place});var result=strikeDrone(S,d,1000000,'white_target')");eq('S.characterSkillReadyAt',1005000);eq('result.defeated',true);
fresh();run("a.place='森林区画';var result=actorAttack(S,a,1000000,false,'white_target')");eq('result',null);eq('S.characterSkillReadyAt||0',0);
// Field skill draws one item, preserves CT and bag atomically on failure, and resets exactly at45sec.
for(const [roll,item] of [[0,'herb'],[.499999,'herb'],[.5,'small_flower'],[.999,'small_flower']]){fresh();run(`S.character='bjorn';S.bag=[];syncInventory(S);Math.random=()=>${roll};var ok=gatherHerbs(S,1000000)`);eq('ok',true);eq(`S.inventory.${item}`,1);eq('S.characterFieldReadyAt',1045000);eq('gatherHerbs(S,1044999)',false);eq('gatherHerbs(S,1045000)',true)}
fresh();run("S.character='bjorn';S.bag=Array.from({length:6},()=>({id:'wood',count:10}));syncInventory(S);var ok=gatherHerbs(S,1000000)");eq('ok',false);eq('S.characterFieldReadyAt||0',0);eq('S.bag.length',6);
// Physics Blow checks post-hit HP, including targets already <=50%; lethal hits do not injure corpses.
for(const [hp,injured] of [[150,false],[100,true],[90,true],[1,false]]){fresh();run(`S.character='bjorn';combatDamage=()=>20;a.hp=${hp};var result=actorAttack(S,a,1000000,false,'physics_blow')`);eq('result.damage',22);eq('hasBodyInjury(a,"head")',injured);eq('S.characterSkillReadyAt',1100000)}
fresh();run("S.character='bjorn';combatDamage=()=>20;a.hp=101;var result=actorAttack(S,a,1000000,false,'physics_blow')");eq('a.hp',79);eq('hasBodyInjury(a,"head")',true);
fresh();run("S.character='bjorn';combatDamage=()=>20;a.hp=100;Math.random=()=>.999;var result=actorAttack(S,a,1000000,false,'physics_blow')");eq('result.guarded',true);eq('hasBodyInjury(a,"leg")',true);
fresh();run("S.character='bjorn';var d=drones.bird;Object.assign(d,{spawned:true,hp:26,area:S.place});damageToDrone=()=>20;var result=strikeDrone(S,d,1000000,'physics_blow')");eq('hasBodyInjury(d,"head")',true);
// Actual COM entry points activate both new skills; Bjorn also gathers in the field.
fresh();run("matchClock.competitive=true;handleComCombatDecision=()=>false;var c=comActors[1];c.place=S.place;c.hp=180;observeOpponent(c,S,1000000);comFightOpponent(c,1000000)");eq('c.characterSkillReadyAt',1060000);
fresh();run("var c=comActors[2];c.place=S.place;c.bag=[];syncInventory(c);stepCom(c,1000000)");eq('c.inventory.herb',1);eq('c.characterFieldReadyAt',1045000);
fresh();run("S.character='bjorn';renderCharacterSkills(1000000)");eq("$('characterPassive').hidden",true);eq("$('characterFieldBtn').hidden",false);assert(run("$('characterSkillBtn').title.includes('100秒')"));
console.log('PASS: Footwork counts/cap/COM, White Target 110%/crit curve/boundaries/kill5sec/guard/drone/cancel, field odds/cap/CT, Physics Blow post-hit threshold/injuries/guard/drones, real COM activation and UI');
