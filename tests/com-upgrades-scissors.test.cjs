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
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;const eq=(s,v)=>assert.equal(run(s),v,s);
function fixture(){h=harness();run=s=>h.run(s);run('globalThis.a=comActors[0];matchClock.section=4;matchClock.sectionEndsAt=Date.now()+180000;matchClock.blocked=[];matchClock.nextBlocked=[];a.completedGoals=[...COM_GOALS];a.place="住宅区画";a.bag=[];syncInventory(a);a.equipment={weapon:"azusa_bow",head:"hat",arm:"simple_armguard",body:"rubber_suit",legs:"boots",accessory:"telescope"};a.goal=null;')}
fixture();eq('regionStock["住宅区画"].scissors',6);eq('regionStock["商業区画"].scissors',6);eq('regionStock["医療区画"].scissors',4);eq('Object.values(regionObjects).flat().filter(x=>x.id==="scissors").length',16);
run('globalThis.plan=comCurrentPlan(a)');eq('!!plan.id',true);eq('comUpgradeValue(a,plan.id)>0',true);eq('equipmentDef(plan.id).slot!=="weapon"',true);
// Available ingredients make a genuine upgrade route immediately craftable.
run('a.equipment.arm="iron_armguard";a.goal="steel_armguard";receive("steel",1,null,a);globalThis.plan=comCurrentPlan(a)');eq('plan.id','steel_armguard');eq('plan.crafts.includes("steel_armguard")',true);run('stepCom(a,Date.now());stepCom(a,Date.now()+1000)');eq('a.equipment.arm','steel_armguard');eq('a.inventory.steel||0',0);
// A committed route is stable; unavailable sources cause re-planning rather than illegal travel.
fixture();run('a.goal="leather_hat";globalThis.plan=comCurrentPlan(a)');eq('plan.id','leather_hat');run('globalThis.hidden=JSON.stringify(comUpgradePlan(a));S.bag=[{id:"diamond",count:1}];for(const obj of Object.values(regionObjects).flat())obj.taken=true');eq('JSON.stringify(comUpgradePlan(a))',run('hidden'));run('a.exhausted=Object.fromEntries(Object.keys(regionStock).map(x=>[x,true]));globalThis.plan=comCurrentPlan(a)');eq('plan.id',null);
// Freeze this benchmark to its original material distribution; new body-gear scenarios have their own suite.
// Real timelines: high-tier armor continues after the original bow route without free items.
for(let seed=1;seed<=6;seed++){h=harness();run=s=>h.run(s);run(`globalThis.seed=${seed};for(const ids of Object.values(DRONE_SUPPLY_TABLES))ids.length=0;for(const area of Object.keys(regionStock)){for(const id of ['herb','thread','lab_coat'])delete regionStock[area][id];regionObjects[area]=regionObjects[area].filter(x=>!['herb','thread','lab_coat'].includes(x.id))}selectPracticeWeapon('practice_gauntlet');move('森林区画')`);h.advance(600000);eq('comActors[0].hp>0',true);eq('comActors[0].equipment.weapon','azusa_bow');eq('Object.values(comActors[0].equipment).filter(Boolean).length',6);assert(run('Object.entries(comActors[0].equipment).filter(([slot,id])=>slot!=="weapon"&&["rare","epic"].includes(RECIPE_RARITY[id])).length>=4'));assert(run('comActors[0].bag.length<=6'));assert(run('comActors[0].matchStats.crafts>10'));}
console.log('PASS: 16 physical scissors across three areas, affordable committed armor upgrades, equipped crafting, observed-only knowledge and six ten-minute production simulations');
