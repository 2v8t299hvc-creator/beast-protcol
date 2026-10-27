// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


let h=harness(),run=h.run;
assert.equal(run('comActors.length'),9);assert.equal(run('comActors[8].name'),'ラク');assert.equal(run('comActors[8].character'),'raku');assert.equal(run('comActors.filter(a=>a.name.startsWith("訓練COM")).length'),0);
for(const [roll,type,weapon,ammo] of [[0,'fist','practice_gauntlet',null],[.2,'slash','practice_sword',null],[.4,'hammer','practice_hammer',null],[.6,'bow','practice_bow','arrows'],[.8,'gun','practice_gun','bullets']]){
 h=harness();run=h.run;
 // Force the production initialization draw, then verify actual lobby/equipment/action paths.
 run(`Math.random=()=>${roll};initializeComActors();var a=comActors[8];a.bag=[];syncInventory(a);stepCom(a,Date.now())`);
 assert.equal(run('a.randomMasteryType'),type);assert.equal(run('a.preferredWeaponType'),type);assert.equal(run('a.masteryAttacks[a.randomMasteryType]'),20);assert.equal(run('Object.values(a.masteryAttacks).filter(n=>n===20).length'),1);assert.equal(run('Object.values(a.masteryAttacks).filter(n=>n===0).length'),4);assert.equal(run('a.equipment.weapon'),weapon);assert.equal(run('comAmmoType(a)'),ammo);
 assert.equal(run('a.equipmentAmmo.weapon'),ammo?20:undefined);
 run('initializeRakuMastery(a,()=>{throw Error("rerolled")});comCurrentPlan(a);comCurrentPlan(a)');assert.equal(run('a.randomMasteryType'),type);
 run("a.place=S.place;matchClock.section=1;S.hp=180;Math.random=()=>.999;var result=actorAttack(a,S,Date.now())");assert.equal(run('result.type'),type);assert.equal(run('result.guarded'),true);assert(run('result.damage>0'));assert.equal(run('a.masteryAttacks[a.randomMasteryType]'),21);assert.equal(run('a.equipmentAmmo.weapon'),ammo?19:undefined);
 if(ammo){run(`receive('${ammo}',20,null,a)`);assert.equal(run('reloadActor(a)'),1);assert.equal(run('a.equipmentAmmo.weapon'),20);}else assert.equal(run('reloadActor(a)'),0);
 run("var plan={missing:{},needed:{},crafts:[]}");assert.equal(run("comWants(a,'bullets',plan)"),ammo==='bullets');assert.equal(run("comWants(a,'arrows',plan)"),ammo==='arrows');
 run('initializeRakuMastery(a,()=>{throw Error("lost learned mastery")})');assert.equal(run('a.masteryAttacks[a.randomMasteryType]'),21);
}
// Equal-width buckets cover all five types exactly; non-Raku actors never consume lottery draws.
run('var counts=Object.fromEntries(RAKU_WEAPON_TYPES.map(t=>[t,0]));for(let i=0;i<1000;i++){var actor={character:"raku"};initializeRakuMastery(actor,()=>i/1000);counts[actor.randomMasteryType]++}');assert.deepEqual(JSON.parse(run('JSON.stringify(Object.values(counts))')),[200,200,200,200,200]);
run('initializeRakuMastery(comActors[0],()=>{throw Error("wrong character draw")})');
// Every new participant initialization draws anew, without affecting the old participant object.
run('var old=comActors[8],oldType=old.randomMasteryType;Math.random=()=>0;initializeComActors();var fresh=comActors[8]');assert.equal(run('old!==fresh'),true);assert.equal(run('fresh.randomMasteryType'),'fist');assert.equal(run('old.randomMasteryType'),run('oldType'));
run("var a=fresh;S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat();showIncomingDamage(a,{dealt:10});announceComDeath(a,'戦闘',Date.now(),S.id)");assert.equal(run("$('enemyArt').src"),run('actorArt(a)'));assert.equal(run("$('enemyFallback').textContent"),'🦝');assert.equal(run("$('incomingFace').src"),run('actorArt(a)'));assert.equal(run('deathNotices.at(-1).art'),run('actorArt(a)'));
assert(fs.existsSync(require('node:path').join(__dirname,'../assets/characters/raku_encounter_transparent.webp')));
console.log('PASS: Raku lottery exact uniform buckets, all five real starts/guarded attacks/mastery/ammo/reload, no reroll or progress reset, fresh matches, all portraits and fully named ten-person roster');
