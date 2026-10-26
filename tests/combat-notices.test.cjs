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
 vm.runInContext("selectPracticeWeapon('practice_gauntlet');move('山岳区画');S.equipment.weapon=null;S.starterWeapon=null;S.masteryAttacks={fist:0,slash:0,hammer:0,gun:0,bow:0};closeModal()",context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}


const h=harness(),run=h.run;
run("matchClock.section=2;matchClock.sectionEndsAt=Date.now()+31000;matchClock.nextBlocked=[S.place];renderClosureWarning()");
assert.equal(run("$('closureWarning').hidden"),true);
h.setNow(1001000);run('renderClosureWarning()');
assert.equal(run("$('closureWarning').hidden"),false);
assert.equal(run("$('closureWarning').textContent.includes('30秒')"),true);
run("S.place='森林区画';renderClosureWarning()");assert.equal(run("$('closureWarning').hidden"),true);
run("S.place=matchClock.nextBlocked[0];matchClock.result='eliminated';renderClosureWarning()");assert.equal(run("$('closureWarning').hidden"),true);
run("matchClock.result=null;var a=comActors[0];a.equipment={weapon:'azusa_bow',head:'hat',arm:null,body:'rubber_suit',legs:'boots',accessory:'telescope'};a.place=S.place;S.enemy=true;S.enemyPlayerId=a.id;S.ehp=a.hp;renderCombat()");
assert.equal(run("($('enemyEquipment').innerHTML.match(/bp-enemy-slot/g)||[]).length"),6);
assert.equal(run("$('enemyEquipment').hidden"),false);
assert.equal(run("$('enemyEquipment').innerHTML.includes(names.azusa_bow)"),true);
assert.equal(run("$('enemyEquipment').innerHTML.includes('なし')"),true);
run("showOpponentEquipment('weapon')");assert.equal(run("$('modalBody').innerHTML.includes(names.azusa_bow)"),true);
run("S.enemyPlayerId=null;S.enemyKind='bird';renderCombat()");assert.equal(run("$('enemyEquipment').hidden"),true);
run("eliminateCom(a,'戦闘',Date.now(),S.id)");assert.equal(run('deathNotices.length'),1);
assert.equal(run("deathNotices[0].message"),'ハヤテがカイトに殺された！');
run("eliminateCom(a,'戦闘',Date.now(),S.id)");assert.equal(run('deathNotices.length'),1);
run("announceComDeath({name:'区域のCOM'},'区域封鎖',Date.now(),null)");assert.equal(run("deathNotices.at(-1).message.includes('区域封鎖')"),true);
run("announceComDeath({name:'別COM'},'反撃',Date.now(),'drone-bird-1')");assert.equal(run("deathNotices.at(-1).message.includes('鳥型ドローンに殺された')"),true);
run("announceComDeath({name:'過去COM'},'戦闘',Date.now()-3000,S.id)");assert.equal(run('deathNotices.length'),3);
run("showIncomingDamage(S,{dealt:7});announceComDeath({name:'追加COM'},'戦闘',Date.now(),S.id)");
assert.equal(run("$('incomingNotice').classList.contains('show')"),true);assert.equal(run('deathNotices.length'),3);
assert.equal(run("$('deathFeed').innerHTML.includes('追加COM')"),true);
console.log('PASS: 30-second current-area warning and clearing, six equipment slots/details/drone hiding, killer/reason notices, duplicate/stale suppression and independent damage/death feeds');
