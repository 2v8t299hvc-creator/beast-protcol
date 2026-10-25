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


let h=harness(),run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
eq('comActors.length',1);eq('comActors[0].masteryAttacks.bow',26);
h.advance(1000);eq('comActors[0].equipment.weapon','practice_bow');eq('comActors[0].equipmentAmmo.weapon',20);
h.advance(1000);assert.notEqual(run('comActors[0].place'),'待機所');eq('comActors[0].st',120);
run('selectPracticeWeapon("practice_gauntlet");move("山岳区画")');h.advance(28000);
// Actor bags, cooldowns and HP do not leak to the player.
run('comActors[0].hp=100;recoverActor(comActors[0],"ration",1030000)');eq('comActors[0].hp',120);eq('S.hp',180);eq('S.inventory.ration',2);
eq('recoverActor(comActors[0],"ration",1032999)',false);eq('recoverActor(comActors[0],"ration",1033000)',true);
// Physical stock is shared; player reservations cannot be stolen and exploration histories are independent.
run('S.found=[];S.pendingFound=null;comActors[0].seen={};globalThis.obj=drawRegionItem("森林区画",comActors[0]);receive(obj.id,obj.count,obj,comActors[0]);markObjectTaken(obj)');eq('obj.taken',true);
run('S.pendingFound=regionObjects["森林区画"].find(x=>!x.taken);globalThis.reserved=S.pendingFound;for(let i=0;i<100;i++){if(drawRegionItem("森林区画",comActors[0])===reserved)throw Error("stole discovery")}');
run('S.pendingFound=null;comActors[0].place="山岳区画";matchClock.nextBlocked=["山岳区画"];matchClock.sectionEndsAt=1040000;comActors[0].nextActionAt=1031000');
h.setNow(1031000);run('syncMatchClock()');assert.notEqual(run('comActors[0].place'),'山岳区画');
// Failed receive is atomic; movement obeys the player's ST-first / HP-fallback cost.
run('globalThis.a=comActors[0];a.bag=Array.from({length:6},()=>({id:"wood",count:10}));syncInventory(a)');eq('receive("ration",1,null,a)',false);eq('a.bag.length',6);
run('a.st=2;a.hp=10;payMovementCost(a)');eq('a.st',0);eq('a.hp',7);
// Background catch-up equals frequent ticks when the random stream is identical.
function simulate(chunk){const z=harness();z.run('updateDrones=()=>{};selectPracticeWeapon("practice_bow");move("山岳区画")');for(let t=chunk;t<=390000;t+=chunk)z.advance(chunk);return z.run('JSON.stringify({place:comActors[0].place,hp:comActors[0].hp,st:comActors[0].st,bag:comActors[0].bag,history:comActors[0].history,section:matchClock.section})')}
assert.equal(simulate(1000),simulate(390000));
h=harness();run=s=>h.run(s);h.advance(1350000);eq('comActors[0].hp',0);eq('comActors[0].bag.length',0);eq('corpses.filter(c=>c.ownerId==="hayate").length',1);
run('showComStatus()');
console.log('PASS: COM lobby, independent actor state, shared resources/reservations, recovery cooldowns, travel costs, warning retreat, deterministic background catch-up and final corpse');
