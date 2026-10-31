// Ranged COM crafting, equipment retention and ammo resupply integration checks.
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
let run;function fresh(){run=harness()}const eq=(s,v)=>assert.equal(run(s),v,s);
function equip(id){run(`receive('${id}',1);equip('${id}')`)}
const plain=s=>JSON.parse(run(`JSON.stringify(${s})`));
function ranged(type='gun',weapon=type==='gun'?'magma_blaster':'eros_bow'){
 fresh();run(`var a=target;Object.assign(a,{character:'${type==='gun'?'snow_leopard':'hayate'}',preferredWeaponType:'${type}',bag:[],inventory:{},equipment:{weapon:'${weapon}'},equipmentAmmo:{weapon:20},equipmentEffects:{},masteryAttacks:{gun:20,bow:20},adaptivePlanCache:null,goal:null,enemy:null,opponent:null,recentThreat:null,loot:null,leaveDanger:false,restMode:null,bodyTreatment:null,recoverySeeking:false,noProgress:0,searches:0,exhausted:{},visited:{}});a.hp=actorMax(a,'hp');a.st=actorMax(a,'stamina');matchClock.competitive=false`);
}
// Real planning and actions prioritize an immediately buildable magazine over generic defense.
ranged();run(`receive('gunpowder',1,null,a);receive('scrap',1,null,a)`);eq('comCurrentPlan(a).id','simple_magazine');run('stepCom(a,Date.now());stepCom(a,Date.now()+1000)');eq('a.equipment.accessory','simple_magazine');eq('weaponCapacity(a.equipment.weapon,a)',28);
// A stronger defensive accessory must not displace ranged support, including after looting.
run(`receive('philosophers_stone',1,null,a)`);eq('comWants(a,"philosophers_stone",comPlan(a,null))',false);eq('comEquipBetter(a,Date.now())',false);eq('a.equipment.accessory','simple_magazine');
// Gun routes favor actual infinite-ammo weapons when their ingredients are available.
ranged('gun','sniper_rifle');run(`receive('diamond',1,null,a)`);eq('comCurrentPlan(a).id','laser_rifle');run('stepCom(a,Date.now());stepCom(a,Date.now()+1000)');eq('a.equipment.weapon','laser_rifle');eq('weaponAmmo(a.equipment.weapon,a.equipmentAmmo.weapon)',Infinity);eq('comAmmoType(a)',null);eq('comWants(a,"bullets",comPlan(a,null))',false);eq('comAmmoResupplyPlan(a,comPlan(a,null))',null);
// On infinite guns, magazines lose their now-unneeded special value and may be replaced by useful armor.
run(`a.equipment.accessory='simple_magazine';receive('philosophers_stone',1,null,a)`);eq('comEquipBetter(a,Date.now())',true);eq('a.equipment.accessory','philosophers_stone');
// Bow users build quivers early and prefer saving arrows to capacity-only upgrades.
ranged('bow');run(`receive('bamboo_pole',1,null,a);receive('fur',1,null,a)`);eq('comCurrentPlan(a).id','quiver');run('stepCom(a,Date.now());stepCom(a,Date.now()+1000)');eq('a.equipment.accessory','quiver');
run(`receive('wonderore',1,null,a)`);eq('comCurrentPlan(a).id','magic_quiver');run('stepCom(a,Date.now());stepCom(a,Date.now()+1000)');eq('a.equipment.accessory','magic_quiver');
run(`receive('laurel',1,null,a)`);eq('comCurrentPlan(a).id','apollo_quiver');run('stepCom(a,Date.now());stepCom(a,Date.now()+1000)');eq('a.equipment.accessory','apollo_quiver');eq('comAmmoType(a)',null);eq('comWants(a,"arrows",comPlan(a,null))',false);
// A no-consumption quiver still requires the first loaded arrow and refills if it is genuinely empty.
run(`a.equipmentAmmo.weapon=0`);eq('comAmmoType(a)','arrows');eq('!!comAmmoResupplyPlan(a,comPlan(a,null))',true);run(`receive('arrows',20,null,a);reloadActor(a)`);eq('comAmmoType(a)',null);
// Combat estimates include arrow saving; a guaranteed saved arrow supports a long fight.
ranged('bow','amalgam_bow');run(`a.hp=50000;target.hp=50000;S.hp=50000;a.equipmentAmmo.weapon=1;a.equipment.accessory=null;var normal=evaluateCombat(a,S,Date.now());a.equipment.accessory='apollo_quiver';var infinite=evaluateCombat(a,S,Date.now())`);eq('normal.ammoShort',true);eq('infinite.ammoShort',false);eq('infinite.action','attack');
run(`Math.random=()=>0;for(let i=0;i<30;i++)actorAttack(a,S,Date.now()+i*1000)`);eq('a.equipmentAmmo.weapon',1);eq('actorWeaponType(a)','bow');
// The fractional saving accessories also reduce the projected ammunition requirement.
ranged('bow');run(`a.hp=50000;S.hp=500;a.equipmentAmmo.weapon=5;var noSave=evaluateCombat(a,S,Date.now());a.equipment.accessory='artemis_quiver';var saving=evaluateCombat(a,S,Date.now())`);eq('noSave.ammoShort',true);eq('saving.ammoShort',false);
// Resupply starts before empty, retains the main goal's ingredients, and uses public accessible sources.
ranged();run(`a.equipmentAmmo.weapon=3;var mainPlan={id:'laser_rifle',missing:{diamond:1},needed:{diamond:1},crafts:[]};var refill=comAmmoResupplyPlan(a,mainPlan)`);eq('refill.ammunition',true);eq('refill.needed.diamond',1);eq('refill.missing.bullets',40);
run('stepCom(a,Date.now())');assert(run(`regionStock[a.place].bullets>0`));assert(run(`a.history.at(-1).text.includes('弾薬補充のため移動')`));
run(`for(const d of Object.values(drones))d.spawned=false;regionObjects[a.place]=[{id:'bullets',uid:'ammo-test',area:a.place,count:20,taken:false}];a.seen={};Math.random=()=>0;stepCom(a,Date.now()+1000)`);assert(run('a.inventory.bullets>=20'));eq('a.equipmentAmmo.weapon',3);
// Reload transfers existing ammo rather than inventing it, and fills enhanced magazines.
ranged();run(`a.equipment.accessory='auto_magazine';a.equipmentAmmo.weapon=0;receive('bullets',80,null,a);var total=a.inventory.bullets;reloadActor(a)`);eq('a.equipmentAmmo.weapon',80);eq('a.inventory.bullets||0',0);eq('comAmmoReserveTarget(a)',99);eq('comWants(a,"bullets",comPlan(a,null))',true);
// No impossible resupply loop after every publicly known source has closed.
ranged();run(`a.equipmentAmmo.weapon=0;matchClock.blocked=Object.keys(regionStock)`);eq('comAmmoResupplyPlan(a,comPlan(a,null))',null);
// Melee actors and the other ranged type never receive the wrong specialty bonus.
fresh();run(`S.equipment.weapon='practice_gauntlet';S.preferredWeaponType='fist'`);eq('comAmmoSupportValue(S,"simple_magazine")',0);eq('comAmmoSupportValue(S,"apollo_quiver")',0);eq('comWeaponValue(S,"laser_rifle")',0);eq('comAmmoResupplyPlan(S,comPlan(S,null))',null);
ranged('bow');eq('comAmmoSupportValue(a,"auto_magazine")',0);ranged();eq('comAmmoSupportValue(a,"apollo_quiver")',0);
// Depleted/inaccessible material routes cannot force an otherwise impossible sustain build.
ranged();run(`a.exhausted=Object.fromEntries(Object.keys(regionStock).map(x=>[x,true]));var p=comCurrentPlan(a)`);eq('p.id',null);
// UI: related recipes precede the secondary pin button. Rarity spans inherit the compact HUD text.
fresh();run(`var card=craftRecipeHTML(recipes.find(r=>r.id==='glove'))`);assert(run(`card.indexOf('bp-related-link')<card.indexOf('bp-pin-recipe')`));
assert(html.includes('#craftTargetBtn span{font:inherit;display:inline;line-height:inherit}'));assert(html.includes('-webkit-line-clamp:2'));assert(html.includes('#craftTargetSummary{display:-webkit-box;'));
console.log('PASS: actual gun/bow support crafting and equipping, infinite-ammo paths, support retention, saved-arrow combat decisions, early resupply/source closures, real ammo accounting, melee isolation and recipe/HUD regressions.');
