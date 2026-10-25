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
 vm.runInContext(source,context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;
function fresh(){h=harness();run=s=>h.run(s);run(`comActors.length=0;globalThis.a=S;matchClock.section=4;matchClock.sectionEndsAt=Date.now()+1000000;matchClock.blocked=[];matchClock.nextBlocked=[];a.place='山岳区画';a.bag=[];syncInventory(a);a.equipment={weapon:null,head:null,arm:null,body:null,legs:null,accessory:null};a.equipmentAmmo={};a.equipmentEffects={};a.masteryAttacks={bow:0,gun:0,fist:0};a.hp=100;a.st=50;Math.random=()=>0;globalThis.d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:a.place,generation:1});`)}
const eq=(s,v)=>assert.equal(run(s),v,s);
const expected={japanese_bow:[12,8],strong_bow:[18,8],mighty_bow:[30,8],azusa_bow:[48,20],unerring_bow:[46,12],western_bow:[14,8],longbow:[20,8],silver_bow:[32,12],golden_bow:[35,16],eros_bow:[47,16],amalgam_bow:[48,8],apollo_bow:[50,16],handgun:[18,8],hand_blaster:[30,8],magma_blaster:[45,8],rifle:[19,6],sniper_rifle:[32,6],laser_rifle:[45,Infinity],cannon:[30,4],blizzard_cannon:[48,4]};
fresh();for(const [id,[attack,capacity]]of Object.entries(expected)){eq(`EQUIPMENT_DEFS['${id}'].attack`,attack);eq(`EQUIPMENT_DEFS['${id}'].capacity`,capacity)}
for(const [id,defense]of Object.entries({telescope:10,optical_sight:12,stargazing_telescope:16,mythic_telescope:22,angel_wing:16}))eq(`EQUIPMENT_DEFS['${id}'].defense`,defense);
eq('EQUIPMENT_DEFS.practice_bow.attack',8);eq('EQUIPMENT_DEFS.practice_bow.capacity',20);
// Accuracy stacks in percentage points, caps at 100, and an empty ranged weapon loses its accuracy effect.
run(`receive('unerring_bow',1);equip('unerring_bow');receive('optical_sight',1);equip('optical_sight')`);eq('droneAccuracy(DRONE_DEFS.bird,"bow")',95);run('a.masteryAttacks.bow=250');eq('droneAccuracy(DRONE_DEFS.bird,"bow")',100);run('a.equipmentAmmo.weapon=0');eq('droneAccuracy(DRONE_DEFS.bird,actorWeaponType(a))',90);
// Infinite laser: no carried bullets used, no reload, no unarmed fallback, no Infinity stored in item state.
fresh();run(`receive('laser_rifle',1);globalThis.serialized=JSON.stringify(a.bag);equip('laser_rifle');receive('bullets',12);for(let i=0;i<40;i++){Object.assign(d,{spawned:true,hp:1,area:a.place});strikeDrone(a,d,Date.now())}`);
eq('weaponAmmo()',Infinity);eq('a.inventory.bullets',12);eq('actorWeaponType(a)','gun');eq('a.masteryAttacks.fist',0);eq('reloadActor(a)',0);eq('a.equipmentAmmo.weapon',undefined);eq('serialized.includes("null")',false);eq('ammoLabel("laser_rifle",0)','〔∞〕');run('showEquipment()');eq('$("modalBody").innerHTML.includes("弾薬・リロード不要")',true);
// Eruption counts misses, its damage is fixed, and an empty gun's fist attack cannot advance it.
fresh();run(`receive('magma_blaster',1);equip('magma_blaster');Math.random=()=>0.999;globalThis.r1=strikeDrone(a,d,Date.now());globalThis.r2=strikeDrone(a,d,Date.now());globalThis.r3=strikeDrone(a,d,Date.now())`);
eq('r1.damage',0);eq('r2.damage',0);eq('r3.hit',false);eq('r3.damage',15);eq('d.hp',9985);eq('a.equipmentAmmo.weapon',5);run('a.equipmentAmmo.weapon=0;strikeDrone(a,d,Date.now())');eq('equipmentState(a,"weapon").attacks',0);
// Love Arrow heals ceil(actual HP loss * 5%), not requested/overkill damage, and caps at max HP.
fresh();run(`receive('eros_bow',1);equip('eros_bow');d.hp=21;globalThis.r=strikeDrone(a,d,Date.now())`);eq('r.dealt',21);eq('r.healing',2);eq('a.hp',102);
fresh();run(`receive('eros_bow',1);equip('eros_bow');a.hp=maxHp()-1;d.hp=10000;globalThis.r=strikeDrone(a,d,Date.now())`);eq('r.healing',1);eq('a.hp',162); // healed to 180 then countered for 18
fresh();run(`receive('eros_bow',1);equip('eros_bow');Math.random=()=>0.999;globalThis.r=strikeDrone(a,d,Date.now())`);eq('r.healing',0);
// Blizzard: first eligible HIT procs automatically; misses never spend the 45-second cooldown.
fresh();run(`receive('blizzard_cannon',1);equip('blizzard_cannon');Math.random=()=>0.999;globalThis.r=strikeDrone(a,d,Date.now())`);eq('r.effect.frozen',false);eq('equipmentState(a,"weapon").readyAt',undefined);
run(`Math.random=()=>0;globalThis.r=strikeDrone(a,d,Date.now())`);eq('r.effect.frozen',true);eq('d.frozenUntil',1004000);eq('equipmentState(a,"weapon").readyAt',1045000);
eq('applyWeaponEffects(a,d,"gun",true,1044999).frozen',false);eq('applyWeaponEffects(a,d,"gun",true,1045000).frozen',true);
// The shared target effect also blocks a character's HP/ST consumables, without consuming items or CT.
run(`globalThis.target={...comActors[0],character:'kaito',level:1,hp:20,st:20,bag:[{id:'ration',count:2},{id:'drink',count:2}],inventory:{ration:2,drink:2},recoveryReadyAt:{hp:0,stamina:0}};equipmentState(a,'weapon').readyAt=0;applyWeaponEffects(a,target,'gun',true,1000000)`);
eq('recoverActor(target,"ration",1003999)',false);eq('recoverActor(target,"drink",1003999)',false);eq('target.inventory.ration',2);eq('target.recoveryReadyAt.hp',0);eq('recoverActor(target,"ration",1004000)',true);eq('recoverActor(target,"drink",1004000)',true);
run(`a.frozenUntil=Date.now()+4000;a.hp=50;receive('ration',1);useItem('ration');toggleRecoveryMode('hp')`);eq('a.inventory.ration',1);eq('a.recoveryMode','hp');h.advance(1000);eq('a.hp',52);
// Equipment instance counters and cooldowns survive unequip, dropped pickup and corpse transfer.
fresh();run(`receive('magma_blaster',1);equip('magma_blaster');applyWeaponEffects(a,d,'gun',false,Date.now());applyWeaponEffects(a,d,'gun',false,Date.now());unequip('weapon');discardStack(0);addFound(a.found.pop());decideFound(true);equip('magma_blaster');`);eq('applyWeaponEffects(a,d,"gun",false,Date.now()).fixedDamage',15);
fresh();run(`receive('blizzard_cannon',1);equip('blizzard_cannon');applyWeaponEffects(a,d,'gun',true,Date.now());globalThis.body=createPlayerCorpse(a);globalThis.entry=body.items.find(x=>x.id==='blizzard_cannon');a.hp=100;receive(entry.id,1,entry);equip(entry.id)`);eq('equipmentState(a,"weapon").readyAt',1045000);eq('applyWeaponEffects(a,d,"gun",true,Date.now()).frozen',false);
// Durability immunity integrates with the shared loss hook; no new baseline decay is introduced.
fresh();run(`receive('amalgam_bow',1);equip('amalgam_bow');equipmentState(a,'weapon').durability=20`);eq('damageEquipmentDurability(a,"weapon",5)',0);eq('equipmentState(a,"weapon").durability',20);
// Exploration generation: threshold, vacant-slot rule, skipped trigger, per-instance persistence.
fresh();run(`receive('stargazing_telescope',1);equip('stargazing_telescope');for(let i=0;i<14;i++)recordExploration(a,Date.now())`);eq('a.bag.length',0);run('recordExploration(a,Date.now())');eq('a.bag.length',1);eq('a.bag[0].id','stone');eq('a.ticks',15);
run(`a.bag=Array.from({length:6},()=>({id:'stone',count:1}));syncInventory();for(let i=0;i<15;i++)recordExploration(a,Date.now())`);eq('a.inventory.stone',6);eq('equipmentState(a,"accessory").searches',0);run('a.bag.pop();syncInventory();recordExploration(a,Date.now())');eq('a.inventory.stone',5);
fresh();run(`receive('mythic_telescope',1);equip('mythic_telescope');for(let i=0;i<9;i++)recordExploration(a,Date.now());unequip('accessory');equip('mythic_telescope');recordExploration(a,Date.now())`);eq('a.bag.length',1);eq('RECIPE_RARITY[a.bag[0].id]','rare');
// Real player exploration completions trigger rewards; rejected clicks do not.
fresh();run(`receive('stargazing_telescope',1);equip('stargazing_telescope');equipmentState(a,'accessory').searches=14;d.spawned=false;primary();primary()`);eq('equipmentState(a,"accessory").searches',14);h.tickAction();eq('equipmentState(a,"accessory").searches',0);eq('a.inventory.stone',1);eq('a.ticks',1);
// Paid stock exploration also counts once after collection, while room is evaluated at completion.
fresh();run(`receive('mythic_telescope',1);equip('mythic_telescope');equipmentState(a,'accessory').searches=9;a.found=[{id:'wood',count:1}];takeFound(0)`);h.tickAction();eq('equipmentState(a,"accessory").searches',0);eq('a.inventory.wood',1);eq('a.bag.length',2);
// Tier weights are per tier, independent of the number of materials in that tier.
fresh();for(const [roll,tier]of [[0,'common'],[0.5999,'common'],[0.60,'uncommon'],[0.8499,'uncommon'],[0.85,'rare'],[0.9699,'rare'],[0.97,'epic'],[0.999,'epic']])eq(`RECIPE_RARITY[selectGeneratedMineral(null,()=>${roll})]||'common'`,tier);
for(const [roll,tier]of [[0,'rare'],[0.7999,'rare'],[0.8,'epic'],[0.999,'epic']])eq(`RECIPE_RARITY[selectGeneratedMineral('rare',()=>${roll})]`,tier);
// The same exploration and item-effect hooks run for COM actors.
h=harness();run=s=>h.run(s);run(`globalThis.a=comActors[0];a.place='山岳区画';matchClock.section=1;a.bag=[];syncInventory(a);receive('mythic_telescope',1,null,a);equipActor(a,0);for(let i=0;i<10;i++)recordExploration(a,Date.now())`);eq('a.bag.length',1);eq('S.inventory.ration',2);assert(run('a.history.some(x=>x.text.includes("神の恵み"))'));
console.log('PASS: 25 exact stats/capacities, stacking accuracy, infinite laser, miss-count eruption, actual-damage ceil-5% healing, freeze/automatic CT, equipment-state transfer, durability immunity and tier-weighted player/COM exploration rewards');
