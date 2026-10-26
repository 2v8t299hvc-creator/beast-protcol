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




let h=harness(),run=h.run;
const thresholds=[0,2,5,9,14,20,27,34,42,50,60,72,85,102,120];
assert.deepEqual(JSON.parse(run('JSON.stringify(MASTERY_THRESHOLDS)')),thresholds);
for(let rank=0;rank<thresholds.length;rank++){
 run(`S.masteryAttacks.hammer=${thresholds[rank]}`);assert.equal(run("masteryRank('hammer')"),rank);
 if(rank){run(`S.masteryAttacks.hammer=${thresholds[rank]-1}`);assert.equal(run("masteryRank('hammer')"),rank-1);}
}
for(const [character,type,rank,points] of [['kaito','fist',3,9],['hayate','bow',5,20],['snow_leopard','gun',5,20],['bjorn','hammer',5,20]])assert.equal(run(`masteryRank('${type}',{masteryAttacks:initialMastery('${character}')})`),rank);
h=harness();run=h.run;run("matchClock.section=1;S.place='山岳区画';S.equipment={weapon:'practice_gauntlet'};S.level=15;var a=comActors[0];a.place=S.place;a.equipment={};a.hp=100000;Math.random=()=>0.999;for(let i=0;i<50;i++)actorAttack(S,a,Date.now()+i*1000)");assert.equal(run('S.masteryAttacks.fist'),59);assert.equal(run("MASTERY_RANKS[masteryRank('fist')]"),'B+');
run('actorAttack(S,a,Date.now()+50000)');assert.equal(run("MASTERY_RANKS[masteryRank('fist')]"),'A');
run('for(let i=0;i<25;i++)actorAttack(S,a,Date.now()+51000+i*1000)');assert.equal(run("MASTERY_RANKS[masteryRank('fist')]"),'S');
run('for(let i=0;i<35;i++)actorAttack(S,a,Date.now()+76000+i*1000)');assert.equal(run("MASTERY_RANKS[masteryRank('fist')]"),'SS');assert.equal(run('S.masteryAttacks.fist'),120);assert.equal(run('S.masteryAttacks.gun'),0);assert.equal(run("masteryProgress('fist')"),'MAX');
h=harness();run=h.run;run("matchClock.section=1;S.place='山岳区画';S.equipment={};S.hp=100000;var a=comActors[0];a.place=S.place;a.level=15;a.equipment={weapon:'practice_bow'};a.equipmentAmmo.weapon=20;receive('arrows',99,null,a);Math.random=()=>0.999;for(let i=0;i<100;i++){if(!weaponAmmo(a.equipment.weapon,a.equipmentAmmo.weapon))reloadActor(a);actorAttack(a,S,Date.now()+i*1000)}");assert.equal(run('a.masteryAttacks.bow'),120);assert.equal(run("MASTERY_RANKS[masteryRank('bow',a)]"),'SS');assert.equal(run('a.inventory.arrows'),19);
run("S.bag=[];syncInventory();var before=S.masteryAttacks.hammer;receive('wood_hammer',1);receive('steel',1);craftActor(S,recipes.find(r=>r.id==='steel_hammer'))");assert.equal(run('S.masteryAttacks.hammer'),run('before+3'));
run("S.masteryAttacks.fist=9");assert.equal(run("masteryProgress('fist')"),'0/5');
console.log('PASS: all 15 rank boundaries, preserved E+/D+ starts, miss-inclusive real attacks reach A/S/SS at 51/76/111 for Kaito and SS at 100 for D+ COM, independent types, unchanged craft bonuses and progress display');
