// Combat economy, recovery preparation and closure-safe COM movement regressions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 const elements=new Map(),timers=[];
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return 1000000}},getComputedStyle:()=>({backgroundImage:''}),timers,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext('Math.random=()=>.5',context);
 vm.runInContext(source,context);vm.runInContext('startSelectedCharacter()',context);
 const run=s=>vm.runInContext(s,context);
 run(`matchClock.section=1;matchClock.sectionEndsAt=9000000;matchClock.blocked=[];matchClock.nextBlocked=[];
 S.place='山岳区画';S.bag=[];syncInventory();S.equipment={};S.equipmentAmmo={};S.equipmentEffects={};S.hp=100000;S.st=100;
 var target=comActors[0];target.place=S.place;target.hp=100000;target.equipment={};target.equipmentEffects={};
 var d=drones.bird;Object.assign(d,{spawned:true,hp:100000,area:S.place,generation:1});`);
 return run;
}

const run=harness();
run(`var a=target;Object.assign(a,{character:'bjorn',level:15,preferredWeaponType:'hammer',equipment:{weapon:'super_drying_pole'},equipmentEffects:{},masteryAttacks:{hammer:85},bodyInjuries:{},inventory:{},bag:[],characterSkillReadyAt:0});a.hp=actorMax(a,'hp');a.st=100;
S.character='raku';S.level=15;S.equipment={weapon:'plasma',body:'mad_doctor_gown'};S.equipmentEffects={};S.bodyInjuries={};S.hp=actorMax(S,'hp');S.st=100;
var normal=evaluateCombat(a,S,1000000).perHit;`);
const eq=(s,v)=>assert.equal(run(s),v,s);
// High-health target: use normal attacks first, preserving the injury cooldown.
eq("comCharacterSkill(a,1000000,S)",null);
// A surviving target crosses the half-HP threshold with the active strike.
run('S.hp=Math.floor(actorMax(S,"hp")/2+normal*.5)');
eq("comCharacterSkill(a,1000000,S)",'physics_blow');
// Ordinary one-hit kills save the skill; the extra 10% can secure a close finish.
run('S.hp=normal');eq("comCharacterSkill(a,1000000,S)",null);
run('S.hp=normal+1');eq("comCharacterSkill(a,1000000,S)",'physics_blow');
// Injury setups require enough stamina and health to exploit the result.
run('S.hp=Math.floor(actorMax(S,"hp")/2+normal*.5);a.st=0');eq("comCharacterSkill(a,1000000,S)",null);
run('a.st=100;a.hp=30');eq("comCharacterSkill(a,1000000,S)",null);
run('a.hp=actorMax(a,"hp");a.characterSkillReadyAt=1100000');eq("comCharacterSkill(a,1000000,S)",null);
run('a.characterSkillReadyAt=0;d.hp=DRONE_DEFS.bird.hp');eq("comCharacterSkill(a,1000000,d,'drone')",null);
// Execute the real attack: the injury creates a short, local pursuit opportunity.
run('S.hp=Math.floor(actorMax(S,"hp")/2+normal*.5);Math.random=()=>.5;var result=actorAttack(a,S,1000000,false,comCharacterSkill(a,1000000,S))');
assert(run('!!result.bodyInjury'));eq('comShouldPressInjury(a,1000001)',true);
eq('comShouldPressInjury(a,1008000)',false);
run('a.locationVersion=(a.locationVersion||0)+1');eq('comShouldPressInjury(a,1000001)',false);
run('a.locationVersion--;a.st=0');eq('comShouldPressInjury(a,1000001)',false);
// StepCom pays for a fresh random search, without inheriting the injured target.
run(`a.st=100;a.hp=actorMax(a,'hp');a.opponent=null;a.enemy=null;a.damageNotice=null;a.loot=null;matchClock.competitive=true;matchClock.nextBlocked=[];var searches=a.matchStats.searches||0;stepCom(a,1000001)`);
eq('a.matchStats.searches',run('searches+1'));
assert(run("!a.opponent||a.opponent.source==='search'"));
console.log('PASS: injury timing, finisher exception, cooldown/stamina/HP safeguards, small-drone conservation, real injury and paid local pursuit.');
