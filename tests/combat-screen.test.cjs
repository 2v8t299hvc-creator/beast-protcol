// Combat presentation and button routing against the actual game script.
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
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(complete=true){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn();if(complete)this.tickFeedback()},tickFeedback(){const i=timers.findIndex(t=>t.ms===900);if(i>=0)timers.splice(i,1)[0].fn()}};
}


let h=harness();let run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
function fixture(kind='bird'){
 // Pin a real instance to an open candidate area to exercise the real encounter/attack entrypoints.
 run(`matchClock.section=4;matchClock.sectionEndsAt=Date.now()+180000;matchClock.blocked=[];matchClock.nextBlocked=[];matchClock.result=null;matchClock.ended=false;S.hp=180;S.busy=false;S.enemy=false;S.enemyKind=null;S.pendingFound=null;S.corpseVisit=null;S.corpseId=null;corpses.length=0;S.statusEffects={};S.place=DRONE_DEFS['${kind}'].areas[0];Object.assign(drones['${kind}'],{spawned:true,hp:DRONE_DEFS['${kind}'].hp,area:S.place,generation:1});`);
 run(`discoverDrone('${kind}')`);
}
// Section unlocks and real 85% discovery, without the obsolete 16% training-drone roll.
eq('Object.values(drones).filter(d=>d.spawned).length',0);h.advance(30000);eq('Object.values(drones).filter(d=>d.spawned).length',0);
h.advance(180000);eq('drones.bird.spawned&&drones.fish.spawned',true);eq('drones.dog.spawned',false);
h.advance(180000);eq('drones.dog.spawned&&drones.humanoid.spawned',true);h.advance(180000);eq('drones.scorpion.spawned&&drones.octopus.spawned',true);
for(const kind of ['bird','fish','dog','humanoid','scorpion','octopus']){
 fixture(kind);eq('S.enemy',true);eq(`$('enemyName').textContent`,run(`DRONE_DEFS['${kind}'].name`));eq(`$('mainBtn').textContent`,'⚔ 攻撃');eq(`$('skillBtn').textContent`,'↩ 逃走');
 eq(`$('enemyArt').src`,run(`DRONE_DEFS['${kind}'].art`));eq(`$('ebar').style.width`,'100%');run('skill()');eq('S.enemy',false);
}
assert(!html.includes('training_drone'),'Old training asset must no longer be referenced');assert(!html.includes('id="ehp"'));assert(!html.includes('DRONE_ENCOUNTER_CHANCE'));
fixture();run(`ignoreDiscoveredDrone();Math.random=()=>0.849;primary()`);h.tickAction();eq('S.enemy',true);
fixture();run(`ignoreDiscoveredDrone();Math.random=()=>0.85;primary()`);h.tickAction();eq('S.enemy',false);
// State survives escape and relocation; blocked candidate sets hide an instance until one reopens.
fixture('dog');run('drones.dog.hp=71;S.ehp=71;skill();discoverDrone("dog")');eq('S.ehp',71);run('skill();matchClock.blocked=[...DRONE_DEFS.dog.areas];updateDrones()');eq('drones.dog.area',null);eq('drones.dog.hp',71);run('matchClock.blocked=[];updateDrones()');eq('DRONE_DEFS.dog.areas.includes(drones.dog.area)',true);eq('drones.dog.hp',71);
// Rare shell mitigation, epic exemption and unarmed/empty-magazine classification.
fixture('scorpion');run(`S.bag=[];syncInventory();receive('reinforced',1);equip('reinforced');`);
eq(`damageToDrone(DRONE_DEFS.scorpion,'fist',100)`,Math.floor(run(`combatDamage(100,28,'fist')`)*0.85));
run(`receive('plasma',1);equip('plasma')`);eq(`damageToDrone(DRONE_DEFS.scorpion,'fist',100)`,run(`combatDamage(100,28,'fist')`));
run(`receive('magma_blaster',1,{ammo:0});equip('magma_blaster')`);eq(`damageToDrone(DRONE_DEFS.scorpion,weaponType(),100)`,Math.floor(run(`combatDamage(100,28,'fist')`)*0.85));
// Reapplication resets a status clock, including at the maximum; long pauses decay multiple stacks.
fixture('scorpion');run(`applyStatus('purplePoison');applyStatus('purplePoison')`);eq(`statusStacks('purplePoison')`,2);h.advance(4000);run(`applyStatus('purplePoison')`);h.advance(1000);eq(`statusStacks('purplePoison')`,3);h.advance(4000);eq(`statusStacks('purplePoison')`,2);
run(`for(let i=0;i<15;i++)applyStatus('purplePoison')`);eq(`statusStacks('purplePoison')`,10);h.advance(4000);run(`applyStatus('purplePoison')`);h.advance(1000);eq(`statusStacks('purplePoison')`,10);h.advance(49000);eq(`statusStacks('purplePoison')`,0);
run(`S.statusEffects={};S.equipment={};S.level=1;Math.random=()=>0;var hpBefore=S.hp;var first=droneCounterDamage(DRONE_DEFS.scorpion);var second=droneCounterDamage(DRONE_DEFS.scorpion)`);eq('first',36);eq('second',37);eq('S.hp===hpBefore',true); // poison alone never ticks damage
run(`S.statusEffects={};applyStatus('blackInk');applyStatus('blackInk')`);eq(`droneAccuracy(DRONE_DEFS.octopus,'fist')`,run(`MASTERY_ACCURACY[masteryRank('fist')]-7`));
// Full combat round: one attack, one counter only while alive, HP feedback then two-choice loot.
fixture('scorpion');run('Math.random=()=>0;var ticksBefore=S.ticks;primary();primary();skill()');eq('S.busy',true);h.tickAction(false);eq(`statusStacks('purplePoison')`,1);eq('S.enemy',true);eq('S.ticks===ticksBefore',true);h.tickFeedback();eq('S.enemy',false);
fixture('bird');run('S.level=1;S.xp=0;S.hp=100;S.equipment={};drones.bird.hp=1;S.ehp=1;var generation=drones.bird.generation;var before=S.hp;Math.random=()=>0;primary()');h.tickAction(false);eq('S.hp===before+25',true);eq('S.level',2);eq('drones.bird.spawned',false);eq('S.corpseVisit',null);eq(`$('ebar').style.width`,'0%');h.tickFeedback();eq('findCorpse(S.corpseVisit.id).items.length',3);
run(`var bodyId=S.corpseVisit.id;var token=S.corpseVisit.token;S.bag=['stone','wood','wire','cloth','fur','rubber'].map(id=>({id,count:10}));syncInventory();takeCorpseItem(1,token)`);eq('S.corpseVisit.token===token',true);eq('S.inventory.egg||0',0);eq('findCorpse(bodyId).items.length',3);
run(`discardStack(0);renderCorpse();takeCorpseItem(1,token)`);eq('S.corpseVisit',null);eq('S.inventory.egg',1);eq('findCorpse(bodyId).items.length',2);
run(`takeCorpseItem(0,token)`);eq('S.inventory.feather||0',0);run('updateDrones()');eq('drones.bird.spawned',false);
h.advance(79999);eq('drones.bird.spawned',false);h.advance(1);eq('drones.bird.spawned',true);eq('drones.bird.hp',50);eq('drones.bird.generation===generation+1',true);run('updateDrones();updateDrones()');eq('drones.bird.generation===generation+1',true);
// A representative late build (Lv8, B bow mastery, rare mighty bow) matches the requested hit ranges.
run(`S.level=8;S.equipment={weapon:'mighty_bow'};S.masteryAttacks.bow=42;S.statusEffects={};var hitCounts=Object.fromEntries(Object.entries(DRONE_DEFS).map(([k,d])=>[k,Math.ceil(d.hp/damageToDrone(d,'bow',totalStat('attack')))]))`);
for(const [k,n] of Object.entries({bird:1,fish:1,dog:2,humanoid:2,scorpion:6,octopus:4}))eq(`hitCounts.${k}`,n);
// Closure during pending attack/feedback still cancels the encounter without loot or resurrection.
fixture('scorpion');run('S.place=matchClock.nextBlocked[0]||S.place;matchClock.nextBlocked=[S.place];primary()');h.setNow(run('matchClock.sectionEndsAt'));h.tickAction();eq('S.hp',0);eq('S.enemy',false);eq('S.corpseVisit',null);
console.log('PASS: six species, section spawns, 85% discovery, HP persistence/respawn, shell, poison/ink clocks, loot capacity, representative hit counts and lockdown cancellation');
