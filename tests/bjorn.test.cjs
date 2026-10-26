// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(3)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
run("var a=comActors[2];stepCom(a,Date.now())");assert.equal(run('a.name'),'ビヨルン');assert.equal(run('a.character'),'bjorn');assert.equal(run('a.preferredWeaponType'),'hammer');assert.equal(run('a.masteryAttacks.hammer'),20);assert.equal(run('a.masteryAttacks.bow'),0);assert.equal(run('a.equipment.weapon'),'practice_hammer');assert.equal(run('a.equipmentAmmo.weapon'),undefined);
assert.equal(run('a.goals.includes("keraunos_hammer")'),true);assert.equal(run('comAmmoType(a)'),null);
run("a.bag=[];syncInventory(a);var plan={missing:{},needed:{},crafts:[]}");assert.equal(run('comWants(a,"bullets",plan)'),false);assert.equal(run('comWants(a,"arrows",plan)'),false);
run("receive('wood_mallet',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'wood_mallet');
run("receive('japanese_bow',1,null,a);receive('rifle',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'wood_mallet');assert.equal(run('reloadActor(a)'),0);
run("a.place=S.place;S.hp=180;Math.random=()=>0;var result=actorAttack(a,S,Date.now())");assert.equal(run('result.type'),'hammer');assert.equal(run('a.masteryAttacks.hammer'),21);
run("S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat();showIncomingDamage(a,{dealt:10});announceComDeath(a,'戦闘',Date.now(),S.id)");
assert.equal(run("$('enemyArt').src"),run('actorArt(a)'));assert.equal(run("$('incomingFace').src"),run('actorArt(a)'));assert.equal(run('deathNotices.at(-1).art'),run('actorArt(a)'));assert.equal(run("$('deathFeed').innerHTML.includes('bjorn_encounter_transparent.webp')"),true);
assert(fs.existsSync(require('node:path').join(__dirname,'../assets/characters/bjorn_encounter_transparent.webp')));
console.log('PASS: Bjorn hammer D+, practice hammer without ammo, hammer crafting goals/preference, no ammunition pickup/reload, real hammer attack and all portraits');
