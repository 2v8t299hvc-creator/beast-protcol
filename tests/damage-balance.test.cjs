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
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;const eq=(s,v)=>assert.equal(run(s),v,s);
function fresh(){h=harness();run=s=>h.run(s);run('globalThis.a=comActors[0];matchClock.section=1;S.place=a.place="山岳区画";Math.random=()=>0;')}
const cases=[
 {name:'early bow D+',level:1,weapon:'practice_bow',type:'bow',mastery:20,gear:{},expected:[13,14,15]},
 {name:'early fist E+',level:1,weapon:'practice_gauntlet',type:'fist',mastery:9,gear:{},expected:[11,12,13]},
 {name:'middle rare full B',level:8,weapon:'mighty_bow',type:'bow',mastery:42,gear:{head:'fur_hat',arm:'iron_armguard',body:'insulated_suit',legs:'steel_leg_cover',accessory:'stargazing_telescope'},expected:[29,30,30]},
 {name:'late epic full SS',level:15,weapon:'azusa_bow',type:'bow',mastery:120,gear:{head:'xray_goggles',arm:'steel_armguard',body:'royal_suit',legs:'amalgam_boots',accessory:'mythic_telescope'},expected:[66,67,68]}
];
for(const c of cases){fresh();run(`S.level=a.level=${c.level};S.equipment={weapon:'${c.weapon}',head:null,arm:null,body:null,legs:null,accessory:null,...${JSON.stringify(c.gear)}};a.equipment={...S.equipment};S.hp=actorMax(S,'hp');a.hp=actorMax(a,'hp');S.masteryAttacks['${c.type}']=${c.mastery};S.equipmentAmmo.weapon=20;`);const damages=[];for(const roll of [-1,0,1]){run(`S.fightingInstinct=null;S.masteryAttacks['${c.type}']=${c.mastery};attackRoll=()=>${roll};globalThis.result=actorAttack(S,a,Date.now())`);damages.push(run('result.damage'));}assert.deepEqual(damages,c.expected,c.name);}
// Full defense always helps continuously, rather than collapsing weak attacks to the minimum by subtraction.
fresh();run('S.masteryAttacks.bow=120');const curve=run('Array.from({length:31},(_,i)=>combatDamage(93,i*10,"bow",1,S))');assert(curve.every((v,i)=>v>=1&&(!i||v<=curve[i-1])));assert(curve[20]>60&&curve[22]<70);eq('combatDamage(1,100000,"fist",1,S)',1);
// Fixed weapon effects are added after normal mitigation. The magma burst remains exactly 15 on a miss.
fresh();run('S.equipment.weapon="magma_blaster";S.equipmentAmmo.weapon=8;Math.random=()=>.999;actorAttack(S,a,Date.now());actorAttack(S,a,Date.now()+1000);globalThis.result=actorAttack(S,a,Date.now()+2000)');eq('result.hit',false);eq('result.damage',15);
// Forecasts use the same armor curve, keeping COM choices consistent with actual battle damage.
fresh();run('S.level=a.level=8;S.equipment.weapon=a.equipment.weapon="mighty_bow";S.equipmentAmmo.weapon=a.equipmentAmmo.weapon=8;S.masteryAttacks.bow=a.masteryAttacks.bow=42;a.equipment.body="royal_suit";globalThis.forecast=evaluateCombat(S,a,Date.now());attackRoll=()=>0;globalThis.result=actorAttack(S,a,Date.now())');eq('forecast.perHit',run('result.damage'));
console.log('PASS: actual early practice/naked 11-15, middle rare/full 29-30, late epic/SS/full 66-68, continuous armor curve, fixed effects and COM forecast parity');
