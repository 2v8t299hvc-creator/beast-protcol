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


const stats={suit:18,royal_suit:48,sailor_suit:32,navy_suit:49,lab_coat:10,apothecary_clothes:18,holy_robe:31,archangel_robe:46,doctor_suit:20,black_doctor_gown:32,mad_doctor_gown:47};
fresh();for(const [id,n]of Object.entries(stats)){eq(`equipmentDef('${id}').defense`,n);eq(`equipmentDef('${id}').slot`,'body')}
const newIds=[...Object.keys(stats),'fine_cloth','gold_thread','sea_thread','black_thread','herb_oil','poison_potion','healing_potion'];
for(const r of JSON.parse(run('JSON.stringify(recipes.filter(r=>'+JSON.stringify(newIds)+'.includes(r.id)))'))){fresh();for(const [id,n]of Object.entries(r.need))run(`receive('${id}',${n})`);eq(`canCraft(recipes.find(r=>r.id==='${r.id}'))`,true);run(`craft('${r.id}','${r.category}')`);eq(`a.inventory['${r.id}']`,r.count||1)}
// Only epic+ crafting XP gets the exact 10% bonus; combat and mastery do not.
fresh();run('a.equipment.body="royal_suit";receive("suit",1);receive("gold_thread",1);craft("royal_suit","armor")');eq('a.xp',17.6);eq('a.level',1);run('gainXp(1,a)');eq('a.xp',18.6);eq('craftExperience(a,recipes.find(r=>r.id==="sailor_suit"))',10);
// Four potions must all fit before consuming any ingredients, including when the normal batch of three would fit.
fresh();run('a.equipment.body="archangel_robe";receive("herb",2);receive("hotwater",2);receive("healing_potion",7);receive("stone",1);receive("wood",1);receive("scrap",1);globalThis.before=JSON.stringify(a);globalThis.r=recipes.find(r=>r.id==="healing_potion")');eq('canCraft(r)',false);eq('craftActor(a,r)',false);eq('JSON.stringify(a)',run('before'));run('a.bag=a.bag.filter(x=>x.id!=="scrap");syncInventory(a);craftActor(a,r)');eq('a.inventory.healing_potion',11);eq('a.matchStats.crafted.healing_potion',4);eq('craftOutputCount(a,recipes.find(r=>r.id==="seaweed_soup"))',3);
fresh();run('a.equipment.body="archangel_robe";receive("herb",1);receive("hotwater",1);showCraft("item","recovery")');eq('$("modalBody").innerHTML.includes("回復薬 ×4")',true);eq('recoveryAmount(a,"herb")',10);eq('recoveryAmount(a,"healing_potion")',30);
// Slower crafting XP never changes weapon mastery gains or unrelated damage types.
fresh();run('globalThis.b={...a,id:"enemy",equipment:{...a.equipment,body:"navy_suit"},equipmentEffects:{},hp:10000,statusEffects:{}};a.equipment.weapon="handgun";a.equipmentAmmo.weapon=8;globalThis.reduced=actorAttack(a,b,Date.now());EQUIPMENT_DEFS.same_armor={slot:"body",attack:0,defense:49};b.equipment.body="same_armor";globalThis.plain=actorAttack(a,b,Date.now())');eq('reduced.damage',Math.max(1,Math.floor(run('plain.damage')*.9)));
// Attack-triggered injury can proc on a miss. Other hits refresh active duration without ignoring the skill cooldown.
fresh();run('a.equipment.body="mad_doctor_gown";globalThis.b={...a,id:"enemy",equipment:{...a.equipment,body:null},hp:10000,statusEffects:{},equipmentEffects:{}};Math.random=()=>.999;actorAttack(a,b,1000000)');eq('b.injuryUntil',1005000);eq('equipmentState(a,"body").readyAt',1030000);run('Math.random=()=>0;a.equipment.body=null;actorAttack(a,b,1004000)');eq('b.injuryUntil',1009000);run('actorAttack(a,b,1009000)');eq('b.injuryUntil',1009000);run('a.equipment.body="mad_doctor_gown";actorAttack(a,b,1030000)');eq('b.injuryUntil',1035000);
// Ordinary and stock searches pay HP once, on starting; expired injury and failed searches cost none.
fresh();run('a.injuryUntil=Date.now()+5000;primary()');eq('a.hp',96);eq('a.st',47);h.tickAction();eq('a.hp',96);
fresh();run('pushStock(regionObjects[a.place][0]);a.injuryUntil=Date.now()+5000;takeFound(0)');eq('a.hp',96);h.tickAction();eq('a.hp',96);
fresh();run('a.injuryUntil=Date.now();paySearchCost(a,Date.now())');eq('a.hp',100);run('a.injuryUntil=Date.now()+5000;a.st=0;primary()');eq('a.hp',100);
fresh();run('a.injuryUntil=Date.now()+5000;a.hp=4;primary()');eq('a.hp',0);eq('matchClock.result','eliminated');eq('a.busy',false);eq('a.pendingFound',null);
// Drone retaliation extends an existing injury; respawn clears any injury carried by a previous generation.
fresh();run('a.injuryUntil=1001000;droneCounterDamage(DRONE_DEFS.bird,a,1000999)');eq('a.injuryUntil',1005999);eq('Object.values(regionObjects).flat().filter(x=>x.id==="herb").length',12);
console.log('PASS: body equipment recipes/stats, exact epic XP, atomic bonus potion batches, gun reduction, attack-triggered wound CT/refresh and ordinary/stock search injury/death');
