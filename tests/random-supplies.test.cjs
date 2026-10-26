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


const h=harness(),run=h.run;
assert.equal(run('S.startingSuppliesGranted'),true);
assert.equal(run('comActors.every(a=>a.startingSuppliesGranted)'),true);
assert.equal(run('S.bag.length<=4'),true);
assert.equal(run('(()=>{const before=JSON.stringify(S.bag);grantStartingSupplies(S);return before===JSON.stringify(S.bag)})()'),true);
assert.equal(run(`Object.values(RANDOM_SUPPLY_TABLES).every(t=>Object.values(t).filter(Array.isArray).flat().every(id=>names[id]&&(!equipmentDef(id)||(RECIPE_RARITY[id]||'common')==='common')))`),true);
for(const [kind,count] of Object.entries({bird:1,fish:1,dog:2,humanoid:2,scorpion:3,octopus:3})){
 for(let i=0;i<100;i++){
  run(`var body=createDroneCorpse('${kind}',S.place);var extras=body.items.slice(DRONE_DEFS['${kind}'].drops.length)`);
  assert.equal(run('extras.length'),count);
  assert.equal(run('new Set(extras.map(x=>x.id)).size'),count);
  assert.equal(run('extras.every(x=>x.count===supplySetCount(x.id))'),true);
 }
}
assert.equal(run("supplySetCount('seaweed_soup')"),3);
assert.equal(run("supplySetCount('swordfish_sashimi')"),5);
assert.equal(run("supplySetCount('water')"),3);
assert.equal(run("(()=>{Math.random=()=>0.99;return RANDOM_SUPPLY_TABLES.A.jackpot.includes(rollSupply('A').id)})()"),true);
run("S.place='待機所';S.bag=[{id:'seaweed_soup',count:3}];syncInventory();S.found=[];discardStack(0)");
assert.equal(run('S.bag.length'),0);
assert.equal(run('S.found.length'),0);
assert.equal(run("(regionObjects['待機所']||[]).length"),0);
run("var a=comActors[0];a.place='待機所';a.bag=[{id:'wood',count:1}];syncInventory(a);comDrop(a,0,Date.now())");
assert.equal(run('a.bag.length'),0);
assert.equal(run("(regionObjects['待機所']||[]).length"),0);
console.log('PASS: reusable valid weighted tables, common gear only, starting supplies once per actor, 1/2/3 distinct rewards, recovery sets and permanent lobby discard');
