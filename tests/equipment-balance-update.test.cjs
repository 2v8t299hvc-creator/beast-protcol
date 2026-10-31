// User-confirmed plasma/bracelet/dragon-boots balance changes against the actual game engine.
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
// Confirm exact requested changes, retaining every recipe and all explicitly unchanged gear.
fresh();eq('EQUIPMENT_DEFS.plasma.attack',46);eq('EQUIPMENT_SPECIAL_EFFECTS.plasma.name','迸る電撃');eq('EQUIPMENT_SPECIAL_EFFECTS.silver_bracelet.name','純然たる輝き');eq('EQUIPMENT_DEFS.silver_bracelet.defense',35);eq('EQUIPMENT_DEFS.dragon_scale_boots.defense',48);eq('EQUIPMENT_SPECIAL_EFFECTS.dragon_scale_boots.searchCostBonus',-1);
assert.deepEqual(plain(`recipes.find(r=>r.id==='plasma').need`),{reinforced:1,discharger:1});assert.deepEqual(plain(`recipes.find(r=>r.id==='silver_bracelet').need`),{gold_bracelet:1,whitesilver:1});assert.deepEqual(plain(`recipes.find(r=>r.id==='dragon_scale_boots').need`),{dragon_scale:1,scale_boots:1});
eq('EQUIPMENT_DEFS.drag_energy_07.attack',55);eq('EQUIPMENT_DEFS.drag_energy_07.capacity',20);eq('!!EQUIPMENT_DEFS.drag_energy_07.unlimitedAmmo',false);eq('EQUIPMENT_DEFS.rubber_gloves.attack',24);eq('EQUIPMENT_DEFS.philosophers_stone.defense',20);eq('EQUIPMENT_SPECIAL_EFFECTS.philosophers_stone.actionRecovery',2);
// The trigger is inclusive at 50, checks the victim, and never spends their stamina.
for(const st of [0,49,50,51,100]){
 fresh();run(`S.equipment.weapon='plasma';S.st=100;target.st=${st};var hit=applyWeaponEffects(S,target,'fist',true);var miss=applyWeaponEffects(S,target,'fist',false)`);eq('hit.fixedDamage',st<=50?5:0);eq('!!hit.lightning',st<=50);eq('miss.fixedDamage',0);eq('target.st',st);eq('S.st',100);
}
fresh();run(`S.equipment.weapon='plasma';var hit=applyWeaponEffects(S,{kind:'bird'},'fist',true);var unknown=applyWeaponEffects(S,{},'fist',true);var wrong=applyWeaponEffects(S,target,'slash',true)`);eq('hit.fixedDamage',5);eq('unknown.fixedDamage',0);eq('wrong.fixedDamage',0);
// Real player/COM damage includes five extra points; a critical doesn't multiply the fixed bonus.
function plasmaHit(st,com=false,rng=.5){fresh();run(`var a=${com?'target':'S'},v=${com?'S':'target'};a.equipment.weapon='plasma';a.masteryAttacks.fist=${rng>=.99999?0:120};a.hp=10000;v.hp=10000;v.st=${st};Math.random=()=>${rng};var hit=actorAttack(a,v,Date.now())`);return plain('hit')}
for(const com of [false,true])for(const rng of [.5,.98]){const high=plasmaHit(51,com,rng),low=plasmaHit(50,com,rng);assert.equal(low.damage-high.damage,5);assert.equal(low.effect.fixedDamage,5)}
const guardedHigh=plasmaHit(51,false,.99999),guardedLow=plasmaHit(50,false,.99999);assert(guardedLow.guarded);assert(guardedLow.damage-guardedHigh.damage>=2&&guardedLow.damage-guardedHigh.damage<=3);
fresh();run(`S.equipment.weapon='plasma';var hit=strikeDrone(S,d,Date.now())`);eq('hit.effect.fixedDamage',5);
// End-of-hit reduction is rounded down after guard/other modifiers and precedes lethal-save checks.
fresh();run(`target.equipment.arm='silver_bracelet';var skill={id:'test',multiplier:1}`);eq('finalCharacterDamage(101,S,target,null,Date.now(),false)',101);eq('finalCharacterDamage(101,S,target,skill,Date.now(),false)',80);eq('finalCharacterDamage(101,S,target,skill,Date.now(),true)',40);eq('finalCharacterDamage(1,S,target,skill,Date.now(),false)',1);
run(`target.hp=90;target.equipment.accessory='life_death_scales'`);eq('finalCharacterDamage(100,S,target,skill,Date.now(),false)',80);eq('target.equipmentEffects?.accessory?.readyAt||0',0);
// Compare identical defenses, with/without the special effect, for every implemented attack skill.
function skillHit(character,skill,protectedArm,com=false){
 fresh();run(`var a=${com?'target':'S'},v=${com?'S':'target'};EQUIPMENT_DEFS.test_plain_arm={slot:'arm',attack:0,defense:35};
 a.character='${character}';a.equipment={weapon:'${character==='bat'?'practice_gun':'practice_gauntlet'}'};a.equipmentAmmo.weapon=20;a.hp=100000;a.st=100;a.breezeStacks=4;a.breezeUntil=Date.now()+30000;
 if(a.character==='kankan'){a.burningSpiritUntil=Date.now()+30000;a.burningSpiritPower=40;}
 v.hp=100000;v.st=100;v.equipment={arm:'${protectedArm?'silver_bracelet':'test_plain_arm'}'};v.equipmentEffects={};a.characterSkillReadyAt=0;Math.random=()=>.5;
 var hit=actorAttack(a,v,Date.now(),false,${skill?"'"+skill+"'":'null'})`);return {hit:plain('hit'),cooldown:run('a.characterSkillReadyAt'),slow:run('v.slowUntil||0')};
}
for(const [character,skill]of [['kaito','step_break'],['hayate','gale_shoot'],['snow_leopard','white_target'],['bjorn','physics_blow'],['flugel','une_deux'],['jerk','outlaw_bite'],['zakuro','jewel_hunt'],['bat','danse_macabre']]){
 for(const com of [false,true]){
  const normal=skillHit(character,skill,false,com),protectedHit=skillHit(character,skill,true,com);
  if(skill==='danse_macabre'){
   assert.equal(protectedHit.hit.shots.length,normal.hit.shots.length);
   protectedHit.hit.shots.forEach((shot,i)=>assert.equal(shot.damage,Math.max(1,Math.floor(normal.hit.shots[i].damage*.8)),character+' per shot'));
  }else assert.equal(protectedHit.hit.damage,Math.max(1,Math.floor(normal.hit.damage*.8)),character+' active damage');
  assert(protectedHit.cooldown>0,character+' still activates');
  if(skill==='step_break')assert(protectedHit.slow>1000000, 'Step Break still applies its slow');
 }
}
// Regular attacks (even buffed by a field skill) and rejected/foreign skill requests aren't reduced.
for(const character of ['kaito','hayate','kankan']){const n=skillHit(character,null,false),p=skillHit(character,null,true);assert.equal(n.hit.damage,p.hit.damage)}
function invalidSkill(protectedArm,character='kaito'){
 fresh();run(`EQUIPMENT_DEFS.test_plain_arm={slot:'arm',attack:0,defense:35};S.character='${character}';S.equipment.weapon='practice_gauntlet';target.equipment.arm='${protectedArm?'silver_bracelet':'test_plain_arm'}';S.characterSkillReadyAt=Date.now()+60000;Math.random=()=>.5;var hit=actorAttack(S,target,Date.now(),false,'step_break')`);return run('hit.damage');
}
assert.equal(invalidSkill(true),invalidSkill(false));assert.equal(invalidSkill(true,'hayate'),invalidSkill(false,'hayate'));
// Equipped-only: a bracelet in the bag does nothing; plasma's passive alone is not an active skill.
const normal=plasmaHit(50);fresh();run(`S.equipment.weapon='plasma';S.masteryAttacks.fist=120;target.st=50;receive('silver_bracelet',1,null,target);Math.random=()=>.5;var hit=actorAttack(S,target,Date.now())`);eq('hit.damage',normal.damage);
// Updated values, names and descriptions flow through the normal equipment UI.
fresh();run(`receive('plasma',1);equip('plasma');receive('silver_bracelet',1);equip('silver_bracelet');receive('dragon_scale_boots',1);equip('dragon_scale_boots');showEquipment()`);assert(run(`$('modalBody').innerHTML.includes('迸る電撃')`));assert(run(`$('modalBody').innerHTML.includes('純然たる輝き')`));assert(run(`equipmentDetails('plasma').includes('攻撃 46')`));assert(run(`equipmentDetails('dragon_scale_boots').includes('防御 48')`));
console.log('PASS: exact requested stats/recipes and unchanged gear; inclusive plasma threshold, fixed bonus, PvP/COM/drone/guard/critical paths; all eight active skills, one reduction per volley hit, normal/cooldown exclusions, rounding and lethal-save ordering; equipment descriptions.');
