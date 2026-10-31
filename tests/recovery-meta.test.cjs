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
// The five-second cycle is shared by player/COM and independent HP/stamina groups.
for(const who of ['S','target']){
 fresh();run(`${who}.bag=[];syncInventory(${who});${who}.hp=10;${who}.st=1;receive('ration',3,null,${who});receive('drink',2,null,${who})`);
 eq(`recoverActor(${who},'ration',1000000)`,true);eq(`recoverActor(${who},'ration',1004999)`,false);eq(`recoverActor(${who},'drink',1000000)`,true);eq(`recoverActor(${who},'ration',1005000)`,true);eq(`${who}.inventory.ration`,1);
}
fresh();run(`S.hp=10;receive('ration',1);recoverActor(S,'ration')`);assert(run(`recoveryButtonHTML('ration','使用').includes('あと 5.0秒')`));
// Early/mid damage remains untouched; SS reaches the target range and high defense can sustain medium heals.
fresh();run(`S.level=15;S.masteryAttacks.slash=120;S.equipment.weapon='zantetsu_sword';var ss=combatDamage(totalStat('attack',S),249,'slash',1,S),tank=combatDamage(totalStat('attack',S),317,'slash',1,S),extreme=combatDamage(totalStat('attack',S),350,'slash',1,S)`);assert(run('ss>=75&&ss<=85'));assert(run('tank*2<=90'));assert(run('extreme<tank'));eq('MASTERY_MULTIPLIERS[5]',1);eq('MASTERY_MULTIPLIERS[10]',2.02);eq('damageAfterDefense(40,0)',37);
console.log('SS standard/tank/extreme damage:',run('ss'),run('tank'),run('extreme'));
function prepared(level=6){
 fresh();run(`var a=target;Object.assign(a,{character:'snow_leopard',preferredWeaponType:'gun',level:${level},equipment:{weapon:'laser_rifle',head:'steampunk_goggles',arm:'hermes_bracelet',body:'dragon_suit',legs:'diamond_boots',accessory:'snakeskin_quiver'},equipmentAmmo:{},equipmentEffects:{},bag:[],inventory:{},enemy:null,opponent:null,recentThreat:null,loot:null,goal:null,noProgress:0,searches:0,exhausted:{},visited:{},adaptivePlanCache:null,characterFieldReadyAt:999999999});a.hp=actorMax(a,'hp');a.st=actorMax(a,'stamina');matchClock.competitive=false;for(const d of Object.values(drones))d.spawned=false`);
}
// A healthy COM deliberately cooks a multi-output recovery batch, with no free items or slots.
prepared();run(`receive('wood',1,null,a);receive('lighter',1,null,a);receive('beast_meat',1,null,a);var recipe=comRecoveryPlan(a,Date.now(),comPlan(a,null));var beforeHP=a.hp`);eq('recipe.recipeId','smoked_meat');
run(`stepCom(a,1000000);stepCom(a,1001000)`);eq('a.inventory.smoked_meat',3);eq('a.inventory.wood||0',0);eq('a.inventory.lighter||0',0);eq('a.inventory.beast_meat||0',0);eq('a.hp',run('beforeHP'));assert(run('a.bag.length<=6'));eq('comRecoveryTotal(a)',180);
// Already owning an output does not suppress further batches toward the reserve target.
run(`receive('beast_meat',1,null,a);receive('charcoal',1,null,a);var next=comRecoveryPlan(a,1010000,comPlan(a,null))`);eq('next.recipeId','smoked_meat');assert(run(`next.crafts.includes('smoked_meat')`));run(`craftActor(a,recipes.find(r=>r.id===next.recipeId),1010000)`);eq('a.inventory.smoked_meat',6);
// Four herbs/medicines are no longer treated as sufficient stock. Late game separately needs burst recovery.
prepared(15);run(`receive('advanced_healing_potion',4,null,a)`);eq('comWants(a,"advanced_healing_potion",comPlan(a,null))',true);run(`receive('advanced_healing_potion',6,null,a);var late=comRecoveryPlan(a,Date.now(),comPlan(a,null))`);eq('comRecoveryTotal(a)',900);eq('late.expectedHeal',150);assert(run(`late.recipeId==='steak'||late.recipeId==='dragon_meat'`));
run(`a.bag=[{id:'steak',count:8},{id:'energy_drink',count:8}];syncInventory(a)`);eq('comRecoveryTotal(a)',1200);eq('comRecoveryPlan(a,Date.now(),comPlan(a,null))',null);eq('comWants(a,"advanced_healing_potion",comPlan(a,null))',false);
// Cooking plans include non-edible ingredients and do not consume reserved legendary crafting material.
prepared(15);run(`receive('dragon_scale',1,null,a);var p=comRecoveryPlan(a,Date.now(),{needed:{dragon_scale:1}})`);assert(run(`p.recipeId!=='dragon_meat'&&p.recipeId!=='dragon_fruit'`));assert(run('Object.keys(p.missing).length>0'));
// Medium reserves are preferred for pre-final attrition; large recovery is selected for the final duel.
prepared(15);run(`receive('advanced_healing_potion',8,null,a);receive('steak',5,null,a);a.hp=actorMax(a,'hp')-110;matchClock.blocked=Object.keys(regionStock).slice(3)`);eq('comSelectRecovery(a,"hp",Date.now(),true).id','advanced_healing_potion');run(`matchClock.blocked=Object.keys(regionStock).slice(1)`);eq('comSelectRecovery(a,"hp",Date.now(),true).id','steak');
run(`receive('healing_potion',1,null,a);a.hp=actorMax(a,'hp')-30`);eq('comSelectRecovery(a,"hp",Date.now(),true).id','healing_potion');
// Combat healing is off the attack turn and obeys the same item cooldown.
prepared(15);run(`matchClock.competitive=true;S.place=a.place;S.hp=100;receive('steak',5,null,a);a.hp=100;observeOpponent(a,S,Date.now());var n=a.inventory.steak;handleComCombatDecision(a,S,Date.now(),'player')`);eq('a.inventory.steak',run('n-1'));eq('a.recoveryReadyAt.hp',1005000);run(`handleComCombatDecision(a,S,1001000,'player')`);eq('a.inventory.steak',run('n-1'));
// The COM cannot inspect an opponent's hidden recovery stock to make combat decisions.
run(`var before=JSON.stringify(evaluateCombat(a,S,1001000));S.bag=[{id:'steak',count:1000}];syncInventory(S)`);eq('JSON.stringify(evaluateCombat(a,S,1001000))',run('before'));
// The original screenshot's goal must be discarded when both hat sources are excluded from travel.
prepared(1);run(`a.character='bjorn';a.preferredWeaponType='hammer';a.equipment.weapon='drag_eater';a.equipment.head=null;a.place='湖畔区画';a.bag=[{id:'cloth',count:1},{id:'fur',count:1},{id:'healing_potion',count:6},{id:'water',count:10}];syncInventory(a);a.hp=100000;a.st=100000;var initial=comCurrentPlan(a)`);eq('initial.id','fur_hat');
run(`matchClock.nextBlocked=['住宅区画','公園区画'];var changed=comCurrentPlan(a);for(let i=0;i<12;i++)stepCom(a,1000000+i*1000)`);assert(run(`changed.id!=='fur_hat'`));assert(run('(a.matchStats.searches||0)>0'));assert(run('(a.matchStats.moves||0)<8'));
// Planning cache reflects next closures and remembered danger expiring at the actual decision time.
prepared(1);run(`a.preferredWeaponType='hammer';a.equipment.weapon='drag_eater';a.equipment.head=null;a.bag=[{id:'cloth',count:1},{id:'fur',count:1}];syncInventory(a);a.dangerAreas={'住宅区画':1090000,'公園区画':1090000};var danger=comCurrentPlan(a,1000000);var expired=comCurrentPlan(a,1100000)`);assert(run(`danger.id!=='fur_hat'`));eq('expired.id','fur_hat');
// First escape is still immediate; only repeated COM movement waits for another decision/operation.
prepared();run(`var start=a.place,plan=comPlan(a,null);var first=comMove(a,1000000,'逃走',plan,true);var destination=a.place,paid=a.st;var repeated=comMove(a,1001000,'逃走',plan,true)`);eq('first',true);assert(run('destination!==start'));eq('repeated',false);eq('a.st',run('paid'));eq('a.place',run('destination'));eq('comMove(a,1003000,"逃走",plan,true)',true);
run(`matchClock.blocked=[a.place]`);eq('comMove(a,1003100,"封鎖退避",plan,true)',true);
// The player retains immediate movement, with no COM decision timer applied to their controls.
fresh();run(`S.st=100;move('港湾区画');var firstPlace=S.place;move('湖畔区画')`);eq('firstPlace','港湾区画');eq('S.place','湖畔区画');eq('S.st',90);eq('S.moveDecisionReadyAt',undefined);
// A material-seeking move with no useful destination does not pick a random empty region.
prepared();eq('comMove(a,Date.now(),"不足素材",{id:"x",missing:{nonexistent:1},needed:{},crafts:[]})',false);
// Full-bag crafting either frees real slots or declines; it never expands the six-slot bag.
prepared(15);run(`a.bag=[{id:'beast_meat',count:10},{id:'charcoal',count:10},{id:'wood',count:10},{id:'stone',count:10},{id:'water',count:10},{id:'bullets',count:20}];syncInventory(a);var cooked=craftActor(a,recipes.find(r=>r.id==='smoked_meat'));var plan=comRecoveryPlan(a,Date.now(),comPlan(a,null));if(plan)comMakeRoom(a,plan.recipeId||'steak',1,plan,Date.now())`);eq('cooked',false);assert(run('a.bag.length<=6'));
console.log('PASS: 5-second player/COM cooldown and UI; SS/tank damage targets; healthy proactive multi-batch cooking, 1000+ reserves and final-duel recovery quality; real ingredients/slots; hidden-info isolation; closure/danger cache and screenshot regression; COM-only movement pacing with instant first escape/player movement.');
