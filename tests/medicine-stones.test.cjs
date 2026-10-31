// Actual game integration checks for mineral recipes and action-recovery accessories.
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
// Exact inputs, output counts and proper crafting tabs for all five recipes.
for(const [id,need] of [
 ['whitestone',{stone:1,marble:1}],['bluestone',{stone:1,fish_scale:1}],['redstone',{stone:1,minefish:1}],
 ['medical_stone',{stone:1,kit:1}],['philosophers_stone',{medical_stone:1,herb_oil:1}],['kit',{cloth:1,cell:1}]
]){
 fresh();eq(`recipes.filter(r=>r.id==='${id}').length`,1);assert.deepEqual(plain(`recipes.find(r=>r.id==='${id}').need`),need);
 for(const [ingredient,n]of Object.entries(need))run(`receive('${ingredient}',${n})`);
 eq(`craftActor(S,recipes.find(r=>r.id==='${id}'))`,true);eq(`S.inventory['${id}']`,1);
 for(const ingredient of Object.keys(need))eq(`S.inventory['${ingredient}']||0`,0);
 eq(`recipeSubcategory(recipes.find(r=>r.id==='${id}'))`,id==='kit'?'recovery':id.endsWith('stone')&&['whitestone','bluestone','redstone'].includes(id)?'mineral':'accessory');
}
for(const [id,rarity,defense,skill,n] of [['medical_stone','rare',16,'薬効あり',1],['philosophers_stone','epic',20,'ヒーリングオーラ',2]]){
 fresh();eq(`RECIPE_RARITY.${id}`,rarity);eq(`equipmentDef('${id}').defense`,defense);eq(`equipmentDef('${id}').slot`,'accessory');eq(`EQUIPMENT_SPECIAL_EFFECTS.${id}.name`,skill);
 // Only equipped gear activates the passive, with no menu/equip/unequip healing loop.
 run(`S.hp=50;receive('${id}',1);recordExploration(S,Date.now());showBag();equip('${id}');showEquipment();refresh()`);eq('S.hp',50);
 run('recordExploration(S,Date.now())');eq('S.hp',50+n);
 run(`unequip('accessory');recordExploration(S,Date.now());equip('${id}')`);eq('S.hp',50+n);
 // The passive ignores item recovery multipliers and caps at max HP without resurrecting.
 run(`S.equipment.arm='ruby_bracelet';S.hp=50;recoverOnAction(S)`);eq('S.hp',50+n);
 run('S.hp=actorMax(S,"hp")-1;recoverOnAction(S)');eq('S.hp===actorMax(S,"hp")',true);
 run('S.hp=0;recoverOnAction(S)');eq('S.hp',0);
 // Same effect for COM: successful search, move, craft, reload and item use.
 run(`target.hp=50;target.equipment.accessory='${id}';recordExploration(target,Date.now());payMovementCost(target)`);eq('target.hp',50+2*n);
 run(`target.level=15;target.hp=50;receive('stone',1,null,target);receive('marble',1,null,target);craftActor(target,recipes.find(r=>r.id==='whitestone'))`);eq('target.hp',50+n);
 run(`target.equipment.weapon='practice_gun';target.equipmentAmmo.weapon=0;receive('bullets',20,null,target);reloadActor(target)`);eq('target.hp',50+2*n);
 run(`target.st=1;receive('drink',1,null,target);recoverActor(target,'drink')`);eq('target.hp',50+3*n);
 // PVP hits heal once. A drone counter resolves before recovery and cannot resurrect a dead actor.
 run(`S.hp=50;actorAttack(S,target,Date.now())`);eq('S.hp',50+n);
 run(`S.hp=50;d.hp=100000;var hit=strikeDrone(S,d,Date.now())`);eq('S.hp',50-run('hit.counter')+n);
 run(`S.hp=1;d.hp=100000;strikeDrone(S,d,Date.now())`);eq('S.hp',0);
 // Failed/repeated recovery and full-magazine reloads grant nothing.
 run(`S.hp=50;S.equipment.weapon='practice_gun';S.equipmentAmmo.weapon=20;receive('bullets',20);reloadActor(S);recoverActor(S,'missing');craftActor(S,recipes.find(r=>r.id==='philosophers_stone'))`);eq('S.hp',50);
 // Preparation and match-end UI remain free of regeneration.
 run(`matchClock.section=0;recoverOnAction(S);recordExploration(S,Date.now());matchClock.section=1;matchClock.ended=true;recoverOnAction(S)`);eq('S.hp',50);
}
// A paid search, including stock rediscovery, triggers at completion only. Rejected clicks do not heal.
fresh();equip('medical_stone');run(`matchClock.competitive=false;S.hp=50;primary();primary()`);eq('S.hp',50);run(`timers.find(t=>t.ms===1000).fn()`);eq('S.hp',51);
fresh();equip('medical_stone');run(`matchClock.competitive=false;S.hp=50;S.found=[{id:'stone',count:1}];takeFound(0);takeFound(0)`);eq('S.hp',50);run(`timers.find(t=>t.ms===1000).fn();decideFound(true)`);eq('S.hp',51);
// Crafting the equipped ingredient consumes exactly one stone, and resolves the old stone's action heal.
fresh();equip('medical_stone');run(`S.hp=50;S.level=15;receive('herb_oil',1);var made=craftActor(S,recipes.find(r=>r.id==='philosophers_stone'))`);eq('made',true);eq('S.equipment.accessory',null);eq('S.inventory.medical_stone||0',0);eq('S.inventory.philosophers_stone',1);eq('S.hp',51);run(`equip('philosophers_stone');recordExploration(S,Date.now())`);eq('S.hp',53);
// One volley activation heals once, rather than once per projectile, against players and drones.
for(const drone of [true,false]){
 fresh();equip('philosophers_stone');equip('practice_gun');run(`S.character='bat';S.hp=100;var volley=executeDanse(S,${drone?'d':'target'},Date.now(),${drone})`);assert(run('volley.shots.length>=6'));eq('S.hp',102-(drone?run('volley.counter||0'):0));
}
// Field actions obey the same accepted-action rule and cooldowns.
fresh();equip('medical_stone');run(`S.hp=50;S.character='bjorn';gatherHerbs(S);gatherHerbs(S)`);eq('S.hp',51);
fresh();equip('medical_stone');run(`S.hp=50;S.character='zakuro';receive('stone',1);consumeMineral(S,'stone');consumeMineral(S,'stone')`);eq('S.hp',51);
// HP-funded movement pays its cost first, with no revival after a lethal cost.
fresh();equip('medical_stone');run(`S.st=0;S.hp=10;payMovementCost(S)`);eq('S.hp',6);run(`S.hp=5;payMovementCost(S)`);eq('S.hp',0);
// Failed full-bag crafting is atomic and grants no passive recovery.
fresh();equip('medical_stone');run(`S.hp=50;S.bag=[{id:'stone',count:10},{id:'marble',count:10},...Array.from({length:4},()=>({id:'wood',count:10}))];syncInventory();var made=craftActor(S,recipes.find(r=>r.id==='whitestone'))`);eq('made',false);eq('S.hp',50);eq('S.inventory.stone',10);
// Recipe-dependent COM planning sees both new intermediate mineral routes and worn accessory ingredients.
fresh();run(`target.bag=[];target.inventory={};target.equipment.accessory='medical_stone';receive('herb_oil',1,null,target);var plan=comPlan(target,'philosophers_stone')`);assert.deepEqual(plain('plan.missing'),{});assert(run(`plan.crafts.includes('philosophers_stone')`));
console.log('PASS: six exact recipes, rarity/defense/skill names, crafting tabs, worn ingredient crafting, equipped-only player/COM action healing, paid search timing, one-heal volleys, field cooldowns, caps/death safety and failed-action/menu spam exclusions.');
