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


const expected=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../HP_RECIPES_20261026.json'),'utf8'));
let h=harness(),run=h.run;
for(const item of expected.items){
 assert.equal(run(`names['${item.id}']`),item.name);
 assert.equal(run(`RECIPE_RARITY['${item.id}']`),item.rarity);
 if(item.hp!==null)assert.equal(run(`RECOVERY_ITEMS['${item.id}'].amount`),item.hp);
 if(!item.need)continue;
 h=harness();run=h.run;
 run(`S.bag=[];S.equipment={};syncInventory();var r=recipes.find(r=>r.id==='${item.id}')`);
 assert.deepEqual(JSON.parse(run('JSON.stringify(r.need)')),item.need);assert.equal(run('r.count||1'),item.count);
 for(const [id,count] of Object.entries(item.need))run(`receive('${id}',${count})`);
 assert.equal(run('craftActor(S,r)'),true);assert.equal(run(`S.inventory['${item.id}']`),item.count);
 for(const id of Object.keys(item.need))assert.equal(run(`S.inventory['${id}']||0`),0);
 if(item.hp!==null){run('S.hp=1;S.recoveryReadyAt={hp:0,stamina:0}');assert.equal(run(`recoverActor(S,'${item.id}',Date.now())`),true);assert.equal(run('S.hp'),Math.min(180,1+item.hp));assert.equal(run('S.recoveryReadyAt.hp'),run('Date.now()+3000'));}
}
h=harness();run=h.run;
run("S.bag=[];S.equipment={body:'archangel_robe'};syncInventory();receive('healing_potion',1);receive('small_flower',1);craftActor(S,recipes.find(r=>r.id==='medium_healing_potion'))");assert.equal(run('S.inventory.medium_healing_potion'),4);
run("receive('paradisefish',1);craftActor(S,recipes.find(r=>r.id==='advanced_healing_potion'))");assert.equal(run('S.inventory.advanced_healing_potion'),4);
run("S.bag=[];S.equipment={weapon:'heated_frying_pan'};syncInventory();receive('egg',1);craftActor(S,recipes.find(r=>r.id==='fried_egg'))");assert.equal(run('S.equipment.weapon'),null);assert.equal(run('S.inventory.fried_egg'),2);
run("S.bag=[{id:'medium_ration',count:2},{id:'salted_meat',count:2},{id:'premium_ration',count:8},{id:'wood',count:10},{id:'stone',count:10},{id:'wire',count:10}];syncInventory();var before=JSON.stringify(S.bag)");assert.equal(run("craftActor(S,recipes.find(r=>r.id==='premium_ration'))"),false);assert.equal(run('JSON.stringify(S.bag)'),run('before'));
for(const [area,stock] of Object.entries(expected.placements))for(const [id,count] of Object.entries(stock))assert.equal(run(`regionObjects['${area}'].filter(x=>x.id==='${id}').length`),count);
assert.equal(run("CRAFT_SUBCATEGORIES.weapon.some(([id])=>id==='hammer')"),true);assert.equal(run("recipeSubcategory(recipes.find(r=>r.id==='heated_frying_pan'))"),'hammer');assert.equal(run("equipmentDef('frying_pan').weaponType"),'hammer');assert.equal(run("equipmentDef('frying_pan').attack"),4);assert.equal(run("equipmentDef('heated_frying_pan').attack"),16);
assert.equal(run("supplySetCount('medium_healing_potion')"),3);assert.equal(run("supplySetCount('premium_ration')"),3);
console.log('PASS: all HP recipes, rarities, exact yields/heals, ingredient consumption, shared recovery CT, potion bonuses, equipped pan cooking, full-bag atomic failure and raw material placements');
