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
 vm.runInContext(source,context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;const eq=(s,v)=>assert.equal(run(s),v,s);
function fresh(){h=harness();run=s=>h.run(s)}
fresh();eq('comActors.length',9);eq('new Set([S,...comActors].map(a=>a.id)).size',10);eq('new Set(comActors.map(a=>a.name)).size',9);eq('$("participantCount").textContent','生存 10/10');eq('comActors.filter(a=>a.goals.includes("longbow")).length',2);
run('comActors[0].bag[0].count=1;comActors[0].goals.push("test");comActors[0].statusEffects.test={stacks:2}');eq('comActors[1].bag[0].count',2);eq('comActors[1].goals.includes("test")',false);eq('comActors[1].statusEffects.test',undefined);eq('S.inventory.ration',2);
fresh();run('selectPracticeWeapon("practice_gauntlet");move("森林区画")');h.advance(2000);assert(run('new Set(comActors.map(a=>a.place)).size>=8'));h.advance(28000);eq('comActors.every(a=>a.place!=="待機所"&&a.equipment.weapon===(a.preferredWeaponType==="gun"?"practice_gun":a.preferredWeaponType==="hammer"?"practice_hammer":a.preferredWeaponType==="slash"?"practice_sword":"practice_bow"))',true);eq('comActors.every(a=>a.masteryAttacks[a.preferredWeaponType]===20)',true);
// No index-zero preference when several opponents share a region; no knowledge of remote actors.
run('globalThis.a=comActors[0];globalThis.b=comActors[1];a.place=b.place=S.place;for(const c of comActors.slice(2))c.place="住宅区画";Math.random=()=>.999');eq('chooseLocalOpponent(S).id',run('b.id'));eq('localOpponents(S).length',2);
// A COM round consumes only its attacker; an aware defender can act on its own scheduled turn.
fresh();run('matchClock.section=1;S.place="森林区画";globalThis.a=comActors[0];globalThis.b=comActors[1];a.place=b.place="山岳区画";for(const c of [a,b]){c.starterWeapon="practice_bow";c.equipment.weapon="practice_bow";c.masteryAttacks.bow=20;c.equipmentAmmo.weapon=20;c.nextActionAt=Date.now();observeOpponent(c,c===a?b:a,Date.now())}Math.random=()=>0;globalThis.result=playerCombatRound(a,b,Date.now())');eq('a.hp',180);eq('b.hp',167);eq('a.equipmentAmmo.weapon',19);eq('b.equipmentAmmo.weapon',20);eq('a.opponent',null);eq('b.opponent.id',run('a.id'));eq('a.nextActionAt',1001900);eq('b.nextActionAt',1000000);run('globalThis.savedDecision=handleComCombatDecision;handleComCombatDecision=()=>false;updateComActors(Date.now());handleComCombatDecision=savedDecision');eq('a.hp',167);eq('b.hp',167);eq('b.equipmentAmmo.weapon',19);
// Feedback on the player's unrelated duel cannot freeze distant COM fighting.
run('b.hp=1;a.combatReadyAt=0;observeOpponent(a,b,Date.now());S.pvpFeedback={until:Date.now()+900};comFightOpponent(a,Date.now())');eq('b.hp',0);eq('matchClock.ended',false);eq('corpses.find(c=>c.ownerId===b.id).killerId',run('a.id'));eq('a.loot',run('b.corpseId'));
// A surviving defender owns loot when its thorns kill the initiator.
fresh();run('matchClock.section=1;globalThis.a=comActors[0];globalThis.b=comActors[1];a.place=b.place="山岳区画";a.hp=1;a.equipment.weapon="practice_gauntlet";b.equipment.body="stinger_suit";Math.random=()=>0;playerCombatRound(a,b,Date.now())');eq('a.hp',0);eq('b.loot',run('a.corpseId'));
// Actual resource transfer is shared; a physical object cannot be collected twice.
fresh();run('globalThis.a=comActors[0];globalThis.b=comActors[1];a.place=b.place="山岳区画";globalThis.obj=regionObjects[a.place][0];receive(obj.id,1,obj,a);markObjectTaken(obj)');eq('obj.taken',true);run('for(let i=0;i<100;i++){if(drawRegionItem(b.place,b)===obj)throw Error("duplicate resource")}');eq('a.inventory.stone',1);eq('b.inventory.stone',undefined);
// Several incoming attacks still leave the player's search timer and screen untouched.
fresh();run('matchClock.section=1;S.place="山岳区画";S.equipment.weapon="practice_gauntlet";globalThis.a=comActors[0];globalThis.b=comActors[1];for(const c of [a,b]){c.place=S.place;c.equipment.weapon="practice_bow";c.masteryAttacks.bow=20;c.equipmentAmmo.weapon=20;observeOpponent(c,S,Date.now())}Math.random=()=>0;primary();globalThis.token=S.actionToken;comFightOpponent(a,Date.now());comFightOpponent(b,Date.now())');eq('S.hp',154);eq('S.actionToken',run('token'));eq('S.busy',true);eq('S.enemy',false);eq('a.hp',180);eq('b.hp',180);h.tickAction();eq('S.ticks',1);
// Two looters can consume a shared corpse entry only once.
fresh();run('globalThis.a=comActors[0];globalThis.b=comActors[1];a.place=b.place="山岳区画";a.bag=[];b.bag=[];syncInventory(a);syncInventory(b);globalThis.body=createCorpse("drone","test",a.place,[{id:"arrows",count:20}],Date.now());a.loot=b.loot=body.id;globalThis.plan={missing:{},needed:{}}');eq('comLoot(a,Date.now(),plan)',true);eq('comLoot(b,Date.now(),plan)',false);eq('a.inventory.arrows',20);eq('b.inventory.arrows',undefined);eq('body.items.length',0);
// Player defeat leaves the simulation active; the final single survivor decides the result.
fresh();run('matchClock.section=1;S.place="森林区画";eliminatePlayer("test",comActors[0].id,Date.now())');eq('S.hp',0);eq('matchClock.ended',false);run('for(const a of comActors.slice(1)){a.hp=0;eliminateCom(a,"test",Date.now(),comActors[0].id)}checkVictory(Date.now());refresh()');eq('matchClock.ended',true);eq('matchClock.winnerId','hayate');eq('matchClock.record.actors.length',10);eq('$("participantCount").textContent','生存 1/10');eq('new Set(corpses.filter(c=>c.kind==="player").map(c=>c.ownerId)).size',9);
// The global scheduler orders actors by time, rotating same-time priority across seconds.
fresh();run('matchClock.section=1;globalThis.events=[];stepCom=(a,at)=>events.push([a.id,at]);for(const a of comActors)a.nextActionAt=1001000;updateComActors(1003000)');eq('events.length',27);eq('events.every((e,i)=>i===0||events[i-1][1]<=e[1])',true);eq('events[0][0]!==events[9][0]',true);
// Nine production COMs finish full matches under shared resource contention without duplicate deaths or invalid bags.
for(let seed=1;seed<=5;seed++){fresh();run(`globalThis.seed=${seed};selectPracticeWeapon('practice_gauntlet');move('森林区画')`);h.advance(1350000);eq('matchClock.ended',true);assert(run('comActors.every(a=>a.bag.length<=6&&a.hp>=0&&a.st>=0)'));eq('new Set(corpses.filter(c=>c.kind==="player").map(c=>c.ownerId)).size',run('corpses.filter(c=>c.kind==="player").length'));eq('matchClock.record.actors.length',10);}
function chronology(chunk){const z=harness();z.run(`selectPracticeWeapon('practice_gauntlet');move('森林区画')`);for(let t=chunk;t<=900000;t+=chunk)z.advance(chunk);return z.run('JSON.stringify({clock:matchClock,S,comActors,corpses,drones,objects:Object.values(regionObjects).flat().filter(x=>x.taken).map(x=>x.uid)})')}
assert.equal(chronology(1000)===chronology(900000),true,"throttled nine-COM chronology must match frequent ticks");
console.log('PASS: nine independent COMs, bow, gun and hammer routes, local targeting, COM duels and loot, shared physical resources, ten-player results, global fair chronology, five full simulations and background equivalence');
