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




let h,run;
function fresh(){h=harness();run=s=>h.run(s);run(`comActors.length=0;globalThis.a=S;matchClock.section=4;matchClock.sectionEndsAt=Date.now()+1000000;matchClock.blocked=[];matchClock.nextBlocked=[];a.place='山岳区画';a.bag=[];syncInventory(a);a.equipment={weapon:null,head:null,arm:null,body:null,legs:null,accessory:null};a.equipmentAmmo={};a.equipmentEffects={};a.masteryAttacks={bow:0,gun:0,fist:0};a.hp=100;a.st=50;Math.random=()=>0;globalThis.d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:a.place,generation:1});`)}
const eq=(s,v)=>assert.equal(run(s),v,s);



const stats={boots:6,fur_boots:12,synthetic_boots:25,amalgam_boots:44,primal_boots:44,wing_boots:11,spike_boots:22,diamond_boots:55,gear_boots:24,automation_boots:42,leg_cover:12,steel_leg_cover:25,energy_socks:36};
fresh();for(const [id,n]of Object.entries(stats)){eq(`equipmentDef('${id}').defense`,n);eq(`equipmentDef('${id}').slot`,'legs')}
for(const r of JSON.parse(run('JSON.stringify(recipes.filter(r=>r.category==="armor"&&Object.hasOwn('+JSON.stringify(stats)+',r.id)||r.id==="energy_gear"))'))){fresh();for(const [id,n]of Object.entries(r.need))run(`receive('${id}',${n})`);eq(`canCraft(recipes.find(r=>r.id==='${r.id}'))`,true);run(`craft('${r.id}','${r.category}')`);eq(`a.inventory['${r.id}']`,1)}
// A duplicate recipe accepts one worn pair plus one bag pair, and rejects a single pair atomically.
fresh();run('receive("fur_boots",1);equip("fur_boots")');eq('canCraft(recipes.find(r=>r.id==="synthetic_boots"))',false);eq('a.equipment.legs','fur_boots');run('receive("fur_boots",1);craft("synthetic_boots","armor")');eq('a.inventory.synthetic_boots',1);eq('a.equipment.legs',null);
fresh();run('a.equipment.legs="diamond_boots"');eq('searchStaminaCost(a)',4);run('a.st=3;primary()');eq('a.st',3);eq('a.busy',false);run('a.st=10;primary()');eq('a.st',6);
fresh();run('a.equipment.legs="automation_boots";globalThis.b={equipment:{body:"passion_bikini"}}');eq('droneDiscoveryRate(a)',.9);eq('Math.round(actorDiscoveryRate(b,a)*100)',95);eq('actorDiscoveryRate(a,{equipment:{}})',.85);
fresh();run('receive("energy_socks",1);equip("energy_socks")');eq('maxSt()',150);eq('a.st',50);run('a.st=149;receive("water",1);recoverActor(a,"water")');eq('a.st',150);run('unequip("legs")');eq('maxSt()',120);eq('a.st',120);
fresh();run('a.equipment.legs="energy_socks";a.st=150;receive("boots",1);equip("boots")');eq('a.st',120);
// One bonus entry per corpse, restricted to obtainable <= rare items, including a full 12-slot victim.
fresh();run('a.equipment.legs="primal_boots";globalThis.body=createDroneCorpse("bird",a.place,Date.now(),a.id)');eq('body.items.filter(x=>x.source==="野生の本能").length',1);eq('body.items.at(-1).count',1);eq('corpseBonusPool().every(id=>["common","uncommon","rare"].includes(RECIPE_RARITY[id]||"common"))',true);
run('globalThis.v={...a,id:"victim",equipment:{weapon:"wood_sword",head:"hat",arm:"bracelet",body:"swimsuit",legs:"boots",accessory:"telescope"},equipmentEffects:{},bag:Array.from({length:6},()=>({id:"stone",count:1})),corpseId:null};globalThis.c=createPlayerCorpse(v,a.place,Date.now(),a.id)');eq('c.items.length',13);eq('createPlayerCorpse(v,a.place,Date.now(),a.id).items.length',13);
// Every leaf in the plasma and new equipment recipe trees has an actual physical source.
fresh();eq('regionObjects["地下機構区画"].filter(x=>x.id==="core").length',1);eq('regionObjects["海底研究区画"].filter(x=>x.id==="core").length',1);eq('regionObjects["海岸区画"].filter(x=>x.id==="goggles").length',4);eq('regionObjects["山岳区画"].filter(x=>x.id==="boots").length',4);
run('globalThis.sources=new Set([...Object.values(regionObjects).flat().map(x=>x.id),...Object.values(DRONE_DEFS).flatMap(x=>x.drops)]);globalThis.checkRoute=(id,path=[])=>{if(sources.has(id))return true;if(path.includes(id))return false;const r=recipes.find(x=>x.id===id);return !!r&&Object.keys(r.need).every(x=>checkRoute(x,[...path,id]))}');eq('checkRoute("plasma")',true);for(const id of Object.keys(stats))eq(`checkRoute('${id}')`,true);
console.log('PASS: thirteen leg stats/recipes, duplicate equipped ingredients, search cost/discovery, max-stamina cap, single bonus corpse reward and physical plasma/equipment material reachability');
