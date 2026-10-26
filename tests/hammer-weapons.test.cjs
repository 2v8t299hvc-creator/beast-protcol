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


const config=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../HAMMER_WEAPONS_20261026.json'),'utf8'));
let h=harness(),run=h.run;
for(const item of config.items){
 assert.equal(run(`names['${item.id}']`),item.name);assert.equal(run(`RECIPE_RARITY['${item.id}']`),item.rarity);assert.equal(run(`equipmentDef('${item.id}').attack`),item.attack);assert.equal(run(`equipmentDef('${item.id}').defense`),item.defense);assert.equal(run(`equipmentDef('${item.id}').weaponType`),'hammer');
 if(!item.need)continue;
 h=harness();run=h.run;run(`S.bag=[];S.equipment={};syncInventory();var r=recipes.find(r=>r.id==='${item.id}')`);assert.deepEqual(JSON.parse(run('JSON.stringify(r.need)')),item.need);
 for(const [id,count] of Object.entries(item.need))run(`receive('${id}',${count})`);
 assert.equal(run('craftActor(S,r)'),true);assert.equal(run(`S.inventory['${item.id}']`),1);
 for(const id of Object.keys(item.need))assert.equal(run(`S.inventory['${id}']||0`),0);
}
h=harness();run=h.run;
run("matchClock.section=1;S.bag=[];S.equipment={weapon:'keraunos_hammer'};S.equipmentEffects={};var enemy=comActors[0];enemy.place=S.place;enemy.equipment={};Math.random=()=>0;var first=actorAttack(S,enemy,Date.now())");assert.equal(run('first.effect.fixedDamage'),12);
assert.equal(run("applyWeaponEffects(S,enemy,'hammer',true,Date.now()+29999).fixedDamage"),0);assert.equal(run("applyWeaponEffects(S,enemy,'hammer',false,Date.now()+30000).fixedDamage"),0);assert.equal(run("applyWeaponEffects(S,enemy,'hammer',true,Date.now()+30000).fixedDamage"),12);
run("enemy.equipment={weapon:'azusa_bow',head:'bluebird_hat',arm:'steel_armguard',body:'rubber_suit',legs:null,accessory:null}");assert.equal(run('judgmentDamage(enemy)'),6);run("RECIPE_RARITY.legend_test='legendary';enemy.equipment.legs='legend_test'");assert.equal(run('judgmentDamage(enemy)'),4);assert.equal(run('judgmentDamage({kind:"bird"})'),12);
run("S.equipment.weapon='bone_crusher';S.equipmentEffects={};Math.random=()=>0.009999;applyWeaponEffects(S,enemy,'hammer',true,Date.now())");assert.equal(run('enemy.injuryUntil'),run('Date.now()+5000'));assert.equal(run('enemy.injurySourceId'),run('S.id'));
run("delete enemy.injuryUntil;Math.random=()=>0.01;applyWeaponEffects(S,enemy,'hammer',true,Date.now())");assert.equal(run('enemy.injuryUntil'),undefined);run("Math.random=()=>0;applyWeaponEffects(S,enemy,'hammer',false,Date.now())");assert.equal(run('enemy.injuryUntil'),undefined);
run("S.equipment={weapon:'super_wild_hammer'};S.equipmentEffects={};S.bag=[];syncInventory();var before=totalStat('attack');for(let i=0;i<3;i++)applyWeaponEffects(S,enemy,'hammer',false,Date.now())");assert.equal(run("totalStat('attack')"),run('before+1'));assert.equal(run("equipmentDef('super_wild_hammer').attack"),35);assert.equal(run("equipmentAttackBonus(enemy)"),0);
run("equipmentState(S,'weapon').durability=5");assert.equal(run("damageEquipmentDurability(S,'weapon',100)"),0);assert.equal(run("equipmentState(S,'weapon').durability"),5);
run("unequip('weapon')");assert.equal(run('S.bag[0].effects.bonusAttack'),1);run("equip('super_wild_hammer')");assert.equal(run('equipmentAttackBonus(S)'),1);
run("var body=createPlayerCorpse(S,S.place,Date.now(),enemy.id)");assert.equal(run("body.items.find(x=>x.id==='super_wild_hammer').effects.bonusAttack"),1);
h=harness();run=h.run;run("S.bag=[];S.equipment={weapon:'wild_hammer'};S.equipmentEffects={};syncInventory();receive('wild_hammer',1);craftActor(S,recipes.find(r=>r.id==='super_wild_hammer'))");assert.equal(run('S.inventory.super_wild_hammer'),1);assert.equal(run('S.equipment.weapon'),null);
for(const [area,stock] of Object.entries(config.placements))for(const [id,count] of Object.entries(stock))assert.equal(run(`regionObjects['${area}'].filter(x=>x.id==='${id}').length`),count);
console.log('PASS: fourteen hammer stats/recipes/placements, six-slot judgment and hit CT, exact 1% injury, miss-inclusive individual growth, durability immunity, transfers and duplicate equipped crafting');
