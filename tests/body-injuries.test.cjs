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






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;var a=comActors[4];a.place=S.place;a.hp=10000;a.equipment={};S.character='kaito';S.equipment={weapon:'steel_sword'};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;var productionRollBodyInjury=rollBodyInjury;rollBodyInjury=()=>false;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Exactly1% over equal-width RNG samples; boundary inclusive at .99.
fresh(); // Restore production helper, not the fixture override.
run('rollBodyInjury=productionRollBodyInjury;var count=0;for(let i=0;i<10000;i++){Math.random=()=>i/10000;if(rollBodyInjury())count++}');eq('count',100);run('Math.random=()=>.989999');eq('rollBodyInjury()',false);run('Math.random=()=>.99');eq('rollBodyInjury()',true);
// Ordinary actual attacks, guard attacks, and all four uniform locations.
for(const [roll,part] of [[0,'head'],[.25,'hand'],[.5,'torso'],[.75,'leg']]){fresh();run(`rollBodyInjury=()=>true;Math.random=()=>${roll};var result=actorAttack(S,a,1000000)`);eq(`hasBodyInjury(a,'${part}')`,true);eq('result.bodyInjury',part)}
fresh();run("rollBodyInjury=()=>true;Math.random=()=>.999;var result=actorAttack(S,a,1000000)");eq('result.guarded',true);eq('result.bodyInjury','leg');
fresh();run("inflictBodyInjury(S,a,1000000);var first=S.bodyInjuries.head;inflictBodyInjury(S,a,1005000);updateStatusEffects(9999999,S)");eq('Object.keys(S.bodyInjuries).length',1);eq('S.bodyInjuries.head===first',true);eq('hasBodyInjury(S,"head")',true);
// Head affects actual guard chance; hand affects total attack; torso amplifies a later hit, not its own infliction.
fresh();run("var old=actorAccuracyBonus(S);S.bodyInjuries={head:{at:1}};var now=actorAccuracyBonus(S)");eq('now-old',-10);
fresh();run("var before=totalStat('attack',S);S.bodyInjuries={hand:{at:1}}");eq('totalStat("attack",S)',run('before')*.95);
fresh();run("combatDamage=()=>20;var normal=actorAttack(S,a,1000000).damage;a.bodyInjuries={torso:{at:1}};var result=actorAttack(S,a,1000001)");eq('result.damage',Math.floor(run('normal')*1.1));
fresh();run("combatDamage=()=>20;rollBodyInjury=()=>true;Math.random=()=>.5;var first=actorAttack(S,a,1000000);var second=actorAttack(S,a,1000001)");eq('first.damage',20);eq('second.damage',22);
// Legs add1 to search/movement, still paying missing ST with HP.
fresh();run("S.bodyInjuries={leg:{at:1}};S.st=0;var hp=S.hp;paySearchCost(S,1000000);var move=payMovementCost(S,1000000)");eq('searchStaminaCost(S)',4);eq('move.hpCost',6);eq('S.hp',run('hp')-10);
// One10sec channel cures only the selected part, never passively heals HP; other wounds persist.
fresh();run("S.bodyInjuries={head:{at:1},hand:{at:1},leg:{at:1}};S.hp=100;beginBodyTreatment(S,'hand',1000000);updateRecoveryMode(1009999)");eq('hasBodyInjury(S,"hand")',true);run('updateRecoveryMode(1010000)');eq('hasBodyInjury(S,"hand")',false);eq('hasBodyInjury(S,"head")',true);eq('hasBodyInjury(S,"leg")',true);eq('S.hp',100);eq('S.bodyTreatment',null);run("beginBodyTreatment(S,'head',1010000);updateRecoveryMode(1020000)");eq('Object.keys(S.bodyInjuries).length',1);
// Cancelled/rest-switched/moved/attacked channels cannot cure later.
fresh();run("S.bodyInjuries={head:{at:1}};beginBodyTreatment(S,'head',1000000);stopRecoveryMode();updateRecoveryMode(1100000)");eq('hasBodyInjury(S,"head")',true);
fresh();run("S.bodyInjuries={head:{at:1}};S.st=0;beginBodyTreatment(S,'head',1000000);toggleRecoveryMode('stamina')");eq('S.bodyTreatment',null);
fresh();run("S.bodyInjuries={head:{at:1}};beginBodyTreatment(S,'head',1000000);move('森林区画')");eq('S.bodyTreatment',null);eq('hasBodyInjury(S,"head")',true);
fresh();run("S.bodyInjuries={head:{at:1}};beginBodyTreatment(S,'head',1000000);actorAttack(a,S,1009999,true)");eq('S.bodyTreatment',null);eq('hasBodyInjury(S,"head")',true);
// A completed cure resolves at its deadline before an attack at the same or later timestamp.
fresh();run("S.bodyInjuries={torso:{at:1}};beginBodyTreatment(S,'torso',1000000);actorAttack(a,S,1010000,true)");eq('hasBodyInjury(S,"torso")',false);
// COM channels, interruption and ten-second deadline use the supplied action time.
fresh();run("a.hp=180;a.bodyInjuries={head:{at:1},leg:{at:1}};stepCom(a,1000000);stepCom(a,1009999)");eq('hasBodyInjury(a,"head")',true);run('stepCom(a,1010000)');eq('hasBodyInjury(a,"head")',false);eq('hasBodyInjury(a,"leg")',true);eq('a.bodyTreatment.part','leg');eq('a.bodyTreatment.dueAt',1020000);
// Drones suffer the same persistent parts and reset only upon respawn; counters can also injure.
fresh();run("var d=drones.bird;Object.assign(d,{spawned:true,hp:50,area:S.place});d.bodyInjuries={hand:{at:1}};var weakened=droneCounterDamage(DRONE_DEFS.bird,S,1000000);d.bodyInjuries={};var normal=droneCounterDamage(DRONE_DEFS.bird,S,1000000)");assert(run('weakened<normal'));
fresh();run("rollBodyInjury=()=>true;var d=drones.bird;Object.assign(d,{spawned:true,hp:50,area:S.place});droneCounterDamage(DRONE_DEFS.bird,S,1000000)");eq('hasBodyInjury(S,"head")',true);
fresh();run("S.bodyInjuries={head:{at:1},leg:{at:1}};skill();renderStatusEffects()");assert(run("$('modalBody').innerHTML.includes(\"treatBodyInjury('head')\")"));assert(run("$('statusEffects').innerHTML.includes('永続')"));

// Wall-clock catch-up cures the same chosen part as frequent foreground ticks.
function playerTimeline(chunk){fresh();run("S.bodyInjuries={head:{at:1},leg:{at:1}};beginBodyTreatment(S,'head',1000000)");for(let t=0;t<10000;t+=chunk)h.advance(chunk);return run('JSON.stringify({injuries:S.bodyInjuries,treatment:S.bodyTreatment,hp:S.hp})')}
assert.equal(playerTimeline(1000),playerTimeline(10000));
function comTimeline(chunk){fresh();run("a.hp=180;a.bodyInjuries={head:{at:1},leg:{at:1}};a.nextActionAt=1000000");for(let t=0;t<10000;t+=chunk)h.advance(chunk);return run('JSON.stringify({injuries:a.bodyInjuries,treatment:a.bodyTreatment,hp:a.hp})')}
assert.equal(comTimeline(1000),comTimeline(10000));
fresh();run("matchClock.section=2;var d=drones.bird;Object.assign(d,{spawned:false,hp:0,respawnAt:1000001,bodyInjuries:{head:{at:1}}});updateDrones(1000001)");eq('d.spawned',true);eq('Object.keys(d.bodyInjuries).length',0);
console.log('PASS: exact1% normal/guard rolls, uniform4 parts, permanent/nonstacking effects, HP fallback, one-part10sec treatment, interruptions/deadlines/COM, drone parity and treatment UI');
