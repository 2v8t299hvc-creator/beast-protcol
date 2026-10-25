// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source,context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}

let h=harness();let run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
function active(){h=harness();h.advance(30000);run('S.hp=100;S.st=20;S.bag=[];syncInventory()')}
active();run('rest()');eq('S.recoveryMode','stamina');eq('S.st',20);eq('S.hp',100);h.advance(999);eq('S.st',20);h.advance(1);eq('S.st',25);eq('S.hp',100);h.advance(2000);eq('S.st',35);
run('rest()');eq('S.recoveryMode',null);h.advance(5000);eq('S.st',35);
// Treatment is the HP counterpart; switching modes resets the tick clock without running both.
run('skill()');eq('S.recoveryMode','hp');h.advance(1000);eq('S.hp',102);eq('S.st',35);run('rest()');h.advance(1000);eq('S.hp',102);eq('S.st',40);
// A full value ends its mode and is clamped; repeated toggles cannot yield instant healing.
active();run('S.st=maxSt()-2;rest()');h.advance(1000);eq('S.st',run('maxSt()'));eq('S.recoveryMode',null);
run('S.hp=maxHp()-1;skill()');h.advance(1000);eq('S.hp',run('maxHp()'));eq('S.recoveryMode',null);
active();for(let i=0;i<5;i++)run('rest();rest()');eq('S.st',20);
// Crafting is allowed throughout either mode and does not interrupt it.
for(const mode of ['stamina','hp']){
 active();run(`receive('wood',1);receive('lighter',1);toggleRecoveryMode('${mode}');showCraft('item','plant');craft('charcoal')`);eq('S.inventory.charcoal',1);eq('S.recoveryMode',mode);h.advance(1000);eq(mode==='hp'?'S.hp':'S.st',mode==='hp'?102:25);
}
// Search, stock exploration, movement and contact all cancel recovery.
active();run('rest();Math.random=()=>0.99;primary()');eq('S.recoveryMode',null);h.tickAction();eq('S.st',17);h.advance(5000);eq('S.st',17);
active();run(`rest();S.found=[{id:'stone',count:1}];takeFound(0)`);eq('S.recoveryMode',null);h.tickAction();
active();run(`skill();move('森林区画')`);eq('S.recoveryMode',null);
active();run(`matchClock.section=2;matchClock.blocked=[];Object.assign(drones.bird,{spawned:true,hp:50,area:'山岳区画',generation:1});S.place=drones.bird.area;rest();discoverDrone('bird')`);eq('S.recoveryMode',null);run('skill()');eq('S.enemy',false);
// Incoming damage, including a zero-damage hit, interrupts treatment without later recovery.
active();run('skill();receiveAttackDamage(10)');eq('S.hp',90);eq('S.recoveryMode',null);h.advance(5000);eq('S.hp',90);
run('rest();receiveAttackDamage(0)');eq('S.recoveryMode',null);
// Preparation, death and final closure cannot start or retain recovery.
h=harness();run('S.hp=100;S.st=20;rest();skill()');eq('S.recoveryMode',null);
active();run('skill();receiveAttackDamage(1000)');eq('S.hp',0);eq('S.recoveryMode',null);h.advance(5000);eq('S.hp',0);
active();run('skill();matchClock.nextBlocked=[S.place]');h.setNow(run('matchClock.sectionEndsAt'));run('tickMatchClock()');eq('S.hp',0);eq('S.recoveryMode',null);
// Wall-clock catch-up recovers elapsed full seconds only and does not overshoot the cap.
active();run('rest()');h.advance(5500);eq('S.st',45);h.advance(500);eq('S.st',50);
console.log('PASS: gradual rest/treatment, exclusive modes, no instant-toggle healing, crafting, interruption, cap/stop and wall-clock catch-up');
