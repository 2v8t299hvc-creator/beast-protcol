// Combat economy, recovery preparation and closure-safe COM movement regressions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 const elements=new Map(),timers=[];
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return 1000000}},getComputedStyle:()=>({backgroundImage:''}),timers,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext('Math.random=()=>.5',context);
 vm.runInContext(source,context);vm.runInContext('startSelectedCharacter()',context);
 const run=s=>vm.runInContext(s,context);
 run(`matchClock.section=1;matchClock.sectionEndsAt=9000000;matchClock.blocked=[];matchClock.nextBlocked=[];
 S.place='山岳区画';S.bag=[];syncInventory();S.equipment={};S.equipmentAmmo={};S.equipmentEffects={};S.hp=100000;S.st=100;
 var target=comActors[0];target.place=S.place;target.hp=100000;target.equipment={};target.equipmentEffects={};
 var d=drones.bird;Object.assign(d,{spawned:true,hp:100000,area:S.place,generation:1});`);
 return run;
}
let run;function fresh(){run=harness()}const eq=(s,v)=>assert.equal(run(s),v,s);
function equip(id){run(`receive('${id}',1);equip('${id}')`)}
const plain=s=>JSON.parse(run(`JSON.stringify(${s})`));

function prepared(){fresh();run(`var a=target;Object.assign(a,{character:'flugel',preferredWeaponType:'slash',level:15,equipment:{weapon:'kukri',head:'xray_goggles',body:'archangel_robe',arm:'steel_armguard',legs:'diamond_boots',accessory:'auto_magazine'},bag:[],inventory:{},enemy:null,opponent:null,loot:null,leaveDanger:false,restMode:null,bodyTreatment:null,goal:null,noProgress:0,searches:0,exhausted:{},visited:{},adaptivePlanCache:null});a.hp=actorMax(a,'hp');a.st=100;matchClock.competitive=false;for(const d of Object.values(drones))d.spawned=false`)}
// Replay the logged melee loadout: a held medical stone beats a useless magazine.
prepared();run(`receive('medical_stone',1,null,a)`);eq('comEquipBetter(a,1000000)',true);eq('a.equipment.accessory','medical_stone');
// Recipe ingredients already held beat remote recovery routes; cooking precedes treatment.
prepared();run(`receive('lighter',1,null,a);receive('hotwater',1,null,a);receive('paradisefish',1,null,a);a.hp=20;var plan=comRecoveryPlan(a,1000000,comPlan(a,null))`);eq('plan.recipeId','paradise_broth');run('stepCom(a,1000000)');assert(run('(a.inventory.paradise_broth||0)>0'));eq('a.restMode',null);
// A full-health Kankan with no healing does not sacrifice HP; stocked, observed combat may use it.
prepared();run(`a.character='kankan';a.hp=actorMax(a,'hp');a.damageNotice={at:1000000,area:a.place}`);eq('comShouldBurnSpirit(a,1000000)',false);run(`receive('compressed_ration',3,null,a)`);eq('comShouldBurnSpirit(a,1000000)',true);eq('comShouldBurnSpirit(a,1009000)',false);
// Under fire with movement locked still pays for random discovery, never a free retaliation target.
prepared();run(`matchClock.competitive=true;a.hp=35;a.st=50;a.biteUntil=1010000;a.damageNotice={at:1000000,area:a.place};a.restMode='hp';var searches=a.matchStats.searches||0;stepCom(a,1000000)`);eq('a.restMode',null);eq('a.matchStats.searches',run('searches+1'));assert(run("!a.opponent||a.opponent.source==='search'"));
// An old damage notice does not block normal safe treatment.
prepared();run(`a.hp=20;a.damageNotice={at:990000,area:a.place};stepCom(a,1000000)`);eq('a.restMode','hp');
console.log('PASS: replayed melee accessory swap, held-food cooking before treatment, stocked-only spirit, paid discovery under fire and stale-notice isolation.');
