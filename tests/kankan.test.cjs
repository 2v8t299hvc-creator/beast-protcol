// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(8)',context);vm.runInContext('matchClock.competitive=false',context);
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
run("var a=comActors[7];a.bag=[];syncInventory(a);receive('knuckle',1,null,a);receive('iron',1,null,a);stepCom(a,Date.now())");
assert.equal(run('a.name'),'カンカン');assert.equal(run('a.character'),'kankan');assert.equal(run('a.preferredWeaponType'),'fist');assert.equal(run('a.masteryAttacks.fist'),20);assert.equal(run('masteryRank("fist",a)'),5);assert.equal(run('a.masteryAttacks.bow'),0);assert.equal(run('a.masteryAttacks.gun'),0);assert.equal(run('a.starterWeapon'),'practice_gauntlet');assert.equal(run('a.equipmentAmmo.weapon'),undefined);assert.equal(run('comAmmoType(a)'),null);
run("a.place='工業区画';matchClock.section=1;var plan=comCurrentPlan(a)");assert.equal(run('plan.id'),'iron_knuckle');
run("craftActor(a,recipes.find(r=>r.id==='iron_knuckle'));comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'iron_knuckle');assert.equal(run('a.masteryAttacks.fist'),22);
run("receive('laser_rifle',1,null,a);receive('azusa_bow',1,null,a);comEquipBetter(a,Date.now())");assert.equal(run('a.equipment.weapon'),'iron_knuckle');assert.equal(run('reloadActor(a)'),0);
run("var plan={id:'brilliant_knuckle',missing:{},needed:{},crafts:[]}");assert.equal(run("comWants(a,'bullets',plan)"),false);assert.equal(run("comWants(a,'arrows',plan)"),false);
run("a.place=S.place;S.hp=180;Math.random=()=>.999;var result=actorAttack(a,S,Date.now())");assert.equal(run('result.type'),'fist');assert.equal(run('result.guarded'),true);assert(run('result.damage>0'));assert.equal(run('a.masteryAttacks.fist'),23);
run("S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat();showIncomingDamage(a,result);announceComDeath(a,'戦闘',Date.now(),S.id)");assert.equal(run("$('enemyArt').src"),run('actorArt(a)'));assert.equal(run("$('enemyFallback').textContent"),'🐼');assert.equal(run("$('incomingFace').src"),run('actorArt(a)'));assert.equal(run('deathNotices.at(-1).art'),run('actorArt(a)'));
assert(fs.existsSync(require('node:path').join(__dirname,'../assets/characters/kankan_encounter_transparent.webp')));
run('initializeComActors()');assert.equal(run('comActors.length'),9);assert.equal(run('comActors.filter(a=>a.name.startsWith("訓練COM")).length'),0);assert.equal(run('comActors.filter(a=>a.name==="カンカン").length'),1);
console.log('PASS: Kankan fist D+, practice gauntlet, real adaptive fist crafting, no off-type equipment/ammunition/reload, guard and mastery, all portraits and ten-person roster');
