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

fresh();run(`S.equipment={weapon:'super_wild_hammer',head:'bluebird_hat',accessory:'stargazing_telescope'};S.st=0;S.hp=100;S.bag=[];syncInventory();renderEquipmentSkills()`);
eq(`$('equipmentSkillRail').hidden`,false);eq(`$('equipmentSkillRail').innerHTML.includes('wild_power.webp')`,true);
run(`applyWeaponEffects(S,target,'hammer',true);applyWeaponEffects(S,target,'hammer',true)`);eq(`equipmentSkillView('weapon','super_wild_hammer').label`,'2/3 +0');
run(`applyWeaponEffects(S,target,'hammer',true)`);eq(`equipmentSkillView('weapon','super_wild_hammer').label`,'0/3 +1');eq(`equipmentSkillView('weapon','super_wild_hammer').notice.message`,'攻撃力＋1（累計＋1）');
run(`for(let i=0;i<4;i++)recordExploration(S,Date.now())`);eq(`equipmentSkillView('head','bluebird_hat').label`,'0/4');eq(`equipmentSkillView('accessory','stargazing_telescope').label`,'4/15');
run(`var before=JSON.stringify(S.equipmentEffects);renderEquipmentSkills();renderEquipmentSkills()`);eq('JSON.stringify(S.equipmentEffects)',run('before'));
run(`S.bag=Array.from({length:BAG_SLOTS},()=>({id:'stone',count:1}));syncInventory();for(let i=0;i<11;i++)recordExploration(S,Date.now())`);eq(`equipmentSkillView('accessory','stargazing_telescope').notice.blocked`,true);eq(`equipmentSkillView('accessory','stargazing_telescope').label`,'0/15');
fresh();run(`S.equipment={weapon:'keraunos_hammer'};applyWeaponEffects(S,target,'hammer',true)`);eq(`equipmentSkillView('weapon','keraunos_hammer').remaining`,30);eq(`equipmentSkillView('weapon','keraunos_hammer',1030000).remaining`,0);
fresh();run(`S.equipment={accessory:'life_death_scales'};S.hp=10;endureDamage(S,20)`);eq(`equipmentSkillView('accessory','life_death_scales').remaining`,300);run(`S.equipment={};renderEquipmentSkills()`);eq(`$('equipmentSkillRail').hidden`,true);run(`S.equipment={accessory:'life_death_scales'}`);eq(`equipmentSkillView('accessory','life_death_scales').remaining`,300);
fresh();run(`target.equipment={weapon:'super_wild_hammer'};for(let i=0;i<3;i++)applyWeaponEffects(target,S,'hammer',true)`);eq('equipmentSkillNotices.has(target)',false);
console.log('PASS: actual attack/search triggers, growth and cooldowns, full-bag skip, read-only rendering, equipped-only rail and COM isolation.');
