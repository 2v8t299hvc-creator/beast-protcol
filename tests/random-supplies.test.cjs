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

fresh();
const expectedDrops={bird:['egg','feather'],fish:['fish_scale','water'],dog:['beast_meat','fur'],humanoid:['ration','lighter'],octopus:['rubbery_hide','rock_salt'],scorpion:['wonderjewel','cell'],dragon:['dragon_scale','advanced_healing_potion','advanced_stamina_potion','diamond','ruby','sapphire']};
const expectedTables={bird:['weapon'],fish:['armor'],dog:['weapon','other'],humanoid:['weapon','other'],octopus:['weapon','other','other'],scorpion:['armor','other','other'],dragon:['other','other','other']};
assert.deepEqual(plain('STARTING_SUPPLY_TABLES'),['weapon','armor','other']);assert.deepEqual(plain('DRONE_SUPPLY_TABLES'),expectedTables);
for(const [kind,drops]of Object.entries(expectedDrops)){assert.deepEqual(plain(`DRONE_DEFS.${kind}.drops`),drops);for(let i=0;i<30;i++){run(`var body=createDroneCorpse('${kind}',S.place,Date.now(),null);var extras=body.items.slice(${drops.length})`);eq('extras.length',expectedTables[kind].length);eq('new Set(extras.map(x=>x.id)).size',expectedTables[kind].length);assert(run('body.items.every(x=>x.count===supplySetCount(x.id))'));assert(run('body.items.length<=12'));}}
assert(run(`Object.keys(RANDOM_SUPPLY_TABLES).every(t=>supplyCandidates(t).every(id=>names[id]))`));
// Tier boundaries, then uniform item selection within that tier.
for(const type of ['weapon','armor','other'])for(const [roll,tier]of (type==='other'?[[0,'common'],[.599999,'common'],[.6,'uncommon'],[.799999,'uncommon'],[.8,'rare'],[.949999,'rare'],[.95,'epic'],[.99999,'epic']]:[[0,'common'],[.749999,'common'],[.75,'uncommon'],[.9999,'uncommon']])){
 run(`var draws=[${roll},.5];Math.random=()=>draws.shift()??.5;var item=rollSupply('${type}')`);eq("RECIPE_RARITY[item.id]||'common'",tier);assert(run('item.count===supplySetCount(item.id)'));
}
for(const id of ['meteorite','arrows','bullets','dragon_scale','drago_core','dragon_meat','dragon_fruit','fruit_punch','craft_cola','jewel_meat','heaven_pot','life_elixir'])eq(`supplyCandidates('other').includes('${id}')`,false);
for(const id of ['laurel','obsidian','swordfish','minefish','porcupinefish','paradisefish','small_flower','seaweed','herb','rock_salt','charcoal','hotwater','core','boiled_egg','paradise_broth','soda','compressed_ration'])eq(`supplyCandidates('other').includes('${id}')`,true);
eq("supplyCandidates('weapon').includes('scissors')",true);eq("supplyCandidates('weapon').includes('frying_pan')",true);assert(run(`Object.keys(EQUIPMENT_DEFS).filter(id=>!PRACTICE_WEAPONS[id]&&['common','uncommon'].includes(RECIPE_RARITY[id]||'common')).every(id=>supplyCandidates(equipmentDef(id).slot==='weapon'?'weapon':'armor').includes(id))`));
// All six training weapons remain selectable, but cannot enter starting/drone reward pools.
eq('Object.keys(PRACTICE_WEAPONS).length',6);
for(const id of ['practice_sword','practice_hammer','practice_gauntlet','practice_bow','practice_gun','practice_spear']){
 eq(`supplyCandidates('weapon').includes('${id}')`,false);eq(`isRandomSupplyItem('${id}')`,false);
 eq(`encyclopediaSources('${id}').practice`,true);eq(`encyclopediaSources('${id}').random`,false);
 run(`matchClock.section=0;S.place='待機所';selectPracticeWeapon('${id}')`);eq('S.starterWeapon',id);eq('S.equipment.weapon',id);
}
// Seeded sampling catches accidentally weighting individual items instead of tiers.
run(`var seed=147;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};var counts={};for(let i=0;i<20000;i++){const id=rollSupply('other').id,t=RECIPE_RARITY[id]||'common';counts[t]=(counts[t]||0)+1}`);
for(const [tier,rate]of Object.entries({common:.6,uncommon:.2,rare:.15,epic:.05}))assert(Math.abs(run(`counts.${tier}/20000`)-rate)<.015);
// The once-only starting grant really gives one weapon, armor, other set and fits the six-slot bag.
run(`S.place='待機所';S.bag=[{id:'ration',count:2},{id:'drink',count:2}];syncInventory();S.startingSuppliesGranted=false;grantStartingSupplies(S);var granted=JSON.stringify(S.bag);grantStartingSupplies(S)`);eq('JSON.stringify(S.bag)',run('granted'));assert(run('S.bag.length<=6'));assert(run("S.bag.some(x=>equipmentDef(x.id)?.slot==='weapon')"));assert(run("S.bag.some(x=>equipmentDef(x.id)&&equipmentDef(x.id).slot!=='weapon')"));
eq("craftTargetSources('soda').random",true);eq("craftTargetSources('meteorite').random",false);run(`showMaterialSource('soda')`);assert(run(`!document.getElementById('modalBody').innerHTML.includes('ランダムE')`));
console.log('PASS: exact starting/drone fixed drops and 3 reward groups; every eligible weapon/armor; rarity boundaries and seeded distribution; exact other inclusions/exclusions; real sets, distinct random rolls, six-slot starting grant and source hints.');
