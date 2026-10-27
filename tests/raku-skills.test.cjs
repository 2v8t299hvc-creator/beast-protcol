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






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.character='raku';S.equipment={weapon:'practice_gauntlet'};S.bag=[];syncInventory(S);var a=comActors[0];a.place=S.place;a.hp=10000;a.equipment={};Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Exact gains by drone size; permanent/unspent stacks and capped damage bonus, without PvP scaling.
for(const [kind,gain] of [['bird',1],['fish',1],['dog',2],['humanoid',2],['scorpion',4],['octopus',4],['dragon',10]]){fresh();eq(`awardDismantlerStacks(S,'${kind}',1000000)`,gain);eq('S.modificationStacks',gain)}
for(const [stacks,damage] of [[0,100],[1,102],[7,114],[15,130],[30,160],[45,160],[100,160]]){fresh();run(`S.modificationStacks=${stacks};var d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:S.place});damageToDrone=()=>100;var result=strikeDrone(S,d,1000000)`);eq('result.damage',damage);eq('S.modificationStacks',stacks)}
fresh();run("S.modificationStacks=100;combatDamage=()=>100;var result=actorAttack(S,a,1000000)");eq('result.damage',100);
// The killing blow uses pre-kill damage; newly earned7/15 stacks affect this very corpse's extra drops.
for(const [before,after,extra] of [[5,6,0],[6,7,1],[13,14,1],[14,15,2],[44,45,2]]){fresh();run(`S.modificationStacks=${before};var d=drones.bird;Object.assign(d,{spawned:true,hp:1,area:S.place});damageToDrone=()=>100;var result=strikeDrone(S,d,1000000)`);eq('S.modificationStacks',after);eq('result.body.items.filter(x=>x.source==="解体屋").length',extra);eq('result.damage',Math.floor(100*(1+Math.min(.6,before*.02))));eq('strikeDrone(S,d,1000001)',null);eq('S.modificationStacks',after)}
fresh();run("S.modificationStacks=15;S.equipment.legs='primal_boots';S.equipment.weapon='super_wild_hammer';var body=createDroneCorpse('dog',S.place,1000000,S.id)");eq('body.items.filter(x=>x.source==="解体屋").length',2);eq('body.items.filter(x=>x.source==="野生の本能").length',1);assert(run('body.items.length<=12'));
fresh();run("S.modificationStacks=15;var body=createCorpse('player','test',S.place,[{id:'wood',count:1}],1000000,{killerId:S.id})");eq('body.items.filter(x=>x.source==="解体屋").length',0);
fresh();run("S.character='kaito';awardDismantlerStacks(S,'dragon',1000000)");eq('S.modificationStacks||0',0);
// Every actual type and upgrade tier: exact next rarity, same type, no stack/XP/mastery/inventory cost.
for(const [type,old,tier,need] of [['fist','practice_gauntlet','uncommon',1],['slash','iron_sword','rare',5],['hammer','steel_hammer','epic',10],['bow','practice_bow','uncommon',1],['gun','magma_blaster','legendary',45]]){
 fresh();run(`S.equipment.weapon='${old}';S.modificationStacks=${need};S.xp=7;S.equipmentAmmo.weapon=3;S.equipmentEffects={weapon:{id:'${old}',bonusAttack:99,attacks:2,durability:3}};var beforeMastery=JSON.stringify(S.masteryAttacks),beforeBag=JSON.stringify(S.bag);`);
 if(tier==='legendary')run(`EQUIPMENT_DEFS.fixture_legend={...EQUIPMENT_DEFS.${old},attack:99};RECIPE_RARITY.fixture_legend='legendary';names.fixture_legend='test legendary'`);
 run('var ok=modifyEquippedWeapon(S,1000000)');eq('ok',true);eq('RECIPE_RARITY[S.equipment.weapon]',tier);eq('EQUIPMENT_DEFS[S.equipment.weapon].weaponType',type);eq('S.modificationStacks',need);eq('S.xp',7);eq('JSON.stringify(S.masteryAttacks)',run('beforeMastery'));eq('JSON.stringify(S.bag)',run('beforeBag'));eq('S.equipmentEffects.weapon.bonusAttack',undefined);eq('S.characterFieldReadyAt',1090000);
}
// Threshold boundaries1/5/10/45, including future registered legendary candidates; no failed-use cooldown.
for(const [old,need] of [['practice_gauntlet',1],['glove',5],['reinforced',10],['plasma',45]]){fresh();run(`S.equipment.weapon='${old}';EQUIPMENT_DEFS.fixture_legend={...EQUIPMENT_DEFS.plasma};RECIPE_RARITY.fixture_legend='legendary';names.fixture_legend='test legendary';S.modificationStacks=${need-1}`);eq('modifyEquippedWeapon(S,1000000)',false);eq('S.characterFieldReadyAt||0',0);eq('S.equipment.weapon',old);run(`S.modificationStacks=${need}`);eq('modifyEquippedWeapon(S,1000000)',true);eq('S.modificationStacks',need)}
fresh();run("S.equipment.weapon='practice_gun';S.modificationStacks=100");eq('weaponModificationPlan(S).candidates.length',0);eq('modifyEquippedWeapon(S,1000000)',false);eq('S.characterFieldReadyAt||0',0);
fresh();run("S.equipment.weapon='plasma';S.modificationStacks=100");eq('modifyEquippedWeapon(S,1000000)',false);eq('S.characterFieldReadyAt||0',0);
fresh();run("S.equipment.weapon=null;S.modificationStacks=100");eq('modifyEquippedWeapon(S,1000000)',false);
// Cooldown at90sec, finite ammo preserved/clamped, clean state and full-bag in-place replacement.
fresh();run("S.equipment.weapon='practice_bow';S.equipmentAmmo.weapon=3;S.modificationStacks=10;S.bag=Array.from({length:6},()=>({id:'wood',count:10}));syncInventory(S);var ok=modifyEquippedWeapon(S,1000000)");eq('ok',true);eq('S.equipmentAmmo.weapon',3);eq('S.bag.length',6);eq('modifyEquippedWeapon(S,1089999)',false);eq('modifyEquippedWeapon(S,1090000)',true);eq('RECIPE_RARITY[S.equipment.weapon]','rare');eq('S.modificationStacks',10);
for(const rng of [0,.999]){fresh();run(`S.equipment.weapon='practice_gauntlet';S.modificationStacks=1;var pool=weaponModificationPlan(S).candidates;Math.random=()=>${rng};modifyEquippedWeapon(S,1000000)`);eq('S.equipment.weapon',run(rng===0?'pool[0]':'pool.at(-1)'))}
// Real field button, COM modification/kill paths, and all ten character definitions render without requiring an active.
fresh();run('S.modificationStacks=1;useCharacterFieldSkill()');eq('RECIPE_RARITY[S.equipment.weapon]','uncommon');eq('S.modificationStacks',1);
fresh();run("var c=comActors[8];c.place=S.place;c.hp=180;c.st=120;c.modificationStacks=1;c.equipment={weapon:'practice_bow'};c.equipmentAmmo.weapon=4;stepCom(c,1000000)");eq('RECIPE_RARITY[c.equipment.weapon]','uncommon');eq('c.modificationStacks',1);eq('c.characterFieldReadyAt',1090000);
fresh();run("var c=comActors[8];c.place=S.place;c.modificationStacks=6;var d=drones.bird;Object.assign(d,{spawned:true,hp:1,area:S.place});var result=strikeDrone(c,d,1000000)");eq('c.modificationStacks',7);eq('result.body.items.filter(x=>x.source==="解体屋").length',1);
fresh();run("S.modificationStacks=100;renderCharacterSkills(1000000)");eq("$('characterPassiveCount').textContent",'100');eq("$('characterSkillBtn').hidden",true);eq("$('characterFieldBtn').hidden",false);eq('dismantlerDamageBonus(S)',.6);
run("for(const actor of [S,...comActors]){if(!CHARACTER_SKILLS[actor.character])throw Error('missing '+actor.character);S.character=actor.character;renderCharacterSkills(1000000)}");
console.log('PASS: Raku all drone-size gains/capped PvE damage, same-kill7/15 extra drops/gear coexistence/once-only, exact-tier same-type random modifications/1/5/10/45/no-cost/no-XP/CT90, ammo/full bag/failure boundaries, real COM and all10 skill panels');
