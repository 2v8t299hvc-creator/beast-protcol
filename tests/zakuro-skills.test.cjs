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






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.character='zakuro';S.equipment={weapon:'practice_sword'};S.bag=[];syncInventory(S);S.masteryAttacks={fist:0,slash:0,hammer:0,bow:0,gun:0};var a=comActors[0];a.place=S.place;a.hp=10000;a.equipment={};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;combatDamage=()=>20;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Explicit material allowlist, all rarity tiers, exactly one consumed, atomic cooldown/invalid checks.
for(const [id,rarity,stacks] of [['stone','common',1],['bronze','uncommon',2],['steel','rare',3],['ruby','epic',5],['wonderjewel','legendary',8]]){
 fresh();run(`RECIPE_RARITY.${id}=${JSON.stringify(rarity)};receive('${id}',3,null,S);var ok=consumeMineral(S,'${id}',1000000)`);eq('ok',true);eq(`S.inventory.${id}`,2);eq('S.mineralMantleStacks',stacks);eq('S.characterFieldReadyAt',1030000);eq(`consumeMineral(S,'${id}',1029999)`,false);eq(`consumeMineral(S,'${id}',1030000)`,true);eq('S.mineralMantleStacks',stacks*2);
}
for(const id of ['wood','gold_thread','ruby_bracelet','rock_salt','practice_sword']){fresh();run(`receive('${id}',1,null,S);var ok=consumeMineral(S,'${id}',1000000)`);eq('ok',false);eq('S.characterFieldReadyAt||0',0);eq(`S.inventory.${id}`,1)}
fresh();eq('consumeMineral(S,"stone",1000000)',false);eq('S.characterFieldReadyAt||0',0);
// Defense stacks persist through time/level changes; three gems coexist and never multiply their flat bonuses.
fresh();run("receive('ruby',2,null,S);receive('sapphire',1,null,S);receive('diamond',1,null,S);var base=totalStat('defense',S);consumeMineral(S,'ruby',1000000);consumeMineral(S,'ruby',1030000);consumeMineral(S,'sapphire',1060000);consumeMineral(S,'diamond',1090000)");eq('S.mineralMantleStacks',20);eq('totalStat("defense",S)-base',20);eq('S.rubyMantle',true);eq('S.sapphireMantle',true);eq('S.diamondMantle',true);run('updateStatusEffects(9999999,S)');eq('S.mineralMantleStacks',20);run('var result=actorAttack(S,a,1100000)');eq('result.damage',22);
fresh();run("S.sapphireMantle=true;S.st=20;var cost=searchStaminaCost(S),move=payMovementCost(S,1000000)");eq('cost',2);eq('move.staminaCost',4);eq('S.st',16);
fresh();run("a.diamondMantle=true;var result=actorAttack(S,a,1000000);Math.random=()=>.999;var guarded=actorAttack(S,a,1000001)");eq('result.damage',16);eq('guarded.damage',6);
fresh();run("a.diamondMantle=true;combatDamage=()=>2;var result=actorAttack(S,a,1000000)");eq('result.damage',1);
// >=20 prevents only the ordinary1% wound roll, does not cure old injuries or block Physics Blow.
fresh();run("a.mineralMantleStacks=19;rollBodyInjury=()=>true;var result=actorAttack(S,a,1000000)");eq('hasBodyInjury(a,"head")',true);
fresh();run("a.mineralMantleStacks=20;rollBodyInjury=()=>{throw Error('immune target rolled')};var result=actorAttack(S,a,1000000)");eq('result.bodyInjury',null);
fresh();run("a.hp=90;a.mineralMantleStacks=20;a.bodyInjuries={leg:{at:1}};rollBodyInjury=()=>{throw Error('forced injury rolled normal probability')};var part=applyBodyAttackInjury(S,a,{id:'physics_blow'},1000000)");eq('part','head');eq('hasBodyInjury(a,"leg")',true);
fresh();run("S.mineralMantleStacks=20;rollBodyInjury=()=>{throw Error('immune drone target rolled')};droneCounterDamage(DRONE_DEFS.bird,S,1000000)");eq('Object.keys(S.bodyInjuries||{}).length',0);
// Jewel Hunt105% copies one unit from the bag; no equipment or corpse table inspection or depletion.
fresh();run("a.bag=[{id:'ruby',count:3},{id:'wood',count:10}];syncInventory(a);var result=actorAttack(S,a,1000000,false,'jewel_hunt')");eq('result.damage',21);eq('S.characterSkillReadyAt',1030000);eq('result.characterSkill.copiedMineral','ruby');eq('S.inventory.ruby',1);eq('a.inventory.ruby',3);eq('a.bag[0].count',3);
fresh();run("a.bag=[];a.equipment={weapon:'ruby_bracelet'};var result=actorAttack(S,a,1000000,false,'jewel_hunt')");eq('result.characterSkill.copiedMineral',null);eq('S.bag.length',0);
fresh();run("S.bag=Array.from({length:6},()=>({id:'wood',count:10}));syncInventory(S);a.bag=[{id:'stone',count:1}];syncInventory(a);var result=actorAttack(S,a,1000000,false,'jewel_hunt')");eq('result.damage',21);eq('result.characterSkill.copiedMineral',null);eq('a.inventory.stone',1);eq('S.characterSkillReadyAt',1030000);
fresh();run("S.bag=[{id:'stone',count:9},...Array.from({length:5},()=>({id:'wood',count:10}))];syncInventory(S);a.bag=[{id:'stone',count:2}];var result=actorAttack(S,a,1000000,false,'jewel_hunt')");eq('S.inventory.stone',10);eq('a.bag[0].count',2);
fresh();run("matchClock.competitive=true;a.hp=1;a.bag=[{id:'ruby',count:1}];syncInventory(a);var result=playerCombatRound(S,a,1000000,false,'jewel_hunt')");eq('S.inventory.ruby',1);eq('corpses.find(c=>c.ownerId===a.id).items.find(x=>x.id==="ruby").count',1);
fresh();run("var d=drones.scorpion;Object.assign(d,{spawned:true,hp:10000,area:S.place});var result=strikeDrone(S,d,1000000,'jewel_hunt')");eq('result.characterSkill.copiedMineral',null);
// Weighted random copies only draw from eligible material units, including the last bucket.
fresh();run("a.bag=[{id:'stone',count:9},{id:'ruby',count:1}];Math.random=()=>.899999;var first=copyHuntedMineral(S,a,1000000);Math.random=()=>.9;var second=copyHuntedMineral(S,a,1000000)");eq('first','stone');eq('second','ruby');
// Selection UI cannot consume until a choice, and rechecks inventory/CT on click.
fresh();run("receive('stone',2,null,S);receive('wood',1,null,S);useCharacterFieldSkill()");eq('S.inventory.stone',2);eq('S.mineralMantleStacks||0',0);assert(run("$('modalBody').innerHTML.includes(\"useMineralMantle('stone')\")"));assert(!run("$('modalBody').innerHTML.includes(\"useMineralMantle('wood')\")"));run("useMineralMantle('stone')");eq('S.inventory.stone',1);eq('S.mineralMantleStacks',1);
// COM feeds surplus, protects its current craft requirements, and uses the same active in actual combat.
fresh();run("var c=comActors[6];c.place=S.place;c.hp=180;c.st=120;c.bag=[{id:'stone',count:3}];syncInventory(c);var protectedId=comMineralChoice(c,{needed:{stone:3}}),surplusId=comMineralChoice(c,{needed:{stone:2}});comCurrentPlan=()=>({id:null,missing:{},needed:{stone:2},crafts:[]});stepCom(c,1000000)");eq('protectedId',null);eq('surplusId','stone');eq('c.inventory.stone',2);eq('c.mineralMantleStacks',1);eq('c.characterFieldReadyAt',1030000);
fresh();run("matchClock.competitive=true;handleComCombatDecision=()=>false;var c=comActors[6];c.place=S.place;S.bag=[{id:'stone',count:2}];syncInventory(S);observeOpponent(c,S,1000000);comFightOpponent(c,1000000)");eq('c.characterSkillReadyAt',1030000);eq('c.inventory.stone',1);eq('S.inventory.stone',2);
fresh();run("S.mineralMantleStacks=20;S.rubyMantle=S.sapphireMantle=S.diamondMantle=true;renderStatusEffects();renderCharacterSkills(1000000)");assert(run("$('statusEffects').innerHTML.includes('通常攻撃の怪我を無効')"));assert(run("$('statusEffects').innerHTML.includes('白玉纏い')"));eq("$('characterFieldBtn').hidden",false);
console.log('PASS: material allowlist/rarities/one-unit/CT, permanent additive stacks/gem coexistence, defense/flat damage/ST/white mitigation, ordinary-only injury immunity,105% nondepleting copies/full-bag/death/drone, selection UI, surplus-aware COM field and active');
