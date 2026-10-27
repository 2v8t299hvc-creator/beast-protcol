// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(5)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
run("var a=comActors[4];a.bag=[];syncInventory(a);receive('knuckle',1,null,a);receive('iron',1,null,a);var p=comCurrentPlan(a)");
assert.equal(run('equipmentDef(p.id).weaponType'),'fist');
run('stepCom(a,Date.now())');assert.equal(run('a.starterWeapon'),'practice_gauntlet');assert.equal(run('a.preferredWeaponType'),'fist');
run("a.place='工業区画';matchClock.section=1;a.equipment.weapon='practice_gauntlet';comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'knuckle');
run("craftActor(a,recipes.find(r=>r.id==='iron_knuckle'));comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'iron_knuckle');
// An immediately owned hammer upgrade can switch the same actor back, retaining both masteries.
run("receive('steel_hammer',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'steel_hammer');assert.equal(run('a.preferredWeaponType'),'hammer');assert.equal(run('a.masteryAttacks.fist'),16);assert.equal(run('a.masteryAttacks.hammer'),14);
// Bow branches are chosen from actual materials, not the old scripted route.
run("var b=comActors[0];b.bag=[];b.place='待機所';b.equipment.weapon='practice_bow';syncInventory(b);receive('western_bow',1,null,b);receive('bronze',1,null,b);var bp=comCurrentPlan(b)");assert.equal(run('bp.id'),'longbow');
run("b.bag=[];syncInventory(b);receive('japanese_bow',1,null,b);receive('piano_wire',1,null,b);var next=comCurrentPlan(b)");
assert.notEqual(run('next.id'),'longbow');
// Hidden world depletion or another player's inventory cannot affect the result.
run("var before=JSON.stringify(comCurrentPlan(b));for(const obj of Object.values(regionObjects).flat())obj.taken=true;S.bag=[{id:'diamond',count:10}];delete b.adaptivePlanCache");assert.equal(run('JSON.stringify(comCurrentPlan(b))'),run('before'));
run('b.exhausted=Object.fromEntries(Object.keys(regionStock).map(x=>[x,true]));b.bag=[];syncInventory(b)');assert.equal(run('comCurrentPlan(b).id'),null);
console.log('PASS: Jerk material-based fist start, real fist crafting, cross-type equipment switch, independent mastery, bow branch replanning, public-only estimates and exhausted-source fallback');
