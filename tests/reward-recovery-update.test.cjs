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
let run;function fresh(){run=harness()}const eq=(s,v)=>assert.equal(run(s),v,s);
function equip(id){run(`receive('${id}',1);equip('${id}')`)}
const plain=s=>JSON.parse(run(`JSON.stringify(${s})`));

const expected={jewel_meat:{name:'ジュエルミート',need:{beast_meat:1,wonderjewel:1},count:2,tier:'epic',amount:140},heaven_pot:{name:'天国鍋',need:{paradisefish:1,herb_oil:1},count:3,tier:'epic',amount:120},compressed_ration:{name:'圧縮レーション',need:{premium_ration:1,cell:1},count:1,tier:'rare',amount:150},life_elixir:{name:'生命の秘薬',need:{laurel:1,poison_potion:1},count:1,tier:'legendary',amount:220}};
for(const [id,e]of Object.entries(expected)){
 fresh();eq(`names.${id}`,e.name);eq(`RECIPE_RARITY.${id}`,e.tier);eq(`RECOVERY_ITEMS.${id}.amount`,e.amount);eq(`ITEM_CRAFT_GROUP.${id}`,'recovery');assert.deepEqual(plain(`recipes.find(r=>r.id==='${id}').need`),e.need);eq(`recipes.find(r=>r.id==='${id}').count`,e.count);
 for(const [mat,n]of Object.entries(e.need))run(`receive('${mat}',${n})`);
 eq(`craftActor(S,recipes.find(r=>r.id==='${id}'),1000000)`,true);eq(`S.inventory.${id}`,e.count);for(const mat of Object.keys(e.need))eq(`S.inventory.${mat}||0`,0);
 run(`S.hp=1`);eq(`recoverActor(S,'${id}',1000000)`,true);eq('S.hp',Math.min(1+e.amount,run('maxHp()')));eq('S.recoveryReadyAt.hp',1005000);assert(run('S.bag.length<=6'));
}
fresh();for(const [id,tier]of Object.entries({energy_drink:'uncommon',healing_potion:'common',stamina_potion:'common',medium_healing_potion:'uncommon'}))eq(`RECIPE_RARITY.${id}`,tier);eq('RECOVERY_ITEMS.medium_healing_potion.amount',45);eq('RECOVERY_ITEMS.advanced_healing_potion.amount',70);eq('PLAYER_DISCOVERY_RATE',.9);eq('DRONE_DISCOVERY_RATE',.85);run(`target.character='raku';target.equipment={}`);eq('actorDiscoveryRate(target)',.9);eq('equipmentDef("scissors").attack',8);eq('equipmentDef("scissors").weaponType','slash');eq('equipmentDef("frying_pan").attack',7);eq('equipmentDef("frying_pan").weaponType','hammer');
// A carried or worn scissors can still be consumed by its original clothing recipe.
run(`receive('scissors',1);equip('scissors');receive('fine_cloth',1)`);eq(`craftActor(S,recipes.find(r=>r.id==='suit'))`,true);eq('S.equipment.weapon',null);eq('S.inventory.suit',1);
// Half durability opens a real same-weapon replacement plan without pretending the equipped copy is new.
fresh();run(`var a=target;a.character='flugel';a.preferredWeaponType='slash';a.equipment={weapon:'kukri',head:'steampunk_goggles',arm:'hermes_bracelet',body:'dragon_suit',legs:'diamond_boots',accessory:'mythic_telescope'};a.equipmentEffects={};a.bag=[];syncInventory(a);var state=equipmentState(a,'weapon');state.durability=6`);eq('comWeaponNeedsReplacement(a)',false);run(`state.durability=5;receive('jambiya',2,null,a);var p=comCurrentPlan(a)`);eq('comWeaponNeedsReplacement(a)',true);eq('p.id','kukri');eq('p.replacement',true);assert(run("p.crafts.includes('kukri')"));eq(`craftActor(a,recipes.find(r=>r.id==='kukri'))`,true);eq('comEquipBetter(a,1000000)',true);eq('equipmentState(a,"weapon").durability',10);eq('a.bag.find(x=>x.id==="kukri").effects.durability',5);
// Indestructible infinite-ammo weapons discard redundant weapons, retain recipe inputs, and never craft an accessory just to replace the quiver.
fresh();run(`var a=target;a.character='hayate';a.preferredWeaponType='bow';a.equipment={weapon:'dragon_killer',head:'steampunk_goggles',arm:'hermes_bracelet',body:'dragon_suit',legs:'diamond_boots',accessory:'apollo_quiver'};a.equipmentEffects={};a.bag=[];syncInventory(a);receive('azusa_bow',1,null,a);var plan=comCurrentPlan(a)`);eq('comReliableWeapon(a)',true);eq('comWeaponNeedsReplacement(a)',false);assert(run(`!plan.id||equipmentDef(plan.id)?.slot!=='accessory'`));eq(`comDiscardRedundantWeapon(a,{needed:{azusa_bow:1}},1000000)`,false);eq(`comDiscardRedundantWeapon(a,{needed:{}},1000000)`,true);eq('a.inventory.azusa_bow||0',0);eq('a.equipment.accessory','apollo_quiver');
// A better found accessory is still evaluated, with no crafting detour.
run(`receive('mythic_telescope',1,null,a)`);eq('comEquipBetter(a,1001000)',true);eq('a.equipment.accessory','mythic_telescope');
// The COM can turn a common late-game supply pair into actual 150-point recovery.
fresh();run(`var a=target;a.level=15;a.equipment={weapon:'laser_rifle'};a.bag=[];syncInventory(a);receive('premium_ration',1,null,a);receive('cell',1,null,a);var p=comRecoveryPlan(a,1000000,{needed:{}})`);eq('p.recipeId','compressed_ration');eq(`craftActor(a,recipes.find(r=>r.id===p.recipeId))`,true);eq('a.inventory.compressed_ration',1);
console.log('PASS: all four exact recipes, tiers, amounts, outputs and real consumption/healing; recovery rebalance, scissors/pan compatibility, 90% PvP discovery, half-durability replacement, immortal-weapon bag cleanup and opportunistic accessory swaps.');
