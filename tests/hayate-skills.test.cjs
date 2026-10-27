const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},setAttribute(k,v){this[k]=v},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext("globalThis.seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}",context);
 vm.runInContext(source,context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}






let h,run;function fresh(){h=harness();run=h.run;run("matchClock.section=1;matchClock.competitive=false;S.character='hayate';S.place='山岳区画';S.st=120;S.breezeStacks=0;S.breezeUntil=0;var a=comActors[1];a.place=S.place;a.hp=10000;attackRoll=()=>0;rollCritical=()=>false;Math.random=()=>0");}const eq=(s,v)=>assert.equal(run(s),v,s);
fresh();run('var costs=[];for(let i=0;i<6;i++)costs.push(payMovementCost(S,1000000+i*1000).staminaCost)');assert.deepEqual(JSON.parse(run('JSON.stringify(costs)')),[5,5,3,3,1,1]);eq('S.breezeStacks',4);eq('S.breezeUntil',1035000);eq('breezeStacks(S,1034999)',4);eq('breezeStacks(S,1035000)',0);run('payMovementCost(S,1035000)');eq('S.breezeStacks',1);eq('S.st',97);
fresh();run('S.st=0;S.breezeStacks=4;S.breezeUntil=1030000;payMovementCost(S,1000000)');eq('S.hp',179);eq('S.st',0);
for(let n=0;n<=4;n++){
 fresh();run(`var normal=actorAttack(S,a,1000000).damage;S.breezeStacks=${n};S.breezeUntil=1030000;S.st=0;var result=actorAttack(S,a,1000000,false,'gale_shoot')`);eq('result.damage',Math.floor(run('normal')*(115+5*n)/100));eq('S.breezeStacks',0);eq('S.characterSkillReadyAt',1040000);eq('result.characterSkill.stacks',n);eq('S.st',n===4?Math.floor(run('result.dealt')*.25):0);
 run("var again=actorAttack(S,a,1039999,false,'gale_shoot')");eq('again.characterSkill',null);eq('S.characterSkillReadyAt',1040000);run("var ready=actorAttack(S,a,1040000,false,'gale_shoot')");eq('ready.characterSkill.stacks',0);eq('S.characterSkillReadyAt',1080000);
}
fresh();run("S.breezeStacks=4;S.breezeUntil=1000000;var result=actorAttack(S,a,1000000,false,'gale_shoot')");eq('result.characterSkill.stacks',0);
fresh();run("S.breezeStacks=4;S.breezeUntil=1030000;S.st=0;S.equipment.weapon='steel_sword';a.hp=7;Math.random=()=>.999;var result=actorAttack(S,a,1000000,false,'gale_shoot')");eq('result.guarded',true);eq('result.dealt',7);eq('result.characterSkill.staminaRecovered',1);
fresh();run("S.breezeStacks=4;S.breezeUntil=1030000;S.st=119;var d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:S.place});var result=strikeDrone(S,d,1000000,'gale_shoot')");eq('result.characterSkill.stacks',4);eq('S.st',120);eq('result.characterSkill.staminaRecovered',1);
fresh();run("matchClock.competitive=true;a.combatReadyAt=0;a.character='hayate';a.breezeStacks=4;a.breezeUntil=1030000;a.st=0;S.hp=10000;var result=playerCombatRound(a,S,1000000,true,comCharacterSkill(a,1000000))");eq('result.first.characterSkill.stacks',4);eq('comCharacterSkill(a,1039999)',null);eq('comCharacterSkill(a,1040000)','gale_shoot');
fresh();run("S.breezeStacks=3;S.breezeUntil=1030000;a.place='森林区画';var result=actorAttack(S,a,1000000,false,'gale_shoot')");eq('result',null);eq('S.breezeStacks',3);eq('S.characterSkillReadyAt||0',0);
fresh();run('S.breezeStacks=4;S.breezeUntil=1030000;renderCharacterSkills(1000000)');eq("$('characterPassiveCount').textContent",'4/4');assert(run("$('characterSkillBtn').title.includes('40秒')"));
console.log('PASS: Hayate pre-move discounts, cap/refresh/expiry, HP fallback, all skill multipliers, CT boundaries, guard/overkill/cap recovery, drones/COM, invalid target and UI');
