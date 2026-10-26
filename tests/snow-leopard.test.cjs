// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(2)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
run("var a=comActors[1];stepCom(a,Date.now())");assert.equal(run('a.character'),'snow_leopard');assert.equal(run('a.masteryAttacks.gun'),26);assert.equal(run('a.masteryAttacks.bow'),0);assert.equal(run('a.equipment.weapon'),'practice_gun');assert.equal(run('a.equipmentAmmo.weapon'),20);
assert.equal(run('a.goals.includes("laser_rifle")'),true);assert.equal(run('comAmmoType(a)'),'bullets');
run("a.bag=[];syncInventory(a);var plan={missing:{},needed:{},crafts:[]}");assert.equal(run('comWants(a,"bullets",plan)'),true);assert.equal(run('comWants(a,"arrows",plan)'),false);
run("receive('rifle',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'rifle');
run("a.equipmentAmmo.weapon=0;receive('bullets',20,null,a);reloadActor(a)");assert.equal(run('a.equipmentAmmo.weapon'),6);
run("receive('japanese_bow',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'rifle');
run("S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat();showIncomingDamage(a,{dealt:10});announceComDeath(a,'戦闘',Date.now(),S.id)");
assert.equal(run("$('enemyArt').src"),run('actorArt(a)'));assert.equal(run("$('incomingFace').src"),run('actorArt(a)'));assert.equal(run('deathNotices.at(-1).art'),run('actorArt(a)'));
assert.equal(run("$('deathFeed').innerHTML.includes('snow_leopard_encounter_transparent.webp')"),true);
console.log('PASS: snow leopard gun D+, practice gun, rifle goals, bullets pickup/reload, weapon preference and encounter/damage/death portraits');
