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

function setup(){fresh();run(`var a=target,b=comActors[1],c=comActors[2];matchClock.competitive=true;matchClock.blocked=Object.keys(regionStock).filter(x=>x!==S.place);matchClock.nextBlocked=[];matchClock.section=9;for(const d of Object.values(drones))d.spawned=false;for(const actor of [S,a,b,c]){actor.place=S.place;actor.hp=200;actor.st=100;actor.equipment={weapon:'practice_sword'};actor.bag=[];syncInventory(actor);actor.opponent=null;actor.enemy=null;actor.combatReadyAt=0;actor.characterSkillReadyAt=99999999;actor.characterFieldReadyAt=99999999}for(const actor of comActors.filter(x=>![a,b,c].includes(x)))actor.hp=0;`)}
// Damage is not a discovery token, and cannot overwrite a target found through a paid search.
setup();run(`actorAttack(S,a,1000000)`);eq('a.opponent',null);eq('a.recentThreat',undefined);
run(`observeOpponent(a,b,1000001);actorAttack(S,a,1000002)`);eq('a.opponent.id',run('b.id'));eq('hasObservedOpponent(a,b,1000002)',true);
run(`a.opponent={id:S.id,source:'attack',area:S.place,seenAt:1000000,observerVisit:0,targetVisit:0}`);eq('hasObservedOpponent(a,S,1000001)',false);
// Final-zone searches spend real stamina and can discover another participant instead of the attacker.
setup();run(`actorAttack(S,a,1000000);var paid=a.st;stepCom(a,1001000)`);eq('a.opponent.source','search');eq('a.opponent.id',run('b.id'));eq('a.st',run('paid-searchStaminaCost(a)'));eq('a.matchStats.searches',1);
run(`var hp=b.hp;stepCom(a,1002000);stepCom(a,1003000)`);assert(run('b.hp<hp'));eq('a.opponent',null);run(`stepCom(a,1007000)`);eq('a.matchStats.searches',2);
// Repeated final-area searches sample all living co-located opponents, without attacker bias.
setup();run(`var seed=11;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};var seenTargets=new Set();for(let i=0;i<90;i++){a.opponent=null;a.st=100;a.hp=200;comFinalSearch(a,1000000+i*3000);if(a.opponent)seenTargets.add(a.opponent.id)}`);eq('seenTargets.size',3);
// With an idle human and three COMs, the real scheduler produces autonomous mixed-target combat.
setup();run(`var seed=72;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};for(const actor of [a,b,c])actor.nextActionAt=1001000;for(let t=1;t<=30;t++)updateComActors(1000000+t*1000);var attacks=[a,b,c].reduce((n,x)=>n+(x.matchStats.pvpAttacks||0),0),searches=[a,b,c].reduce((n,x)=>n+(x.matchStats.searches||0),0);`);assert(run('attacks>=6'));assert(run('searches>=attacks'));assert(run('S.hp<200'));assert(run(`[a,b,c].some(x=>x.history.some(e=>e.text.includes(' → ')&&!e.text.includes('ザクロ')))`));
// A zero-reserve participant attacks a discovered healthy foe, including outside the final zone.
setup();run(`matchClock.blocked=[];a.hp=10000;observeOpponent(a,S,1000000);var hp=S.hp;comFightOpponent(a,1000000);comFightOpponent(a,1001000)`);assert(run('S.hp<hp'));assert(run(`!a.history.some(e=>e.text.includes('戦闘を見送る'))`));
// Final-area searches bypass long rest, injury treatment, material routes and old avoidance flags.
setup();run(`a.restMode='stamina';a.st=1;a.hp=200;a.avoidOptionalFightUntil=99999999;a.bodyInjuries={head:{at:1}};a.leaveDanger=true;stepCom(a,1001000)`);eq('a.matchStats.searches',1);eq('a.restMode',null);eq('a.bodyTreatment',null);
// The final closure warning cannot freeze everyone when no escape destination exists.
setup();run(`matchClock.nextBlocked=[S.place];matchClock.sectionEndsAt=1005000;stepCom(a,1001000)`);eq('a.matchStats.searches',1);eq('a.opponent.source','search');
// Low-stamina final-area searches cannot pay a lethal HP cost by cheating.
setup();run(`a.st=0;a.hp=1;stepCom(a,1001000)`);assert(run('a.hp>1'));eq('a.matchStats.searches||0',0);
// Once basic ammo support is equipped, a practice gun must not prioritize a luxury magazine.
fresh();run(`var a=target;a.character='snow_leopard';a.preferredWeaponType='gun';a.equipment={weapon:'practice_gun',accessory:'simple_magazine'};a.equipmentAmmo={weapon:20};a.bag=[];syncInventory(a);a.exhausted={};a.adaptivePlanCache=null;var p=comCurrentPlan(a)`);assert(run(`equipmentDef(p.id).slot==='weapon'`));
// A fully gathered large meal is cooked even during the next collection pause, using real ingredients.
fresh();run(`var a=target;a.level=15;a.equipment={weapon:'laser_rifle'};a.equipmentAmmo={};a.bag=[];syncInventory(a);receive('salted_meat',1,null,a);receive('heated_frying_pan',1,null,a);a.hp=actorMax(a,'hp');a.st=100;a.recoveryBuildPauseUntil=99999999;var food=comRecoveryPlan(a,1000000,{needed:{}});var can=comReserveTurn(a,{id:'steampunk_goggles',needed:{},crafts:[]},food,false,1000000)`);eq('food.recipeId','steak');eq('can',true);run(`craftActor(a,recipes.find(r=>r.id==='steak'),1000000)`);assert(run('a.inventory.steak>0'));eq('a.inventory.salted_meat||0',0);eq('a.inventory.heated_frying_pan||0',0);assert(run('a.bag.length<=6'));
console.log('PASS: no damage-granted discoveries or retargeting; paid final-zone multi-target search/attack/search; no reserve gate; real resource costs and survival; weapon priority after basic support; real large-recovery crafting.');
