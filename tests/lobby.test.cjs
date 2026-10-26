// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}

let h=harness(),run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
eq('S.place','待機所');eq('masteryRank("fist")',3);eq('initialMastery("hayate").bow',26);eq('initialMastery("hayate").fist',0);
run('move("山岳区画")');eq('S.place','待機所');
for(const id of ['practice_sword','practice_hammer','practice_gauntlet','practice_bow','practice_gun']){
 run(`selectPracticeWeapon('${id}')`);eq('S.equipment.weapon',id);eq(`EQUIPMENT_DEFS['${id}'].attack`,8);eq('S.bag.length',2);
 if(id==='practice_bow'||id==='practice_gun')eq('weaponAmmo()',20);
}
eq('S.inventory.practice_sword||0',0);
run('move("森林区画");selectPracticeWeapon("practice_sword");move("待機所")');eq('S.place','森林区画');eq('S.equipment.weapon','practice_gun');eq('S.st',120);
h.advance(30000);eq('matchClock.result',null);eq('matchClock.section',1);
h=harness();h.advance(29999);eq('matchClock.result',null);h.advance(1);eq('matchClock.result','eliminated');eq('S.hp',0);
h=harness();run('selectPracticeWeapon("practice_bow")');h.setNow(1030000);run('move("山岳区画")');eq('matchClock.result','eliminated');eq('S.place','待機所');
h=harness();h.advance(1350000);eq('matchClock.result','eliminated');
console.log('PASS: lobby start, mastery presets, five attack-8 choices, no duplication, full ammo, one-way departure and exact timeout elimination');
