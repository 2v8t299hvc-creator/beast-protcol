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
 vm.runInContext(source,context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;
function fresh(){h=harness();run=s=>h.run(s);run(`comActors.length=0;globalThis.a=S;matchClock.section=4;matchClock.sectionEndsAt=Date.now()+1000000;matchClock.blocked=[];matchClock.nextBlocked=[];a.place='山岳区画';a.bag=[];syncInventory(a);a.equipment={weapon:null,head:null,arm:null,body:null,legs:null,accessory:null};a.equipmentAmmo={};a.equipmentEffects={};a.masteryAttacks={bow:0,gun:0,fist:0};a.hp=100;a.st=50;Math.random=()=>0;globalThis.d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:a.place,generation:1});`)}
const eq=(s,v)=>assert.equal(run(s),v,s);

const stats={goggles:6,night_goggles:26,xray_goggles:46,machine_goggles:14,mechanic_goggles:30,steampunk_goggles:48,hat:7,cloth_hat:14,fur_hat:26,leather_hat:38,feather_hat:12,bluebird_hat:44};
fresh();for(const [id,value] of Object.entries(stats)){eq(`equipmentDef('${id}').defense`,value);eq(`equipmentDef('${id}').slot`,'head');eq(`stackLimit('${id}')`,1)}
for(const r of JSON.parse(run('JSON.stringify(recipes.filter(r=>r.category==="armor"&&equipmentDef(r.id)?.slot==="head"||r.id==="monitor"))'))){fresh();for(const [id,count]of Object.entries(r.need))run(`receive('${id}',${count})`);eq(`canCraft(recipes.find(r=>r.id==='${r.id}'))`,true);run(`craft('${r.id}','${r.category}')`);eq(`a.inventory['${r.id}']`,1)}
fresh();run('a.equipment.head="goggles";receive("optical_sight",1);craft("night_goggles","armor");equip("night_goggles")');eq('a.equipment.head','night_goggles');eq('actorAccuracyBonus(a,"fist")',0);eq('EQUIPMENT_SPECIAL_EFFECTS.night_goggles',undefined);
run('receive("stargazing_telescope",1);craft("xray_goggles","armor");equip("xray_goggles");a.equipment.accessory="optical_sight"');eq('actorAccuracyBonus(a,"fist")',12);eq('EQUIPMENT_SPECIAL_EFFECTS.xray_goggles.searchInterval',undefined);eq('droneAccuracy(DRONE_DEFS.bird,"fist")',97);
fresh();run('a.equipment.head="bluebird_hat";for(let i=0;i<3;i++)recordExploration(a,Date.now())');eq('a.st',50);run('recordExploration(a,Date.now())');eq('a.st',56);run('a.st=maxSt()-2;for(let i=0;i<4;i++)recordExploration(a,Date.now())');eq('a.st',120);
// Both independent exploration effects trigger on the same completed search, even with a full bag.
fresh();run('a.equipment.head="bluebird_hat";a.equipment.accessory="stargazing_telescope";equipmentState(a,"head").searches=3;equipmentState(a,"accessory").searches=14;for(const id of ["goggles","hat","machine_goggles","night_goggles","fur_hat","cloth_hat"])receive(id,1);recordExploration(a,Date.now())');eq('a.st',56);eq('a.bag.length',6);eq('equipmentState(a,"accessory").searches',0);
// Completed-search progress follows the hat instance across equipment swaps.
fresh();run('receive("bluebird_hat",1);equip("bluebird_hat");for(let i=0;i<3;i++)recordExploration(a,Date.now());receive("hat",1);equip("hat");recordExploration(a,Date.now());equip("bluebird_hat");recordExploration(a,Date.now())');eq('a.st',56);
// Real slashing hits reduce final base damage by 10%; other weapon types are unaffected.
fresh();run('globalThis.b={...a,id:"victim",equipment:{...a.equipment,head:"leather_hat"},hp:10000,bag:[],statusEffects:{},masteryAttacks:{fist:0}};a.equipment.weapon="wood_sword";globalThis.hit=actorAttack(a,b,Date.now());b.equipment.head="goggles";equipmentDef("goggles").defense=38;globalThis.plain=actorAttack(a,b,Date.now())');eq('hit.damage',Math.max(1,Math.floor(run('plain.damage')*.9)));eq('slashDamageMultiplier(b,"fist")',1);
for(const id of ['goggles','hat','glass_shard'])eq(`Object.values(regionObjects).flat().filter(x=>x.id==='${id}').length>0`,true);
run('showCraft("armor","head")');eq('$("modalBody").innerHTML.includes("幸福の予感")',true);eq('$("modalBody").innerHTML.includes("命中率＋7")',true);
console.log('PASS: headgear stats, all recipes, equipped ingredients, no inherited effects, accuracy, slash mitigation, independent capped exploration recovery and physical sources');
