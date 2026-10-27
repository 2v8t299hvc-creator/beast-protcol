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


const stats={bracelet:8,ruby_bracelet:36,gold_bracelet:25,silver_bracelet:35,hermes_bracelet:40,simple_armguard:12,armguard:18,iron_armguard:25,steel_armguard:35,obsidian_armguard:40};
fresh();for(const [id,n]of Object.entries(stats)){eq(`equipmentDef('${id}').defense`,n);eq(`equipmentDef('${id}').slot`,'arm')}
for(const r of JSON.parse(run('JSON.stringify(recipes.filter(r=>r.category==="armor"&&Object.hasOwn('+JSON.stringify(stats)+',r.id)))'))){fresh();for(const [id,n]of Object.entries(r.need))run(`receive('${id}',${n})`);eq(`canCraft(recipes.find(r=>r.id==='${r.id}'))`,true);run(`craft('${r.id}','armor')`);eq(`a.inventory['${r.id}']`,1)}
fresh();run('a.equipment.arm="simple_armguard";receive("bronze",1);craft("armguard","armor");equip("armguard")');eq('a.equipment.arm','armguard');eq('a.inventory.simple_armguard',undefined);eq('RECIPE_RARITY.obsidian_armguard','epic');
fresh();run('a.equipment.arm="ruby_bracelet";receive("ration",2);receive("drink",1);recoverActor(a,"ration");recoverActor(a,"drink")');eq('a.hp',122);eq('a.st',72);eq('recoverActor(a,"ration")',false);eq('recoveryAmount(a,"paradise_platter")',110);run('a.hp=179;recoverActor(a,"ration",Date.now()+3000)');eq('a.hp',180);
fresh();run('a.equipment.arm="hermes_bracelet";payMovementCost(a)');eq('a.st',46);run('a.st=2;payMovementCost(a)');eq('a.st',0);eq('a.hp',98);run('matchClock.section=0;payMovementCost(a)');eq('a.hp',98);
fresh();run('globalThis.b={...a,id:"victim",equipment:{...a.equipment,arm:"steel_armguard"},equipmentEffects:{},hp:10000,bag:[],statusEffects:{},masteryAttacks:{fist:0}};a.equipment.weapon="wood_sword";equipmentState(a,"weapon").durability=10;actorAttack(a,b,Date.now());actorAttack(a,b,Date.now()+59999)');eq('equipmentState(a,"weapon").durability',9);run('actorAttack(a,b,Date.now()+60000)');eq('equipmentState(a,"weapon").durability',8);eq('equipmentState(b,"arm").readyAt',1120000);
// Guarded contact triggers the arm skill; other weapon types still cannot.
run('Math.random=()=>.999;actorAttack(a,b,Date.now()+120000)');eq('equipmentState(a,"weapon").durability',7);eq('equipmentState(b,"arm").readyAt',1180000);run('Math.random=()=>0;a.equipment.weapon="practice_gauntlet";actorAttack(a,b,Date.now()+120000)');eq('equipmentState(b,"arm").readyAt',1180000);
fresh();run('a.equipment.arm="ruby_bracelet";receive("ration",1)');eq('usableCombatRecovery(a,Date.now()).heal',22);eq('regionObjects["住宅区画"].filter(x=>x.id==="bracelet").length',3);eq('regionObjects["神殿区画"].filter(x=>x.id==="bracelet").length',4);
console.log('PASS: ten arm stats, all recipes and equipped upgrades, recovery bonus/cooldown/cap, travel costs, slashing durability CT and physical bracelet sources');
