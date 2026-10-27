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


let h,run;function fresh(){h=harness();run=h.run;run("comActors.length=0;matchClock.section=1;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];S.bag=[];syncInventory();S.level=1;S.xp=0;S.hp=180;S.st=120");}const eq=(s,v)=>assert.equal(run(s),v,s);
// Outcome probabilities and exact endpoints.
fresh();for(const [roll,count] of [[0,1],[.799999,1],[.8,2],[.949999,2],[.95,3],[.999,3]]){run(`Math.random=()=>${roll}`);eq('rollSearchCount()',count);}
for(const [roll,xp] of [[.699999,0],[.7,2],[.999,2]]){fresh();run(`var rolls=[0,.9,${roll}];Math.random=()=>rolls.shift()??0;primary()`);h.tickAction();eq('S.xp',xp);eq('S.pendingFound',null);eq('S.st',117);eq('S.ticks',1);}
// One paid search yields distinct physical objects, even though item types may repeat.
fresh();run("var rolls=[0,0,.99,0,0,0];Math.random=()=>rolls.shift()??0;primary()");h.tickAction();eq('S.discoveryQueue.length',2);eq('new Set([S.pendingFound,...S.discoveryQueue].map(o=>o.uid)).size',3);eq('S.st',117);eq('S.ticks',1);eq('S.xp',0);
run('var reserved=[S.pendingFound,...S.discoveryQueue];for(let i=0;i<100;i++){if(reserved.includes(drawRegionItem(S.place)))throw Error("reserved duplicate")}');
run("S.bag=Array.from({length:6},()=>({id:'cloth',count:10}));syncInventory();decideFound(true)");eq('S.discoveryQueue.length',2);eq('S.pendingFound.uid',run('reserved[0].uid'));
run('decideFound(false);decideFound(false);decideFound(false)');eq('S.pendingFound',null);eq('S.discoveryQueue.length',0);eq('S.found.length',3);eq('reserved.every(o=>!o.taken)',true);
// Acquiring the first object resets a lap but cannot invalidate the rest of this batch.
fresh();run("var rolls=[0,0,.99,0,0,0];Math.random=()=>rolls.shift()??0;primary()");h.tickAction();run('var objects=[S.pendingFound,...S.discoveryQueue];decideFound(true);decideFound(true);decideFound(true)');eq('objects.every(o=>o.taken)',true);eq('S.inventory.stone',3);eq('S.pendingFound',null);eq('S.st',117);
// Scarce regions yield only what physically remains; an empty region can still yield XP.
fresh();run('var first=regionObjects[S.place][0];for(const o of regionObjects[S.place])o.taken=o!==first;Math.random=()=>.99;var items=drawSearchBatch(S)');eq('items.length',1);eq('items[0]===first',true);
fresh();run('for(const o of regionObjects[S.place])o.taken=true;var rolls=[0,0,.99,.8];Math.random=()=>rolls.shift()??0;primary()');h.tickAction();eq('S.xp',2);eq('S.pendingFound',null);
// COM uses the same batch and one search cost.
h=harness();run=h.run;run("matchClock.section=1;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];var a=comActors[0];a.place='山岳区画';a.starterWeapon='practice_bow';a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;a.bag=[];syncInventory(a);comCurrentPlan=()=>({id:null,missing:{stone:3},needed:{stone:3},crafts:[]});var rolls=[0,.99,0,0,0];Math.random=()=>rolls.shift()??0;stepCom(a,Date.now())");eq('a.inventory.stone',3);eq('a.st',117);eq('a.ticks',1);
// Enemy encounters are not empty searches and do not roll bonus items or XP.
fresh();run("Object.assign(drones.bird,{spawned:true,hp:50,area:S.place});Math.random=()=>0;primary()");h.tickAction();eq('S.enemy',true);eq('S.xp',0);eq('S.discoveryQueue.length',0);
// Dead or maximum-level actors never gain XP or revive.
fresh();run('S.hp=0;Math.random=()=>.99');eq('awardEmptySearchXp(S,Date.now())',0);eq('awardDefeatXp(S,{level:15},Date.now())',0);eq('S.hp',0);
fresh();run('S.level=15;S.xp=0;Math.random=()=>.99');eq('awardEmptySearchXp(S,Date.now())',0);eq('awardDefeatXp(S,{level:15},Date.now())',0);eq('S.xp',0);
// A drone kill is level-scaled once, shared by COM and player. Respawn creates a new eligible kill.
fresh();run("Math.random=()=>0;var d=drones.bird;Object.assign(d,{spawned:true,hp:1,area:S.place});strikeDrone(S,d,Date.now())");eq('S.level',2);eq('S.xp',11);eq('S.matchStats.killXp',30);eq('strikeDrone(S,d,Date.now())',null);eq('S.matchStats.killXp',30);run('Object.assign(d,{spawned:true,hp:1,area:S.place});strikeDrone(S,d,Date.now())');eq('S.matchStats.killXp',60);
// Participant XP scales with victim level, never on reopening the corpse.
h=harness();run=h.run;run("matchClock.section=1;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];var a=comActors[0];a.level=7;S.hp=100;var c=createPlayerCorpse(a,a.place,Date.now(),S.id)");eq('S.matchStats.killXp',70);eq('S.level',3);eq('S.xp',25);run('createPlayerCorpse(a,a.place,Date.now(),S.id)');eq('S.matchStats.killXp',70);
// Lethal thorns cannot be reversed by a simultaneous kill reward.
h=harness();run=h.run;run("matchClock.section=1;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];matchClock.competitive=true;var a=comActors[0];a.place=S.place;S.hp=1;S.equipment.weapon='practice_gauntlet';a.hp=1;a.equipment.body='stinger_suit';Math.random=()=>0;playerCombatRound(S,a,Date.now())");eq('S.hp',0);eq('a.hp',0);eq('S.matchStats.killXp||0',0);eq('a.matchStats.killXp||0',0);
// Actual lethal PvP credits XP before the final result is sealed.
h=harness();run=h.run;run("matchClock.section=1;matchClock.competitive=true;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];var a=comActors[0];a.place=S.place;a.level=5;a.hp=1;S.equipment.weapon='practice_gauntlet';Math.random=()=>0;playerCombatRound(S,a,Date.now())");eq('S.matchStats.killXp',50);eq('S.level',3);eq('matchClock.ended',true);eq('matchClock.record.actors.find(a=>a.id===S.id).stats.killXp',50);
// Surviving reflectors receive the kill; dead attackers remain dead.
h=harness();run=h.run;run("matchClock.section=1;matchClock.competitive=true;matchClock.sectionEndsAt=Date.now()+180000;var a=comActors[0];a.place=S.place;a.hp=180;S.hp=1;S.equipment.weapon='practice_gauntlet';a.equipment.body='stinger_suit';Math.random=()=>0;playerCombatRound(S,a,Date.now())");eq('S.hp',0);eq('a.matchStats.killXp',10);
// Actual COM misses use the identical empty-search XP path.
h=harness();run=h.run;run("matchClock.section=1;matchClock.sectionEndsAt=Date.now()+180000;matchClock.nextBlocked=[];var a=comActors[0];a.place='山岳区画';a.starterWeapon='practice_bow';a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;a.bag=[];syncInventory(a);comCurrentPlan=()=>({id:null,missing:{},needed:{},crafts:[]});var rolls=[.9,.8];Math.random=()=>rolls.shift()??0;stepCom(a,Date.now())");eq('a.xp',2);eq('a.matchStats.emptySearchXp',2);eq('a.st',117);
// Reopening stock and cancelled timers cannot farm empty-search XP.
fresh();run('Math.random=()=>.99;pushStock(regionObjects[S.place][0]);takeFound(0)');h.tickAction();eq('S.xp',0);
fresh();run('Math.random=()=>.99;primary();S.actionToken++');h.tickAction();eq('S.xp',0);eq('S.ticks||0',0);
console.log('PASS: exact outcome rates, empty XP, single-cost multi-object discovery/queue/full bags/stock reservations, physical scarcity, COM parity, encounters, level caps, scaled once-only kills, respawn and simultaneous death');
