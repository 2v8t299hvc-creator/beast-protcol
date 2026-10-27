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



let h,run;const eq=(s,v)=>assert.equal(run(s),v,s);
function fixture(){h=harness();run=s=>h.run(s);run(`selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.sectionEndsAt=2000000;matchClock.nextBlocked=[];matchClock.blocked=[];globalThis.a=comActors[0];a.place=S.place;a.starterWeapon='practice_bow';a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;a.nextActionAt=Date.now()+1000;Math.random=()=>0;`)}
// Search-gated local encounters and portrait routing. Unrelated map positions remain hidden.
fixture();run('a.place="森林区画"');eq('localOpponents(S).length',0);eq('discoverOpponent(a)',false);run('a.place=S.place;primary()');h.tickAction();eq('S.enemyPlayerId','hayate');eq('$("enemyName").textContent','ハヤテ');eq('$("enemyArt").src','assets/characters/hayate_encounter_transparent.webp');eq('$("mainBtn").textContent','⚔ 攻撃');eq('S.st',117);run('skill()');eq('S.enemy',false);eq('S.enemyPlayerId',null);run('move("森林区画")');eq('S.place','森林区画');eq('a.place','山岳区画');
fixture();run('S.equipment.body="passion_bikini"');eq('actorDiscoveryRate(S)',0.9);
// Scheduled player attack consumes only the attacker; the defender does not counter.
fixture();run('a.nextActionAt=3000000;discoverOpponent(a);attackOpponent();attackOpponent()');eq('S.pvpPending.dueAt',1001000);h.advance(1000);eq('S.hp',180);eq('a.hp',169);eq('S.masteryAttacks.fist',10);eq('a.masteryAttacks.bow',20);eq('a.equipmentAmmo.weapon',20);eq('S.busy',true);h.advance(899);eq('S.busy',true);h.advance(1);eq('S.busy',false);eq('S.enemy',false);
// Being attacked does not grant a bonus counter or bonus mastery.
fixture();run('a.enemy={kind:"bird",generation:7};Object.assign(drones.bird,{spawned:true,generation:7,hp:10000,area:a.place});discoverOpponent(a);attackOpponent()');h.advance(1000);eq('a.masteryAttacks.bow',20);eq('drones.bird.hp',10000);
// Target movement / flee before the scheduled hit cancels without damage, ammo or dead action timers.
fixture();run('discoverOpponent(a);attackOpponent();a.place="森林区画";a.nextActionAt=3000000');h.advance(1000);eq('S.hp',180);eq('a.hp',180);eq('a.equipmentAmmo.weapon',20);eq('S.busy',false);eq('S.enemy',false);
fixture();run('primary();globalThis.token=S.actionToken;discoverOpponent(a,true)');h.tickAction();eq('S.pendingFound',null);eq('S.ticks',0);eq('S.enemyPlayerId','hayate');assert(run('S.actionToken>token'));
// Incoming attacks preserve the current discovery, recovery, menus and exploration timer.
fixture();run('S.pendingFound=regionObjects[S.place][0];S.recoveryMode="hp";S.corpseVisit={id:"x"};$("back").classList.add("on");observeOpponent(a,S,Date.now());globalThis.token=S.actionToken;comFightOpponent(a,Date.now())');eq('S.pendingFound!==null',true);eq('S.found.length',0);eq('S.recoveryMode','hp');eq('S.corpseVisit.id','x');eq('$("back").classList.contains("on")',true);eq('S.hp',166);eq('a.hp',180);eq('S.enemyPlayerId',null);eq('S.actionToken',run('token'));eq('S.pvpFeedback',undefined);
fixture();run('primary();globalThis.token=S.actionToken;observeOpponent(a,S,Date.now());comFightOpponent(a,Date.now())');eq('S.busy',true);eq('S.actionToken',run('token'));eq('S.enemy',false);eq('S.hp',166);h.tickAction();eq('S.ticks',1);eq('S.busy',false);
fixture();run('globalThis.item=regionObjects[S.place][0];pushStock(item);takeFound(0);globalThis.token=S.actionToken;observeOpponent(a,S,Date.now());comFightOpponent(a,Date.now())');eq('S.actionToken',run('token'));h.tickAction();eq('S.pendingFound.uid',run('item.uid'));eq('S.found[0].uid',run('item.uid'));
// Nonblocking incoming notice reports actual damage, guard and ignores stale catch-up events.
fixture();run('observeOpponent(a,S,Date.now());comFightOpponent(a,Date.now())');eq('$("incomingNotice").classList.contains("show")',true);eq('$("incomingText").textContent','ハヤテから14ダメージ！');eq('S.enemy',false);run('showIncomingDamage(a,{dealt:7,guarded:true},Date.now())');eq('$("incomingText").textContent','ハヤテから7ダメージ！ ガード！');run('showIncomingDamage(a,{dealt:99},Date.now()-3000)');eq('$("incomingText").textContent','ハヤテから7ダメージ！ ガード！');assert(html.includes('pointer-events:none'));
// Offensive equipment and defensive retaliation run through the same player/COM mutation path.
fixture();run('S.equipment.weapon="blizzard_cannon";S.equipmentAmmo.weapon=4;actorAttack(S,a,Date.now())');eq('a.frozenUntil',1004000);eq('recoverActor(a,"ration",1003999)',false);eq('a.inventory.ration',2);eq('recoverActor(a,"ration",1004000)',true);
fixture();run('S.equipment.weapon="eros_bow";S.equipmentAmmo.weapon=16;S.hp=100;globalThis.r=actorAttack(S,a,Date.now())');eq('r.healing',3);eq('S.hp',103);
fixture();run('a.equipment.body="stinger_suit";S.hp=100;globalThis.r=actorAttack(S,a,Date.now())');eq('r.reflected',4);eq('S.hp',96);
fixture();run('a.equipment.body="charged_suit";S.equipment.weapon="handgun";S.equipmentAmmo.weapon=8;equipmentState(S,"weapon").durability=10;actorAttack(S,a,Date.now());actorAttack(S,a,Date.now()+1000)');eq('equipmentState(S,"weapon").durability',9);eq('equipmentState(a,"body").readyAt',1090000);
// Three guarded magma shots still produce a lethal halved eruption; no projectile or counter duplication.
fixture();run('S.equipment.weapon="magma_blaster";S.equipmentAmmo.weapon=8;a.hp=80;Math.random=()=>0.999;actorAttack(S,a,Date.now());actorAttack(S,a,Date.now()+1000);globalThis.r=playerCombatRound(S,a,Date.now()+2000)');eq('r.first.hit',true);eq('r.first.guarded',true);eq('r.first.damage',34);eq('r.counter',null);eq('S.equipmentAmmo.weapon',5);eq('matchClock.result','win');
// A COM without a safe escape area keeps acting instead of locking up at its exploration limit.
fixture();run('matchClock.blocked=Object.keys(regionStock).filter(x=>x!==a.place);a.searches=36;a.noProgress=12;a.goal=null;a.completedGoals=[...COM_GOALS];a.opponent=null;S.place="森林区画";stepCom(a,Date.now())');eq('a.searches',1);
// Lethal first hit receives no counter and ends the match; real corpse contents remain claimable.
fixture();run('a.hp=1;discoverOpponent(a);attackOpponent()');h.advance(1000);eq('matchClock.result','win');eq('matchClock.winnerId','kaito');eq('matchClock.ended',true);eq('S.hp',180);eq('a.bag.length',0);eq('corpses.filter(c=>c.ownerId==="hayate").length',1);eq('$("survivalStatus").textContent','勝利');eq('$("notice").textContent.includes("全区域封鎖")',false);
run('globalThis.body=corpses.find(c=>c.ownerId==="hayate");openCorpse(body.id);globalThis.token=S.corpseVisit.token;takeCorpseItem(0,token)');eq('S.inventory.ration',4);eq('body.items.length',2);run('takeCorpseItem(0,token)');eq('body.items.length',2);
// Both actors can die in a single reflected hit; the result is a draw with exactly two corpses.
fixture();run('S.hp=1;a.hp=1;a.equipment.body="stinger_suit";playerCombatRound(S,a,Date.now())');eq('S.hp',0);eq('a.hp',0);eq('matchClock.result','draw');eq('corpses.filter(c=>c.kind==="player").length',2);
// COM can win by combat; the survivor also wins if the other participant dies to a drone/movement/closure.
fixture();run('S.hp=1;observeOpponent(a,S,Date.now());comFightOpponent(a,Date.now())');eq('matchClock.result','eliminated');eq('matchClock.winnerId','hayate');eq('matchClock.ended',true);eq('S.corpseId!==null',true);
fixture();run('a.hp=0;eliminateCom(a,"ドローン",Date.now());checkVictory()');eq('matchClock.result','win');
fixture();run('matchClock.sectionEndsAt=1001000;matchClock.nextBlocked=[S.place];a.place="森林区画"');h.advance(1000);eq('matchClock.winnerId','hayate');eq('matchClock.ended',true);
// Final all-area closure eliminates the living actors simultaneously, without a premature winner.
fixture();run('matchClock.section=9;matchClock.sectionEndsAt=1001000;matchClock.nextBlocked=Object.keys(regionStock);a.nextActionAt=3000000');h.advance(1000);eq('matchClock.result','draw');eq('S.hp',0);eq('a.hp',0);
// Bounded simulation with actual competitive behavior: no infinite rounds, double corpses or illegal bags.
for(let n=1;n<=5;n++){h=harness();run=s=>h.run(s);run(`globalThis.seed=${n};selectPracticeWeapon('practice_gauntlet');move('森林区画')`);h.advance(1350000);eq('matchClock.ended',true);assert(run('comActors.every(a=>a.bag.length<=6)'));eq('new Set(corpses.filter(c=>c.kind==="player").map(c=>c.ownerId)).size',run('corpses.filter(c=>c.kind==="player").length'));}
// Competitive timeline must also match after a throttled Safari resume.
function chronology(chunk){const z=harness();z.run(`selectPracticeWeapon('practice_gauntlet');move('森林区画')`);for(let t=chunk;t<=900000;t+=chunk)z.advance(chunk);return z.run('JSON.stringify({clock:matchClock,S,comActors,corpses,drones})')}
assert.equal(chronology(1000),chronology(900000));
console.log('PASS: local PvP discovery/portrait, player and COM rounds, shared one-second timing, stale-action cancellation, retreat, pending-item preservation, freeze/lifesteal/armor, victory/loot, simultaneous death, final closure and five competitive simulations');

// A COM pays the same 900ms post-hit feedback as the player, including misses.
fixture();run('a.nextActionAt=Date.now()+1000;playerCombatRound(a,S,Date.now(),true)');eq('a.nextActionAt',1001900);eq('a.opponent',null);
fixture();run('Math.random=()=>0.999;a.nextActionAt=Date.now()+1000;var miss=playerCombatRound(a,S,Date.now(),true)');eq('miss.first.hit',true);eq('miss.first.guarded',true);eq('a.nextActionAt',1001900);
// Slowdown is added once, on top of the ordinary action and feedback waits.
fixture();run('a.slowUntil=Date.now()+5000;a.slowActionDelayMs=500;a.nextActionAt=Date.now()+1500;playerCombatRound(a,S,Date.now(),true)');eq('a.nextActionAt',1002400);
// Guaranteed re-discovery: attacks land every 2.9s, not every 2s. Background catch-up is identical.
function fairCadence(chunk){fixture();run(`S.hp=10000;var hits=[];stepCom=(actor,now)=>{if(!actor.opponent){observeOpponent(actor,S,now);return}const result=playerCombatRound(actor,S,now,true);if(result)hits.push(now)};a.nextActionAt=Date.now()+1000`);for(let i=0;i<8000;i+=chunk)h.advance(chunk);eq('JSON.stringify(hits)',JSON.stringify([1002000,1004900,1007800]));return run('JSON.stringify({hits,next:a.nextActionAt,hp:S.hp})')}
assert.equal(fairCadence(100),fairCadence(8000));
// Drone combat also pays feedback before searching/looting, preserving longer existing waits.
fixture();run("Object.assign(drones.bird,{spawned:true,generation:7,hp:10000,area:a.place});a.enemy={kind:'bird',generation:7};handleComCombatDecision=()=>false;a.nextActionAt=Date.now()+1000;comFight(a,Date.now())");eq('a.nextActionAt',1001900);
fixture();run('a.nextActionAt=Date.now()+5000;applyComCombatFeedback(a,Date.now())');eq('a.nextActionAt',1005000);
console.log('PASS: equal 900ms post-hit COM lock, hit/miss, additive slow, 2.9s search/attack cycle, drone combat and background catch-up');
