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


const config=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../STAMINA_RECIPES_20261026.json'),'utf8'));
let h=harness(),run=h.run;
for(const item of config.items){
 assert.equal(run(`names['${item.id}']`),item.name);assert.equal(run(`RECIPE_RARITY['${item.id}']||'common'`),item.rarity);assert.equal(run(`RECOVERY_ITEMS['${item.id}'].group`),'stamina');assert.equal(run(`RECOVERY_ITEMS['${item.id}'].amount`),item.stamina);
 if(!item.need)continue;
 h=harness();run=h.run;run(`S.bag=[];S.equipment={};syncInventory();var recipe=recipes.find(r=>r.id==='${item.id}')`);assert.deepEqual(JSON.parse(run('JSON.stringify(recipe.need)')),item.need);assert.equal(run('recipe.count||1'),item.count);
 for(const [id,count] of Object.entries(item.need))run(`receive('${id}',${count})`);
 assert.equal(run('craftActor(S,recipe)'),true);assert.equal(run(`S.inventory['${item.id}']`),item.count);
 run('S.st=0;S.recoveryReadyAt={hp:0,stamina:0}');assert.equal(run(`recoverActor(S,'${item.id}',Date.now())`),true);assert.equal(run('S.st'),Math.min(120,item.stamina));assert.equal(run('S.recoveryReadyAt.stamina'),run('Date.now()+3000'));assert.equal(run('S.recoveryReadyAt.hp'),0);
}
h=harness();run=h.run;
assert.equal(run("itemSetCount('energy_fruit')"),3);assert.equal(run("supplySetCount('energy_fruit')"),3);
for(const [area,stock] of Object.entries(config.placements))for(const [id,count] of Object.entries(stock)){assert.equal(run(`regionObjects['${area}'].filter(x=>x.id==='${id}').length`),count);if(id==='energy_fruit')assert.equal(run(`regionObjects['${area}'].filter(x=>x.id==='energy_fruit').every(x=>x.count===3)`),true);}
assert.equal(run("Object.values(regionStock).some(stock=>stock.soda)"),false);assert.equal(run("recipes.some(r=>r.id==='soda')"),false);
run('Math.random=()=>0.95');assert.equal(run("rollSupply('E').id"),'soda');run('Math.random=()=>0.949999');assert.notEqual(run("rollSupply('E').id"),'soda');run('Math.random=()=>0.99');assert.notEqual(run("rollSupply('E',new Set(['soda'])).id"),'soda');
for(const id of config.potionBonus){run(`S.bag=[];S.equipment={body:'archangel_robe'};syncInventory();var recipe=recipes.find(r=>r.id==='${id}');for(const [id,n] of Object.entries(recipe.need))receive(id,n);craftActor(S,recipe)`);assert.equal(run(`S.inventory['${id}']`),4);}
run("S.bag=[{id:'soda',count:2},{id:'energy_fruit',count:3},{id:'fruit_punch',count:8},{id:'wood',count:10},{id:'stone',count:10},{id:'wire',count:10}];syncInventory();var before=JSON.stringify(S.bag)");assert.equal(run("craftActor(S,recipes.find(r=>r.id==='fruit_punch'))"),false);assert.equal(run('JSON.stringify(S.bag)'),run('before'));
run("S.equipment={legs:'energy_socks'};S.bag=[];syncInventory();receive('craft_cola',1);S.st=0;S.recoveryReadyAt.stamina=0;recoverActor(S,'craft_cola',Date.now())");assert.equal(run('S.st'),150);
console.log('PASS: stamina recipes/heals/yields/rarity, independent CT, fruit sets, raw placement, soda-only random 5% boundary/exclusion, S potion bonus, atomic full bag and cola max-ST cap');
