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
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}



let h=harness(),run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
function fixture(){h=harness();run=s=>h.run(s);run(`globalThis.a=comActors[0];matchClock.section=4;matchClock.sectionEndsAt=Date.now()+180000;matchClock.blocked=[];matchClock.nextBlocked=[];a.place='射撃演習区画';a.starterWeapon='practice_bow';a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;a.bag=[];syncInventory(a);Math.random=()=>0;`)}
fixture();run('receive("japanese_bow",1,null,a);receive("wood",1,null,a)');
eq('comPlan(a,"azusa_bow").missing.japanese_bow',1);eq('comPlan(a,"azusa_bow").missing.wood',1);eq('comPlan(a,"azusa_bow").missing.wire',1);eq('comPlan(a,"azusa_bow").missing.scrap',1);
const playerBefore=run('JSON.stringify({bag:S.bag,xp:S.xp,mastery:S.masteryAttacks})');
run('stepCom(a,Date.now());stepCom(a,Date.now()+1000);stepCom(a,Date.now()+2000)');eq('actorOwned(a,"strong_bow")',1);eq('a.inventory.wood||0',0);eq('a.masteryAttacks.bow',22);eq('a.equipment.weapon','strong_bow');
assert.equal(run('JSON.stringify({bag:S.bag,xp:S.xp,mastery:S.masteryAttacks})'),playerBefore);
// Actual inputs and post-consumption capacity are atomic, including equipped recipe ingredients.
fixture();run('a.bag=[{id:"scrap",count:10},{id:"cloth",count:10},{id:"wood",count:10},{id:"feather",count:10},{id:"arrows",count:99},{id:"ration",count:10}];syncInventory(a)');
const before=run('JSON.stringify(a)');eq('craftActor(a,recipes.find(r=>r.id==="simple_armguard"))',false);eq('JSON.stringify(a)',before);
run('comMakeRoom(a,"simple_armguard",1,comPlan(a,"simple_armguard"),Date.now())');eq('a.bag.length',5);eq('regionObjects[a.place].at(-1).dropped',true);
eq('craftActor(a,recipes.find(r=>r.id==="simple_armguard"))',true);run('comEquipBetter(a,Date.now())');eq('a.equipment.arm','simple_armguard');eq('totalStat("defense",a)',12);
run('a.equipment.weapon="strong_bow";a.equipmentAmmo.weapon=7;a.bag=[];syncInventory(a);receive("reinforced_wire",1,null,a)');
eq('craftActor(a,recipes.find(r=>r.id==="mighty_bow"))',true);eq('a.equipment.weapon',null);eq('a.inventory.mighty_bow',1);eq('a.bag.find(x=>x.id==="mighty_bow").ammo',8);
// Goal route uses missing materials and public distributions; configured exhaustion replaces fixed eight-search travel.
fixture();run('a.bag=[{id:"japanese_bow",count:1}];syncInventory(a);comMove(a,Date.now(),"test",comPlan(a,"strong_bow"))');eq('!!regionStock[a.place].wood',true);
run('a.searches=8;a.noProgress=0;a.place="山岳区画";a.bag=[{id:"japanese_bow",count:1}];syncInventory(a);globalThis.area=a.place;stepCom(a,Date.now())');eq('a.place===area',true);
// Per-instance arrows, partial reload and mastery advancement apply to the acting character.
fixture();run('a.equipmentAmmo.weapon=18;receive("arrows",1,null,a)');eq('reloadActor(a)',1);eq('a.equipmentAmmo.weapon',19);eq('a.inventory.arrows||0',0);
function drone(kind='bird',hp=50){run(`a.place=DRONE_DEFS['${kind}'].areas[0];Object.assign(drones['${kind}'],{spawned:true,hp:${hp},area:a.place,generation:7});a.enemy={kind:'${kind}',generation:7};a.hp=180;`)}
drone('bird',26);const pMastery=run('S.masteryAttacks.bow');run('comFight(a,Date.now())');eq('a.equipmentAmmo.weapon',18);eq('a.masteryAttacks.bow',21);eq('S.masteryAttacks.bow',pMastery);eq('drones.bird.hp',9);eq('a.characterSkillReadyAt',run('Date.now()+40000'));eq('a.hp',163);eq('a.enemy',null);
run('a.enemy={kind:"bird",generation:7};comFight(a,Date.now()+1000)');eq('drones.bird.spawned',false);eq('a.hp',186);eq('a.level',2);eq('a.matchStats.killXp',30);eq('drones.bird.respawnAt',1081000);eq('corpses.at(-1).killerId','hayate');eq('corpses.at(-1).expiresAt',1081000);
run('comLoot(a,Date.now()+2000,comPlan(a,"azusa_bow"))');eq('a.loot',null);eq('corpses.at(-1).items.length',2);eq('a.inventory.egg',1);
// An open player corpse menu is reserved against COM list mutation / stale button indexes.
run('a.loot=corpses.at(-1).id;S.corpseVisit={id:a.loot,token:1}');eq('comLoot(a,Date.now()+3000,comPlan(a,"azusa_bow"))',false);eq('corpses.at(-1).items.length',2);
// Retreat leaves drone HP unchanged and avoids omniscient pursuit; poison/ink belong to the attacker.
fixture();drone('scorpion',300);run('comFight(a,Date.now())');eq('drones.scorpion.hp',300);eq('a.leaveDanger',true);eq('a.equipmentAmmo.weapon',20);
run('strikeDrone(a,drones.scorpion,Date.now())');eq('statusStacks("purplePoison",a)',1);eq('statusStacks("purplePoison")',0);run('updateStatusEffects(Date.now()+5000,a)');eq('statusStacks("purplePoison",a)',0);
drone('octopus',250);run('strikeDrone(a,drones.octopus,Date.now())');eq('statusStacks("blackInk",a)',1);eq('statusStacks("blackInk")',0);
// Death moves actual inventory/equipment once; a stale generation cannot damage a respawn.
fixture();drone('bird',50);run('a.hp=1;strikeDrone(a,drones.bird,Date.now());eliminateCom(a,"反撃",Date.now(),"drone-bird-7");eliminateCom(a,"再通知",Date.now())');eq('a.hp',0);eq('a.bag.length',0);eq('corpses.filter(c=>c.ownerId==="hayate").length',1);eq('corpses.at(-1).killerId','drone-bird-7');
fixture();drone();run('a.enemy.generation=6;comFight(a,Date.now())');eq('drones.bird.hp',50);eq('a.equipmentAmmo.weapon',20);
// If COM wins a shared drone while the player's attack timer is pending, no stuck busy UI or duplicate loot.
fixture();drone('bird',1);run('S.place=a.place;discoverDrone("bird");attackDiscoveredDrone();comFight(a,Date.now())');eq('corpses.length',1);h.tickAction();eq('S.busy',false);eq('S.enemy',false);eq('corpses.length',1);
// Real seeded simulation proves a complete multi-recipe route and genuine drone kills, no free materials.
let seededDroneWins=0;
for(let n=1;n<=5;n++){
 h=harness();run=s=>h.run(s);run(`globalThis.seed=${n};globalThis.events=[];globalThis.oldLog=comLog;comLog=(a,t,n)=>{events.push(t);oldLog(a,t,n)};selectPracticeWeapon('practice_bow');move('山岳区画')`);h.advance(900000);
 if(run('events.some(x=>x.includes("撃破"))'))seededDroneWins++;assert(run('events.some(x=>x.includes("制作"))'));assert(run('comActors[0].bag.length<=6'));assert(run('equipmentDef(comActors[0].equipment.weapon).attack>=40'));
}
assert(seededDroneWins>=4,'At least four seeded routes must defeat real drones; all five must craft an epic.');
// Full world chronology is independent of Safari timer throttling.
function chronology(chunk){const z=harness();z.run(`selectPracticeWeapon('practice_bow');move('山岳区画')`);for(let t=chunk;t<=900000;t+=chunk)z.advance(chunk);return z.run('JSON.stringify({actor:comActors[0],drones,corpses,objects:Object.values(regionObjects).flat().filter(x=>x.taken).map(x=>x.uid)})')}
assert.equal(chronology(1000),chronology(900000));
console.log('PASS: COM recursive goals/counts, atomic crafting, equipment/stats, physical bag drops, ammo, shared drone rounds, retreat/status/death, corpse reservation and five seeded production/combat simulations');
