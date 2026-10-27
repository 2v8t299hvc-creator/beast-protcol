// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(6)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
assert.equal(run('comActors.length'),6);
run("var a=comActors[5];a.bag=[];syncInventory(a);receive('rifle',1,null,a);receive('optical_sight',1,null,a);stepCom(a,Date.now())");
assert.equal(run('a.name'),'コウモリ');assert.equal(run('a.character'),'bat');assert.equal(run('a.masteryAttacks.bow'),14);assert.equal(run('a.masteryAttacks.gun'),14);assert.equal(run('a.starterWeapon'),'practice_gun');assert.equal(run('a.equipmentAmmo.weapon'),20);
run("a.place='射撃演習区画';matchClock.section=1;craftActor(a,recipes.find(r=>r.id==='sniper_rifle'));comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'sniper_rifle');assert.equal(run('comAmmoType(a)'),'bullets');
run("a.place=S.place;S.hp=180;Math.random=()=>0;var shot=actorAttack(a,S,Date.now())");assert.equal(run('shot.type'),'gun');assert.equal(run('a.equipmentAmmo.weapon'),5);
run("receive('azusa_bow',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run("a.bag.find(x=>x.id==='sniper_rifle').ammo"),5);assert.equal(run('a.equipment.weapon'),'azusa_bow');assert.equal(run('a.preferredWeaponType'),'bow');assert.equal(run('comAmmoType(a)'),'arrows');
run("var plan={id:'sniper_rifle',missing:{},needed:{},crafts:[]}");assert.equal(run("comWants(a,'arrows',plan)"),true);assert.equal(run("comWants(a,'bullets',plan)"),true);
run('a.equipmentAmmo.weapon=0');assert.equal(run("receive('arrows',20,null,a)"),true);assert.equal(run('reloadActor(a)'),20);
run("a.place=S.place;S.hp=180;Math.random=()=>0;var result=actorAttack(a,S,Date.now())");assert.equal(run('result.type'),'bow');assert.equal(run('a.masteryAttacks.bow'),15);assert.equal(run('a.masteryAttacks.gun'),18);
run("S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat();showIncomingDamage(a,{dealt:10});announceComDeath(a,'戦闘',Date.now(),S.id)");assert.equal(run("$('enemyArt').src"),run('actorArt(a)'));assert.equal(run("$('incomingFace').src"),run('actorArt(a)'));assert.equal(run('deathNotices.at(-1).art'),run('actorArt(a)'));
assert(fs.existsSync(require('node:path').join(__dirname,'../assets/characters/bat_encounter_transparent.webp')));
const z=harness();z.run("var a=comActors[5];a.bag=[];syncInventory(a);receive('western_bow',1,null,a);receive('bronze',1,null,a);stepCom(a,Date.now())");assert.equal(z.run('a.starterWeapon'),'practice_bow');assert.equal(z.run('a.equipmentAmmo.weapon'),20);
console.log('PASS: bat dual D, materials choose gun or bow start, real gun crafting, cross-type equipment/ammunition/reload/mastery and all portraits');
