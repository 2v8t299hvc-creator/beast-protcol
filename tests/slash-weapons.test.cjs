// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}



const config=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../SLASH_WEAPONS_20261027.json'),'utf8'));
let h,run;const eq=(code,v)=>assert.equal(run(code),v,code);
function fresh(){h=harness();run=h.run;run(`matchClock.section=1;matchClock.sectionEndsAt=3000000;matchClock.blocked=[];matchClock.nextBlocked=[];S.hp=100;S.bag=[];S.equipment={};S.equipmentEffects={};syncInventory();var a=comActors[0];a.place=S.place;a.hp=10000;a.nextActionAt=3000000;Math.random=()=>0;attackRoll=()=>0;`)}
for(const item of config.items){fresh();eq(`names['${item.id}']`,item.name);eq(`RECIPE_RARITY['${item.id}']`,item.rarity);if(item.attack!==null){eq(`equipmentDef('${item.id}').weaponType`,'slash');eq(`equipmentDef('${item.id}').attack`,item.attack)}else eq(`equipmentDef('${item.id}')`,null);
 assert.deepEqual(JSON.parse(run(`JSON.stringify(recipes.find(r=>r.id==='${item.id}').need)`)),item.need);for(const [id,n]of Object.entries(item.need))run(`receive('${id}',${n})`);eq(`craftActor(S,recipes.find(r=>r.id==='${item.id}'))`,true);eq(`S.inventory['${item.id}']`,1);for(const id of Object.keys(item.need))eq(`S.inventory['${id}']||0`,0);
}
// Duplicate input accepts one worn jambiya plus a second bag instance, but never duplicates a single knife.
fresh();run("receive('jambiya',1);equip('jambiya')");eq("canCraft(recipes.find(r=>r.id==='kukri'))",false);run("receive('jambiya',1);craft('kukri','weapon')");eq('S.equipment.weapon',null);eq('S.inventory.kukri',1);
fresh();run("receive('army_knife',1);equip('army_knife');receive('poison_potion',1);craft('assassin_knife','weapon')");eq('S.inventory.assassin_knife',1);eq('S.equipment.weapon',null);
// Basic critical 3%, jail knife 6%; exact upper-tail boundaries. All weapon types and bare hands share it.
fresh();for(const type of ['fist','slash','hammer','bow','gun'])eq(`actorCriticalChance(S,'${type}')`,.03);eq('actorCriticalChance()',.03);run("S.equipment.weapon='jail_knife'");eq('actorCriticalChance(S)',.06);run('Math.random=()=>0.939999');eq('rollCritical(S)',false);run('Math.random=()=>0.94');eq('rollCritical(S)',true);run("S.equipment.weapon='iron_sword';Math.random=()=>0.969999");eq('rollCritical(S)',false);run('Math.random=()=>0.97');eq('rollCritical(S)',true);eq('criticalDamage(11,true)',14);eq('criticalDamage(11,false)',11);
// Actual PvP attack multiplies ordinary damage only; guard halves ordinary and fixed eruption damage.
fresh();run("matchClock.competitive=true;S.equipment.weapon='iron_sword';rollCritical=()=>true;var result=actorAttack(S,a,Date.now())");eq('result.critical',true);eq('result.damage',run("Math.floor(combatDamage(totalStat('attack',S),totalStat('defense',a),'slash',1,S)*1.3)"));
fresh();run("a.equipment.weapon='iron_sword';rollCritical=()=>true;var result=actorAttack(a,S,Date.now())");eq('result.critical',true);
fresh();run("S.equipment.weapon='magma_blaster';S.equipmentAmmo.weapon=8;Math.random=()=>.999;rollCritical=()=>{throw new Error('guard must not roll critical')};actorAttack(S,a,Date.now());actorAttack(S,a,Date.now());var result=actorAttack(S,a,Date.now())");eq('result.hit',true);eq('result.guarded',true);eq('result.damage',24);
// Hero sword affects drones only, including incoming delayed counters. Critical and poison fixed damage are separate.
fresh();run("S.equipment.weapon='hero_sword';var normal=combatDamage(50,DRONE_DEFS.bird.defense,'slash',1,S)");eq("damageToDrone(DRONE_DEFS.bird,'slash',50,0,S)",run('Math.floor(normal*1.3)'));run("var details={};var reduced=droneCounterDamage(DRONE_DEFS.bird,S,Date.now(),details);S.equipment.weapon='iron_sword';var plain=droneCounterDamage(DRONE_DEFS.bird,S,Date.now())");eq('reduced',run('Math.floor(plain*.7)'));eq('details.critical',false);
fresh();run("S.equipment.weapon='hero_sword';var result=actorAttack(S,a,Date.now())");eq('result.damage',run("combatDamage(totalStat('attack',S),totalStat('defense',a),'slash',1,S)"));
fresh();run("S.equipment.weapon='iron_sword';Object.assign(drones.bird,{spawned:true,hp:10000,area:S.place,generation:7});rollCritical=()=>true;var result=strikeDrone(S,drones.bird,Date.now())");eq('result.critical',true);eq('result.counterCritical',true);
// Assassin poison uses the exact scorpion status: one per hit, max10, +stack fixed damage, 5s decay.
fresh();run("S.equipment.weapon='assassin_knife';var result=actorAttack(S,a,Date.now())");eq('statusStacks("purplePoison",a)',1);eq('result.effect.fixedDamage',1);for(let i=0;i<15;i++)run('actorAttack(S,a,Date.now())');eq('statusStacks("purplePoison",a)',10);run('updateStatusEffects(Date.now()+5000,a)');eq('statusStacks("purplePoison",a)',9);run('updateStatusEffects(Date.now()+50000,a)');eq('statusStacks("purplePoison",a)',0);
fresh();run("S.equipment.weapon='assassin_knife';Math.random=()=>.999;var result=actorAttack(S,a,Date.now())");eq('result.hit',true);eq('result.guarded',true);eq('statusStacks("purplePoison",a)',1);
fresh();run("S.equipment.weapon='assassin_knife';Object.assign(drones.bird,{spawned:true,hp:10000,area:S.place,generation:7});var result=strikeDrone(S,drones.bird,Date.now())");eq('statusStacks("purplePoison",drones.bird)',1);eq('result.effect.fixedDamage',1);run('drones.bird.spawned=false;drones.bird.respawnAt=Date.now();matchClock.section=2;updateDrones(Date.now())');eq('statusStacks("purplePoison",drones.bird)',0);
// The delayed retaliation path applies the same hero reduction at its actual due time.
fresh();run("S.equipment.weapon='hero_sword';Object.assign(drones.bird,{spawned:true,hp:10000,area:S.place,generation:7,slowUntil:Date.now()+5000,slowActionDelayMs:500});var result=strikeDrone(S,drones.bird,Date.now());var hpBefore=S.hp");eq('result.counterPending',true);h.setNow(1000499);run('updateDelayedDroneCounters(Date.now())');eq('S.hp',run('hpBefore'));h.setNow(1000500);run('updateDelayedDroneCounters(Date.now())');eq('S.hp',run("hpBefore-Math.floor(Math.floor(damageAfterDefense(DRONE_DEFS.bird.attack,totalStat('defense',S)))*.7)"));
// Critical multiplication leaves the assassin's fixed poison bonus unmultiplied.
fresh();run("S.equipment.weapon='assassin_knife';rollCritical=()=>true;var result=actorAttack(S,a,Date.now())");eq('result.damage',run("Math.floor(combatDamage(totalStat('attack',S),totalStat('defense',a),'slash',1,S)*1.3)+1"));
// Spirit sword grants +3 per treatment second/action for both player and COM; items and rest unchanged.
fresh();run("S.equipment.weapon='spirit_sword';toggleRecoveryMode('hp')");h.setNow(1001000);run('updateRecoveryMode(Date.now())');eq('S.hp',105);run("S.equipment.weapon='iron_sword'");h.setNow(1002000);run('updateRecoveryMode(Date.now())');eq('S.hp',107);
fresh();run("a.hp=1;a.st=0;a.bag=[];a.equipment.weapon='spirit_sword';a.opponent=null;a.enemy=null;syncInventory(a);stepCom(a,Date.now())");eq('a.hp',6);
fresh();run("S.equipment.weapon='spirit_sword';receive('ration',1);recoverActor(S,'ration')");eq('S.hp',120);
// Durability immunity and +5 accuracy are applied only while the actual item is worn.
fresh();run("S.equipment.weapon='orichalcum';equipmentState(S,'weapon').durability=10");eq("damageEquipmentDurability(S,'weapon',5)",0);eq("equipmentState(S,'weapon').durability",10);run("S.equipment.weapon='automaton_axe'");eq('actorAccuracyBonus(S)',5);
// AI forecasts include critical odds without consuming randomness or inspecting hidden enemy data.
fresh();run("S.equipment.weapon='jail_knife';Math.random=()=>{throw new Error('forecast must not roll')};var estimate=evaluateCombat(S,a,Date.now());");eq('estimate.turns',run('Math.ceil(a.hp/(estimate.perHit*1.018*estimate.accuracy/100+Math.max(1,Math.floor(estimate.perHit*.5))*(1-estimate.accuracy/100)))'));
console.log('PASS: 18 slashing recipes/stats, equipped and duplicate ingredients, 3%/6% crit boundaries and real PvP/drone crit, fixed-damage exclusion, hero affinity, shared poison/decay/respawn, player/COM treatment, durability immunity and accuracy');
