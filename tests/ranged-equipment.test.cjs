// Run the actual single-HTML game script with minimal DOM/timer substitutes.
// These checks exercise inventory, crafting, exploration and combat together; no browser layout assertions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 const elements=new Map(),timers=[];
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],scrollTop:0,disabled:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''},replaceWith(){},scrollIntoView(){}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),tick(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0,'pending game action');timers.splice(i,1)[0].fn();const feedback=timers.findIndex(t=>t.ms===900);if(feedback>=0)timers.splice(feedback,1)[0].fn()}};
}
const h=harness(),run=h.run;
function reset(){run(`matchClock.section=1;matchClock.sectionEndsAt=Date.now()+180000;matchClock.blocked=[];matchClock.nextBlocked=planNextBlocked(1,[]);matchClock.ended=false;matchClock.result=null;S.bag=[];syncInventory();Object.keys(S.equipment).forEach(k=>S.equipment[k]=null);S.equipmentAmmo={};S.fightingInstinct=null;S.masteryAttacks={fist:0,slash:0,gun:0,bow:0};S.level=1;S.xp=0;S.hp=180;S.st=120;S.busy=false;S.enemy=false;S.enemyKind='bird';S.corpseVisit=null;S.corpseId=null;S.statusEffects={};Object.assign(drones.bird,{spawned:true,area:S.place,hp:10000,generation:1});S.pendingFound=null;S.found=[];`)}
function eq(expr,expected){assert.equal(run(expr),expected,expr)}
// All new recipe inputs exist and every new equipment item has confirmed positive stats.
eq(`Object.values(EQUIPMENT_DEFS).filter(d=>d.ammoType).length`,22);
eq(`['telescope','optical_sight','stargazing_telescope','mythic_telescope','angel_wing'].every(id=>EQUIPMENT_DEFS[id].slot==='accessory')`,true);
eq(`Object.entries(EQUIPMENT_DEFS).filter(([id,d])=>!PRACTICE_WEAPONS[id]&&(d.ammoType||d.slot==='accessory')).every(([id,d])=>d.attack>0||d.defense>0)`,true);
eq(`recipes.every(r=>Object.keys(r.need).every(id=>names[id]))`,true);
eq(`Object.values(regionObjects).flat().filter(x=>x.id==='laurel').length`,3);
eq(`new Set(Object.values(regionObjects).flat().filter(x=>x.id==='laurel').map(x=>x.area)).size`,3);
eq(`Object.values(regionObjects).flat().filter(x=>x.id==='bullets'||x.id==='arrows').every(x=>x.count===20)`,true);
eq(`regionStock['山岳区画'].feather>0&&regionStock['森林区画'].fur>0&&regionStock['密林区画'].fur>0`,true);
// All 22 new recipes can produce an item with the declared ingredients.
const newIds=run(`recipes.filter(r=>equipmentDef(r.id)?.ammoType||['reinforced_wire','optical_sight','stargazing_telescope','mythic_telescope','angel_wing'].includes(r.id)).map(r=>r.id)`);
for(const id of newIds){reset();run(`for(const [id,n] of Object.entries(recipes.find(r=>r.id==='${id}').need))assertReceive=receive(id,n);craft('${id}');`);eq(`S.inventory['${id}']`,1);eq(`RECIPE_RARITY['${id}']!==undefined`,true)}
// Every newly found ranged type starts at its own configured capacity.
for(const id of run(`Object.keys(EQUIPMENT_DEFS).filter(id=>EQUIPMENT_DEFS[id].ammoType)`)){
 reset();run(`addFound({id:'${id}',count:1});decideFound(true);equip('${id}',0)`);eq('weaponAmmo()',run(`EQUIPMENT_DEFS['${id}'].capacity`));
}
// Manufactured weapons also start full, even when the ingredient was unloaded.
reset();run(`receive('japanese_bow',1,{ammo:0});receive('wood',1);craft('strong_bow')`);eq('S.bag[0].ammo',8);
// A dropped empty weapon remains empty when collected directly or via stock.
reset();run(`receive('handgun',1,{ammo:0});discardStack(0);addFound(S.found.pop());decideFound(true)`);eq('S.bag[0].ammo',0);
run(`discardStack(0);takeFound(0)`);h.tick();run('decideFound(true)');eq('S.bag[0].ammo',0);
// Magazine refill consumes only the missing rounds and caps apply to carried ammo across stacks.
reset();run(`receive('handgun',1,{ammo:0});receive('bullets',10);equip('handgun');reloadWeapon('bullets');`);
eq('weaponAmmo()',8);eq('S.inventory.bullets',2);run(`S.equipmentAmmo.weapon=3;reloadWeapon('bullets')`);eq('weaponAmmo()',5);eq('S.inventory.bullets||0',0);
run(`receive('bullets',99)`);eq(`receive('bullets',1)`,false);eq('S.inventory.bullets',99);eq(`receive('arrows',20)`,true);run(`reloadWeapon('arrows')`);eq('weaponAmmo()',5);eq('S.inventory.arrows',20);
// Two identical guns retain their own ammunition through exact-stack selection and swapping.
reset();run(`receive('handgun',1,{ammo:7});receive('handgun',1,{ammo:2});equip('handgun',1)`);eq('weaponAmmo()',2);run(`equip('handgun',0)`);eq('weaponAmmo()',7);eq('S.bag[0].ammo',2);
run(`unequip('weapon')`);eq('S.bag[1].ammo',7);run(`equip('handgun',1);receive('rifle',1);equip('rifle',1)`);eq('weaponAmmo()',6);eq('S.bag[1].ammo',7);
// Drop -> world object -> direct discovery pickup and stock recovery preserve loaded ammunition.
reset();run(`receive('japanese_bow',1,{ammo:5});discardStack(0);addFound(S.found.pop());decideFound(true);equip('japanese_bow',0)`);eq('weaponAmmo()',5);
run(`unequip('weapon');discardStack(0);takeFound(0)`);h.tick();run('decideFound(true)');eq('S.bag[0].ammo',5);
// Consuming an equipped loaded weapon creates a fully loaded upgraded gun, without inheriting stale ammo.
reset();run(`receive('handgun',1,{ammo:6});equip('handgun');receive('gunpowder',1);craft('hand_blaster')`);eq('S.equipment.weapon',null);eq('S.equipmentAmmo.weapon',undefined);eq('S.bag[0].ammo',8);
// Atomic crafting capacity checks: a full bag can craft only when the output fits after consumption.
reset();run(`receive('rubber',1);receive('fur',1);for(const id of ['stone','wood','wire','cloth'])receive(id,1);craft('rubbery_hide')`);eq('S.inventory.rubbery_hide',1);eq('S.inventory.rubber||0',0);
reset();run(`receive('rubber',2);receive('fur',2);for(const id of ['stone','wood','wire','cloth'])receive(id,1);craft('rubbery_hide')`);eq('S.inventory.rubbery_hide||0',0);eq('S.inventory.rubber',2);
// An attack uses its last round even on a miss; the next attack is an unarmed attack with fist mastery.
for(const [id,type,ammo] of [['handgun','gun','bullets'],['japanese_bow','bow','arrows']]){
 reset();run(`receive('${id}',1,{ammo:1});equip('${id}');S.enemy=true;S.ehp=10000;Math.random=()=>0.999;attackDiscoveredDrone()`);h.tick();eq('weaponAmmo()',0);eq(`S.masteryAttacks.${type}`,1);eq('S.ehp',10000);
 run(`S.enemy=true;attackDiscoveredDrone()`);h.tick();eq('S.masteryAttacks.fist',2);eq(`S.masteryAttacks.${type}`,1);eq('S.equipment.weapon',id);
 run(`receive('${ammo}',20);reloadWeapon('${ammo}')`);eq('weaponType()',type);
}
// Laurels cannot return when their region exploration lap resets.
run(`var leaf=Object.values(regionObjects).flat().find(x=>x.id==='laurel');markObjectTaken(leaf);regionSeen[leaf.area].clear()`);eq(`regionObjects[leaf.area].filter(x=>x.id==='laurel'&&!x.taken).length`,0);
// New categories and ammo controls render without JS errors.
reset();run(`showCraft('weapon','gun');showCraft('weapon','bow');showCraft('armor','accessory');receive('rifle',1);equip('rifle');showEquipment();receive('bullets',20);showBag();showItemStack(0);showMaterialSource('rubbery_hide','amalgam_bow');showMap();`);
console.log('PASS: 22 recipes, 25 configured equipment, ammo limits/refill, per-instance persistence, crafting atomicity, ranged/unarmed combat, unique laurels and UI rendering');
