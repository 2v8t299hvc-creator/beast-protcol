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


let h=harness(),run=h.run;
run("matchClock.section=1;matchClock.sectionEndsAt=Date.now()+100000;matchClock.nextBlocked=[];S.hp=10;S.st=1;primary()");
assert.equal(run('S.st'),0);assert.equal(run('S.hp'),8);assert.equal(run('S.busy'),true);
h=harness();run=h.run;run("matchClock.section=1;S.hp=10;S.st=0;pushStock(regionObjects[S.place][0]);takeFound(0)");assert.equal(run('S.hp'),7);assert.equal(run('S.busy'),true);
h=harness();run=h.run;run("matchClock.section=1;S.hp=3;S.st=0;primary()");assert.equal(run('S.hp'),0);assert.equal(run('S.busy'),false);assert.equal(run('matchClock.result'),'eliminated');
h=harness();run=h.run;run("S.hp=20;S.st=2;S.equipment.legs='diamond_boots';paySearchCost(S,Date.now())");assert.equal(run('S.hp'),18);assert.equal(run('S.st'),0);
h=harness();run=h.run;
run("matchClock.section=1;matchClock.nextBlocked=[];var a=comActors[0];a.place='地下機構区画';a.hp=40;a.st=120;a.bag=[];syncInventory(a);a.equipment.weapon='practice_bow';a.equipmentAmmo.weapon=20;stepCom(a,Date.now())");
assert.equal(run("a.history.at(-1).text.includes('回復アイテムを求めて移動')"),true);
assert.equal(run("Object.keys(regionStock[a.place]).some(id=>RECOVERY_ITEMS[id]?.group==='hp')"),true);
run("a.place='住宅区画';a.hp=40;a.st=120;a.enemy=null;a.opponent=null;a.leaveDanger=false;a.searches=0;a.noProgress=0;a.exhausted={};regionObjects[a.place]=[{uid:'recovery-ration',id:'ration',area:a.place,count:1,taken:false}];Math.random=()=>0;stepCom(a,Date.now()+1000)");
assert.equal(run('a.inventory.ration'),1);assert.equal(run("a.history.at(-1).text.includes('探索・取得')"),true);
run('stepCom(a,Date.now()+2000)');assert.equal(run('a.hp'),60);assert.equal(run('a.inventory.ration||0'),0);
run("a.hp=1;a.bag=[];syncInventory(a);stepCom(a,Date.now()+6000)");assert.equal(run('a.hp'),3);assert.equal(run("a.history.at(-1).text.includes('応急治療')"),true);
run("a.hp=50;a.bag=[{id:'cloth',count:2},{id:'cell',count:1}];syncInventory(a);stepCom(a,Date.now()+7000)");assert.equal(run('a.inventory.kit'),1);
run("for(const area of Object.keys(regionStock))a.exhausted[area]=true;a.bag=[];syncInventory(a);a.hp=50;stepCom(a,Date.now()+8000)");assert.equal(run('a.hp'),52);assert.equal(run("a.history.at(-1).text.includes('入手先がない')"),true);
console.log('PASS: ST-first HP fallback for normal/stock searches, lethal stop, equipment cost and COM recovery travel/search/use/craft/emergency/fallback');
