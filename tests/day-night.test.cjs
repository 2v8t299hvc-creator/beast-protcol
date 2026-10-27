// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(6)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
assert.equal(run('ACTIVE_MATCH_SECONDS'),1320);assert.equal(run('DAY_NIGHT_PHASE_SECONDS'),330);
// Exact millisecond edges; preparation never consumes the first day.
for(const [seconds,phase,index,remaining] of [[0,'preparation',-1,30],[29.999,'preparation',-1,1],[30,'day',0,330],[359.999,'day',0,1],[360,'night',1,330],[689.999,'night',1,1],[690,'day',2,330],[1019.999,'day',2,1],[1020,'night',3,330],[1349.999,'night',3,1],[1350,'night',3,0],[2000,'night',3,0]]){
 const v=run(`dayNightAt(matchClock.startedAt+${seconds}*1000)`);assert.equal(v.phase,phase);assert.equal(v.index,index);assert.equal(v.remaining,remaining);assert.equal(v.isNight,phase==='night');
}
// Rendering follows the same clock and leaves the preparation/section clock independent.
h.setNow(1360000);run('renderMatchStatus()');assert.equal(run("$('dayNightLabel').textContent"),'🌙 夜1');assert.equal(run("$('dayNightClock').textContent"),'昼まで 05:30');assert.equal(run("$('game').classList.contains('bp-night')"),true);
h.setNow(1690000);run('renderMatchStatus()');assert.equal(run("$('dayNightLabel').textContent"),'☀️ 昼2');assert.equal(run("$('game').classList.contains('bp-night')"),false);
// Skills resolving a historical action must see its phase, even when returning at a later time.
h.setNow(2100000);assert.equal(run('isNightAt(matchClock.startedAt+360000)'),true);assert.equal(run('isNightAt(matchClock.startedAt+690000)'),false);
// Early victory freezes its actual phase and remaining clock; a new match clears it.
run('matchClock.ended=true;matchClock.finishedAt=matchClock.startedAt+500000;renderMatchStatus()');assert.equal(run("$('dayNightLabel').textContent"),'🌙 夜1');assert.equal(run("$('dayNightClock').textContent"),'演習終了');assert.equal(run('dayNightAt().remaining'),190);
run('initializeMatch();renderMatchStatus()');assert.equal(run("$('dayNightLabel').textContent"),'準備中');assert.equal(run("$('game').classList.contains('bp-night')"),false);
assert.equal(run('comActors[5].name'),'ノクス');
console.log('PASS: four equal phases, preparation offset, millisecond boundaries, UI, historical skill query, early-finish freeze and reset, Nox name');
