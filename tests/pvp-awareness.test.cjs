// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext("globalThis.seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}",context);
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;function fresh(){h=harness();run=h.run;run(`matchClock.section=1;matchClock.competitive=true;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];S.place='山岳区画';S.equipment.weapon='practice_gauntlet';S.hp=180;var a=comActors[0];a.place=S.place;a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;a.nextActionAt=3000000;Math.random=()=>0;`)}
fresh();run('var before=a.masteryAttacks.bow;var result=playerCombatRound(S,a,Date.now())');assert.equal(run('result.counter'),null);assert.equal(run('S.hp'),180);assert.equal(run('a.equipmentAmmo.weapon'),20);assert.equal(run('a.masteryAttacks.bow'),run('before'));assert.equal(run('a.combatReadyAt||0'),0);assert.equal(run('a.nextActionAt'),3000000);
fresh();run('var before=S.masteryAttacks.fist;var result=playerCombatRound(a,S,Date.now(),true)');assert.equal(run('result.counter'),null);assert.equal(run('a.hp'),180);assert.equal(run('S.masteryAttacks.fist'),run('before'));
// Seeing the COM or preparing an attack does not reveal the player to that COM.
fresh();run("S.equipment.weapon='apollo_bow';S.equipmentAmmo.weapon=16;S.level=15;discoverOpponent(a);attackOpponent();var old=a.place;comFightOpponent(a,Date.now())");assert.equal(run('a.place'),run('old'));assert.equal(run('a.opponent'),null);assert.equal(run("handleComCombatDecision(a,S,Date.now(),'player')"),false);assert.equal(run('a.place'),run('old'));
// Failed paid search gives no knowledge. Successful search gives knowledge, then a later own action can flee.
fresh();run(`S.level=15;S.equipment={weapon:'apollo_bow',head:'xray_goggles',arm:'steel_armguard',body:'royal_suit',legs:'amalgam_boots',accessory:'mythic_telescope'};S.equipmentAmmo.weapon=16;comCurrentPlan=()=>({id:null,missing:{},needed:{},crafts:[]});comEquipBetter=()=>false;var old=a.place;Math.random=()=>0.99;stepCom(a,Date.now())`);assert.equal(run('a.opponent||null'),null);assert.equal(run('a.place'),run('old'));assert.equal(run('a.st'),117);
run('Math.random=()=>0;stepCom(a,Date.now()+1000)');assert.equal(run('a.opponent.id'),run('S.id'));assert.equal(run('a.opponent.source'),'search');assert.equal(run('a.place'),run('old'));assert.equal(run('a.st'),114);assert.equal(run("a.history.at(-1).text.includes('発見')"),true);
run('stepCom(a,Date.now()+2000)');assert.notEqual(run('a.place'),run('old'));assert.equal(run('a.matchStats.pvpAttacks||0'),0);assert.equal(run('a.matchStats.retreats'),1);
// Departure/re-entry invalidates a previously earned sighting, even if the target returns to the same place.
fresh();run("observeOpponent(a,S,Date.now());var oldRef={...a.opponent};move('森林区画');move('山岳区画')");assert.equal(run('a.opponent'),null);run('a.opponent=oldRef');assert.equal(run('hasObservedOpponent(a,S,Date.now())'),false);run('comFightOpponent(a,Date.now())');assert.equal(run('a.opponent'),null);
// Drone retaliation and equipment reflection remain their own mechanics.
fresh();run("Object.assign(drones.bird,{spawned:true,hp:100,area:S.place,generation:1});var result=strikeDrone(S,drones.bird,Date.now())");assert(run('result.counter>0'));assert.equal(run('S.hp'),180-run('result.counter'));
fresh();run("a.equipment.body='stinger_suit';var result=playerCombatRound(S,a,Date.now())");assert.equal(run('result.counter'),null);assert.equal(run('result.first.reflected'),4);
console.log('PASS: no participant auto-counter/ammo/mastery, private discovery, paid-search failure/success then own-turn retreat, re-entry invalidation and unchanged drone/gear reactions');
