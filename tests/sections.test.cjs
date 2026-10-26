// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source,context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}
let h=harness();let run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
eq('matchClock.section',0);eq('S.remaining',1350);eq('sectionSeconds()',30);
run('primary()');eq('S.busy',false);eq('S.st',120);run(`move('森林区画')`);eq('S.place','森林区画');eq('S.st',120);
h.advance(29999);eq('matchClock.section',0);eq('sectionSeconds()',1);h.advance(1);eq('matchClock.section',1);eq('matchClock.blocked.length',0);eq('nextClosingAreas().length',3);
// Freeze a announced set: repeated refreshes must never change it.
run('var announced=JSON.stringify(matchClock.nextBlocked);showMap();refresh();refresh()');eq('JSON.stringify(matchClock.nextBlocked)===announced',true);eq(`$('modalBody').innerHTML.includes('⚠ 次に封鎖')`,true);
// Keep the player safe while checking every section's counts and permanent sets.
for(let phase=2;phase<=9;phase++){
 run(`S.place=Object.keys(regionStock).find(a=>!matchClock.blocked.includes(a)&&!matchClock.nextBlocked.includes(a));var previous=[...matchClock.blocked];var upcoming=[...matchClock.nextBlocked]`);
 h.setNow(run('matchClock.sectionEndsAt'));run('tickMatchClock()');eq('matchClock.section',phase);eq('JSON.stringify(matchClock.blocked)===JSON.stringify(upcoming)',true);
 eq('matchClock.blocked.length',[0,0,3,3,3,4,8,12,15,17][phase]);eq('matchClock.result',null);
 if(phase<=5)eq('previous.every(a=>!matchClock.blocked.includes(a))',true);else eq('previous.every(a=>matchClock.blocked.includes(a))',true);
 run(`var before=S.place;move(matchClock.blocked[0])`);eq('S.place===before',true);
 if(phase>=5)eq('nextClosingAreas().length',[0,0,0,0,0,4,4,3,2,1][phase]);
}
// The last survivor does not win automatically; complete closure produces an all-dead draw.
h.setNow(run('matchClock.sectionEndsAt'));run('tickMatchClock()');eq('matchClock.section',10);eq('matchClock.blocked.length',18);eq('matchClock.result','draw');eq('S.hp',0);eq('S.remaining',0);eq('matchClock.ended',true);run('rest();primary();move("山岳区画")');eq('S.hp',0);eq('S.busy',false);
// Catch up every boundary after a long suspension, including intermediate fatal closures.
h=harness();h.advance(1350000);eq('matchClock.section',10);eq('matchClock.blocked.length',18);eq('matchClock.ended',true);
// A player in the newly blocked area dies at the boundary, even with a discovery modal open.
h=harness();h.advance(30000);run('S.place=matchClock.nextBlocked[0];S.pendingFound={id:"stone",count:1}');h.setNow(run('matchClock.sectionEndsAt'));run('tickMatchClock()');eq('S.hp',0);eq('matchClock.result','eliminated');eq('S.pendingFound',null);eq('S.enemy',false);run('rest();useItem("ration")');eq('S.hp',0);
// A click arriving at the boundary cannot escape before the closure is processed.
h=harness();h.advance(30000);run('S.place=matchClock.nextBlocked[0];var safe=Object.keys(regionStock).find(a=>!matchClock.nextBlocked.includes(a));var oldPlace=S.place');h.setNow(run('matchClock.sectionEndsAt'));run('move(safe)');eq('S.place===oldPlace',true);eq('S.hp',0);
// In-flight exploration, stock recovery and attacks cannot award loot, XP or damage after elimination.
for(const action of ['search','stock','attack']){
 h=harness();h.advance(30000);run('S.place=matchClock.nextBlocked[0];var xpBefore=S.xp;var bagBefore=JSON.stringify(S.bag)');
 if(action==='search')run('primary()');
 if(action==='stock')run(`S.found=[{id:'stone',count:1}];takeFound(0)`);
 if(action==='attack')run('S.enemyKind="bird";Object.assign(drones.bird,{area:S.place,hp:85,spawned:true,generation:1});S.enemy=true;S.ehp=85;attackDiscoveredDrone()');
 h.setNow(run('matchClock.sectionEndsAt'));h.tickAction();eq('matchClock.result','eliminated');eq('S.hp',0);eq('S.xp===xpBefore',true);eq('S.bag.length',0);eq('JSON.stringify(corpses.find(c=>c.id===S.corpseId).items.map(({id,count})=>({id,count})))===bagBefore',true);eq('S.pendingFound',null);eq('S.busy',false);
}
// Ending the match never upgrades an already eliminated player's result to a draw.
h.advance(1350000);eq('matchClock.result','eliminated');
console.log('PASS: preparation, all section boundaries, fixed warnings, rotating/permanent closures, forbidden movement, deadline draw, background catch-up and async cancellation');

// Movement pays available stamina first, then HP; exhaustion alone never prevents travel.
for(const [st,hp,expectedSt,expectedHp] of [[10,20,5,20],[5,20,0,20],[2,20,0,17],[0,20,0,15],[0,3,0,0]]){
 h=harness();h.advance(30000);run(`S.st=${st};S.hp=${hp};move('森林区画')`);eq('S.place','森林区画');eq('S.st',expectedSt);eq('S.hp',expectedHp);
 if(expectedHp===0){eq('matchClock.result','eliminated');eq('corpses.find(c=>c.id===S.corpseId).area','森林区画')}
}
// Invalid destinations, the current region and lockdowns do not consume either resource.
h=harness();h.advance(30000);run(`S.st=0;S.hp=20;move(S.place);move('不明');matchClock.blocked=['森林区画'];move('森林区画')`);eq('S.hp',20);eq('S.st',0);eq('S.place','山岳区画');
// Preparation remains free even with no stamina.
h=harness();run(`S.st=0;S.hp=20;move('森林区画')`);eq('S.place','森林区画');eq('S.hp',20);
console.log('PASS: stamina-first travel, HP fallback, lethal travel, invalid/locked destinations and free preparation');
