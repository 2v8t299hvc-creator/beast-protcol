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
 var target=comActors[0];target.place=S.place;target.hp=100000;target.equipment={};target.equipmentEffects={};target.bag=[];syncInventory(target);
 var d=drones.bird;Object.assign(d,{spawned:true,hp:100000,area:S.place,generation:1});`);
 return run;
}
let run;function fresh(){run=harness()}const eq=(s,v)=>assert.equal(run(s),v,s);
function equip(id){run(`receive('${id}',1);equip('${id}')`)}
const plain=s=>JSON.parse(run(`JSON.stringify(${s})`));

// Six/eight projectiles, one mastery action: player/COM, gun/bow, PvP/drone.
for(const who of ['S','target'])for(const weapon of ['laser_rifle','azusa_bow'])for(const night of [false,true])for(const drone of [false,true]){
 fresh();run(`var a=${who},victim=${who==='S'?'target':'S'};a.character='bat';a.equipment={weapon:'${weapon}'};a.equipmentAmmo={weapon:30};a.equipmentEffects={};a.masteryAttacks={gun:85,bow:85,fist:0};a.hp=100000;a.st=100;victim.hp=100000;victim.equipment={};victim.place=a.place;isNightAt=()=>${night};d.area=a.place;d.spawned=true;d.hp=100000;a.characterSkillReadyAt=0;var before=a.masteryAttacks[equipmentDef(a.equipment.weapon).weaponType];var result=executeDanse(a,${drone?'d':'victim'},1000000,${drone});`);
 eq('result.shots.length',night?8:6);eq('a.masteryAttacks[equipmentDef(a.equipment.weapon).weaponType]',run('before+1'));
 const value=run('a.masteryAttacks[equipmentDef(a.equipment.weapon).weaponType]');eq(`executeDanse(a,${drone?'d':'victim'},1001000,${drone})`,null);eq('a.masteryAttacks[equipmentDef(a.equipment.weapon).weaponType]',value);
}
// Post-SS growth also counts a volley once; an early-ending kill retains its separate kill reward.
fresh();run(`S.character='bat';S.equipment={weapon:'laser_rifle'};S.masteryAttacks.gun=120;S.hp=100000;target.hp=100000;target.equipment={};executeDanse(S,target,1000000)`);eq('S.ssAttackCounts.gun',1);eq('S.masteryAttacks.gun',121);
fresh();run(`S.character='bat';S.equipment={weapon:'laser_rifle'};S.masteryAttacks.gun=85;S.hp=100000;d.hp=1;d.spawned=true;executeDanse(S,d,1000000,true)`);eq('S.masteryAttacks.gun',87);
// A single actual bullet still gives one point; no-ammo/invalid skill attempts give none.
fresh();run(`S.character='bat';S.equipment={weapon:'practice_gun'};S.equipmentAmmo.weapon=1;S.masteryAttacks.gun=14;target.hp=100000;target.equipment={};var result=executeDanse(S,target,1000000)`);eq('result.shots.length',1);eq('S.masteryAttacks.gun',15);run(`S.characterSkillReadyAt=0`);eq('executeDanse(S,target,1001000)',null);eq('S.masteryAttacks.gun',15);
// Getting shot while treating cannot grant a counterattack target; instead a low-HP COM moves away.
fresh();run(`var a=target;matchClock.competitive=true;a.hp=40;a.st=100;a.restMode='hp';a.bodyInjuries={hand:{at:1}};a.bodyTreatment={part:'hand',place:a.place,dueAt:1010000};a.opponent=null;a.enemy=null;S.equipment={weapon:'practice_sword'};S.masteryAttacks.slash=0;var oldPlace=a.place;actorAttack(S,a,1000000);var hp=a.hp;`);eq('a.opponent',null);eq('a.restMode',null);eq('a.bodyTreatment',null);eq('a.damageNotice.area',run('oldPlace'));run(`stepCom(a,1001000)`);assert(run('a.place!==oldPlace'));assert(run('a.hp<=hp'));eq('a.opponent',null);
// Repeated moves still wait for the COM operation interval; do not restart stationary therapy meanwhile.
fresh();run(`var a=target;a.hp=25;a.st=100;a.damageNotice={at:1000000,area:a.place};a.moveDecisionReadyAt=1002500;var oldPlace=a.place,hp=a.hp;stepCom(a,1001000)`);eq('a.place',run('oldPlace'));eq('a.hp',run('hp'));eq('a.restMode',null);run('stepCom(a,1003000)');assert(run('a.place!==oldPlace'));
// Stale notices do not cause retreat, and the final zone continues paid searches rather than waiting to heal.
fresh();run(`var a=target;a.hp=25;a.st=100;a.damageNotice={at:990000,area:a.place};var oldPlace=a.place;stepCom(a,1001000)`);eq('a.place',run('oldPlace'));eq('a.restMode','hp');
fresh();run(`var a=target;a.hp=25;a.st=100;a.damageNotice={at:1000000,area:a.place};matchClock.competitive=true;matchClock.blocked=Object.keys(regionStock).filter(p=>p!==a.place);matchClock.nextBlocked=[];var oldPlace=a.place;stepCom(a,1001000)`);eq('a.place',run('oldPlace'));eq('a.matchStats.searches',1);eq('a.restMode',null);
// Lack of enough combined HP/ST for a move uses one stamina recovery tick, never a lethal retreat.
fresh();run(`var a=target;a.hp=2;a.st=0;a.bag=[];syncInventory(a);a.damageNotice={at:1000000,area:a.place};var oldPlace=a.place;stepCom(a,1001000)`);eq('a.hp',2);eq('a.place',run('oldPlace'));assert(run('a.st>0'));run('stepCom(a,1002000)');assert(run('a.place!==oldPlace'));assert(run('a.hp>0'));
console.log('PASS: one mastery/post-SS action per real volley across day/night, player/COM, gun/bow and PvP/drone; separate kill mastery; no-ammo/cooldown failures; damage-aware retreat without discovery tokens, repeat-move delay, stale notice, final-zone search and lethal-cost avoidance.');
