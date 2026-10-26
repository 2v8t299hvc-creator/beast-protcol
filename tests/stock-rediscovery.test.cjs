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

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


let h,run;const eq=(s,v)=>assert.equal(run(s),v,s);
function fixture(){h=harness();run=s=>h.run(s);run(`selectPracticeWeapon('practice_bow');move('山岳区画');matchClock.section=1;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];comActors.length=0;S.found=['a','b','c','d'].map((uid,i)=>({uid,id:i===2?'wood':'stone',area:S.place,count:1,taken:false}));`)}
fixture();run('takeFound(2);takeFound(2)');eq('S.st',117);eq('S.found.map(x=>x.uid).join(\",\")','a,b,c,d');h.tickAction();eq('S.found.map(x=>x.uid).join(\",\")','c,a,b,d');eq('S.pendingFound.uid','c');eq('S.inventory.wood||0',0);eq('S.ticks',1);run('decideFound(false)');eq('S.found.map(x=>x.uid).join(\",\")','c,a,b,d');eq('S.found.length',4);
run('takeFound(0)');h.tickAction();run('closeModal()');eq('S.found.map(x=>x.uid).join(\",\")','c,a,b,d');eq('S.found.length',4);
run('takeFound(0)');h.tickAction();run('decideFound(true)');eq('S.inventory.wood',1);eq('S.found.map(x=>x.uid).join(\",\")','a,b,d');eq('S.pendingFound',null);
// The bag may be full: re-discovering and keeping an item must still refresh its recency.
fixture();run('S.bag=Array.from({length:6},()=>({id:"cloth",count:10}));syncInventory();takeFound(1)');h.tickAction();eq('S.pendingFound.uid','b');eq('S.found.map(x=>x.uid).join(\",\")','b,a,c,d');run('decideFound(true)');eq('S.pendingFound.uid','b');run('decideFound(false)');eq('S.found.map(x=>x.uid).join(\",\")','b,a,c,d');eq('S.inventory.cloth',60);
// Same item types are different physical objects. Only the searched object is moved/deduplicated.
fixture();run('takeFound(1)');h.tickAction();run('decideFound(false);pushStock(S.found[0])');eq('S.found.filter(x=>x.id==="stone").length',3);eq('S.found.map(x=>x.uid).join(\",\")','b,a,c,d');
// Insufficient stamina, remote dropped objects and interruption must not refresh an uncompleted search.
fixture();run('S.st=2;takeFound(2)');eq('S.found.map(x=>x.uid).join(\",\")','a,b,c,d');eq('S.busy',false);
fixture();run('S.found[2].dropped=true;S.found[2].area="森林区画";takeFound(2)');eq('S.st',120);
fixture();run('takeFound(2);S.actionToken++');h.tickAction();eq('S.found.map(x=>x.uid).join(\",\")','a,b,c,d');eq('S.pendingFound',null);
console.log('PASS: stock re-discovery promotes the exact object, prompts take/keep, never duplicates, works with a full bag and preserves recency on rejected/interrupted searches');
