// Integration tests for crafting target allocation, sources and live UI updates.
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
// Targets are recipes only, are free to inspect and retain the existing crafting entry points.
fresh();run(`S.hp=50;S.st=50;var before=JSON.stringify([S.bag,S.inventory,S.equipment]);setCraftTarget('medical_stone')`);
eq('S.craftTarget','medical_stone');eq('S.hp',50);eq('S.st',50);eq('JSON.stringify([S.bag,S.inventory,S.equipment])',run('before'));
assert(run(`craftRecipeHTML(recipes.find(r=>r.id==='medical_stone')).includes('📌 製作目標を確認')`));
assert.deepEqual(plain('craftTargetPlan().missing'),{stone:1,cloth:1,cell:1});eq('craftTargetPlan().owned',0);eq('craftTargetPlan().ready.length',0);
run(`setCraftTarget('not-a-recipe')`);eq('S.craftTarget','medical_stone');
// A carried intermediate removes its entire ingredient branch, rather than counting both routes.
run(`receive('kit',1);refresh()`);assert.deepEqual(plain('craftTargetPlan().missing'),{stone:1});
assert(run(`$('craftTargetContent').innerHTML.includes('石ころ ×1')`));
run(`receive('stone',1);refresh()`);assert.deepEqual(plain('craftTargetPlan().missing'),{});eq('craftTargetPlan().ready[0].id','medical_stone');assert(run(`$('craftTargetSummary').textContent.includes('製作可：')`));
// Root ownership in either bag or equipment marks completion; consuming it makes the goal live again.
run(`craftActor(S,recipes.find(r=>r.id==='medical_stone'));refresh()`);eq('craftTargetPlan().owned',1);assert(run(`$('craftTargetSummary').textContent.includes('✓')`));
run(`equip('medical_stone');refresh()`);eq('craftTargetPlan().owned',1);assert.deepEqual(plain('craftTargetAreaNeeds()'),{});
run(`setCraftTarget('philosophers_stone');receive('herb_oil',1);refresh()`);assert.deepEqual(plain('craftTargetPlan().missing'),{});eq('craftTargetPlan().ready[0].id','philosophers_stone');
// Intermediate craft buttons advance toward the pinned goal without replacing it.
fresh();run(`receive('stone',1);receive('cloth',1);receive('cell',1);setCraftTarget('medical_stone')`);assert.deepEqual(plain('craftTargetPlan().missing'),{});eq('craftTargetPlan().ready[0].id','kit');assert(run(`craftTargetBodyHTML().includes('今作れる中間素材')`));
run(`craft('kit','item')`);eq('S.craftTarget','medical_stone');eq('craftTargetPlan().ready[0].id','medical_stone');assert(run(`$('craftTargetSummary').textContent.includes('製作可：')`));
// Shared resources may be spent only once across two branches, and surplus batch outputs are reused.
fresh();run(`recipes.push({id:'pin_test_goal',name:'G',category:'item',need:{pin_test_a:1,pin_test_b:1}},
 {id:'pin_test_a',name:'A',category:'item',need:{stone:1,wood:1}},
 {id:'pin_test_b',name:'B',category:'item',need:{stone:1,cloth:1}});receive('stone',1);setCraftTarget('pin_test_goal')`);
assert.deepEqual(plain('craftTargetPlan().missing'),{wood:1,stone:1,cloth:1});
run(`recipes.push({id:'pin_test_batch',name:'Batch',category:'item',count:3,need:{stone:1}},{id:'pin_test_many',name:'Many',category:'item',need:{pin_test_batch:5}});receive('pin_test_batch',1);setCraftTarget('pin_test_many')`);
assert.deepEqual(plain('craftTargetPlan().missing'),{stone:1});eq(`craftTargetPlan().crafts.filter(id=>id==='pin_test_batch').length`,2);
// An equipped potion-yield accessory is included in projected output counts.
fresh();run(`S.equipment.body='archangel_robe';recipes.push({id:'pin_test_potions',name:'P',category:'item',need:{healing_potion:4}});setCraftTarget('pin_test_potions')`);
eq(`craftTargetPlan().crafts.filter(id=>id==='healing_potion').length`,1);
// Planner reads are pure, even with worn ingredients, cycles and repeated renders.
fresh();equip('wood_sword');run(`equipmentState(S,'weapon').durability=3;setCraftTarget('hero_sword');var before=JSON.stringify([S.bag,S.inventory,S.equipment,S.equipmentEffects]);for(let i=0;i<10;i++){craftTargetPlan();renderCraftTarget()}`);eq('JSON.stringify([S.bag,S.inventory,S.equipment,S.equipmentEffects])',run('before'));
run(`recipes.push({id:'pin_cycle_a',name:'A',need:{pin_cycle_b:1}},{id:'pin_cycle_b',name:'B',need:{pin_cycle_a:1}});setCraftTarget('pin_cycle_a')`);eq('craftTargetPlan().missing.pin_cycle_a',1);
// Missing leaves and directly obtainable intermediates both appear on the map.
fresh();run(`setCraftTarget('medical_stone');var areas=craftTargetAreaNeeds();var stoneArea=craftTargetSources('stone').areas[0];var kitArea=craftTargetSources('kit').areas[0]`);
assert(run(`areas[stoneArea].includes('stone')`));assert(run(`areas[kitArea].includes('kit')`));assert(run(`craftTargetBodyHTML().includes('直接入手して製作を省ける中間素材')`));
run(`showMap(false)`);assert(run(`$('modalBody').innerHTML.includes('bp-target-map-hint')`));eq('S.craftTarget','medical_stone');
// Static/public placement hints never reveal live resource depletion or secret COM inventories.
run(`var sourcesBefore=JSON.stringify(craftTargetSources('stone'));regionObjects[stoneArea].forEach(o=>o.taken=true)`);eq('JSON.stringify(craftTargetSources("stone"))',run('sourcesBefore'));
run(`matchClock.blocked=[stoneArea];matchClock.nextBlocked=[kitArea]`);assert(run(`craftTargetSourceHTML('stone').includes('・封鎖')`));assert(run(`craftTargetSourceHTML('kit').includes('・次に封鎖')`));
// Drone-only and randomized special materials also have useful source hints.
eq(`craftTargetSources('dragon_scale').areas.length`,0);assert(run(`craftTargetSourceHTML('dragon_scale').includes('ドラゴン型ドローン')`));assert(run(`craftTargetSourceHTML('dragon_scale').includes('ランダム配置')`));
// Returning from an ingredient's source page refreshes the goal from current inventory.
fresh();run(`setCraftTarget('medical_stone');showMaterialSource('stone','medical_stone');receive('stone',1);returnFromMaterialSource()`);eq('craftTargetView',true);assert(run(`!craftTargetBodyHTML().includes('石ころ ×1')`));
// Full-bag recipes remain locked although all raw resources exist; no auto-discard or auto-craft.
fresh();run(`S.bag=[{id:'stone',count:10},{id:'marble',count:10},...Array.from({length:4},()=>({id:'wood',count:10}))];syncInventory();setCraftTarget('whitestone')`);assert.deepEqual(plain('craftTargetPlan().missing'),{});eq('craftTargetPlan().ready.length',0);assert(run(`craftTargetBodyHTML().includes('バッグが満杯')`));
// Inspection never hides an unresolved discovery, and unpinning returns the compact HUD to empty.
fresh();run(`S.pendingFound={id:'stone',count:1};$('modalTitle').textContent='アイテム発見';showCraftTarget()`);eq('$("modalTitle").textContent','アイテム発見');run(`S.pendingFound=null;setCraftTarget('medical_stone');clearCraftTarget()`);eq('S.craftTarget',null);eq('$("craftTargetSummary").textContent','未設定');
console.log('PASS: recipe pin/unpin, exact owned/equipped/shared/batch allocation, potion bonuses, pure/cycle-safe planning, live progression/completion, source-page return, public region/drone hints, closure-aware map badges and full-bag/discovery safety.');
