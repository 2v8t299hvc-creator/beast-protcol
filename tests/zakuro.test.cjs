// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(7)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
run("var a=comActors[6];a.bag=[];syncInventory(a);receive('wood_sword',1,null,a);receive('iron',1,null,a);stepCom(a,Date.now())");
assert.equal(run('a.name'),'ザクロ');assert.equal(run('a.character'),'zakuro');assert.equal(run('a.masteryAttacks.slash'),14);assert.equal(run('a.masteryAttacks.bow'),14);assert.equal(run('masteryRank("slash",a)'),4);assert.equal(run('masteryRank("bow",a)'),4);assert.equal(run('a.masteryAttacks.gun'),0);assert.equal(run('a.starterWeapon'),'practice_sword');assert.equal(run('comAmmoType(a)'),null);
run("a.place='山岳区画';matchClock.section=1;craftActor(a,recipes.find(r=>r.id==='iron_sword'));comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'iron_sword');
run("a.place=S.place;S.hp=180;Math.random=()=>0;var cut=actorAttack(a,S,Date.now())");assert.equal(run('cut.type'),'slash');assert.equal(run('a.masteryAttacks.slash'),17);assert.equal(run('a.masteryAttacks.bow'),14);
run("receive('azusa_bow',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'azusa_bow');assert.equal(run('a.preferredWeaponType'),'bow');assert.equal(run('comAmmoType(a)'),'arrows');assert.equal(run('a.equipmentAmmo.weapon'),20);
run("Math.random=()=>.999;S.hp=180;var shot=actorAttack(a,S,Date.now())");assert.equal(run('shot.type'),'bow');assert.equal(run('shot.guarded'),true);assert(run('shot.damage>0'));assert.equal(run('a.equipmentAmmo.weapon'),19);assert.equal(run('a.masteryAttacks.bow'),15);assert.equal(run('a.masteryAttacks.slash'),17);
run("receive('arrows',20,null,a)");assert.equal(run('reloadActor(a)'),1);assert.equal(run('a.equipmentAmmo.weapon'),20);
run("var plan={id:'iron_sword',missing:{},needed:{},crafts:[]}");assert.equal(run("comWants(a,'bullets',plan)"),false);
run("receive('laser_rifle',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'azusa_bow');
run("S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat();showIncomingDamage(a,{dealt:10});announceComDeath(a,'戦闘',Date.now(),S.id)");assert.equal(run("$('enemyArt').src"),run('actorArt(a)'));assert.equal(run("$('enemyFallback').textContent"),'🦎');assert.equal(run("$('incomingFace').src"),run('actorArt(a)'));assert.equal(run('deathNotices.at(-1).art'),run('actorArt(a)'));
assert(fs.existsSync(require('node:path').join(__dirname,'../assets/characters/zakuro_encounter_transparent.webp')));
const z=harness();z.run("var a=comActors[6];a.bag=[];syncInventory(a);receive('western_bow',1,null,a);receive('bronze',1,null,a);stepCom(a,Date.now())");assert.equal(z.run('a.starterWeapon'),'practice_bow');assert.equal(z.run('a.equipmentAmmo.weapon'),20);
// Production initialization still has nine COMs, nine official COM characters and no placeholders.
run('initializeComActors()');assert.equal(run('comActors.length'),9);assert.equal(run('comActors.filter(a=>!a.name.startsWith("訓練COM")).length'),9);assert.equal(run('comActors.filter(a=>a.name==="ザクロ").length'),1);
console.log('PASS: Zakuro dual D, material-based slash/bow start, real crafting, independent attacks/mastery, guarded bow and reload, weapon preference, portraits and ten-person roster');
