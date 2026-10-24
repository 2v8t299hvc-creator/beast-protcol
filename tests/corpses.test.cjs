// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source,context);
 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}

let h=harness();let run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
function active(){h=harness();h.advance(30000);run(`matchClock.sectionEndsAt=Date.now()+10000000;matchClock.nextBlocked=[];S.bag=[];syncInventory();Math.random=()=>0.99`)}
active();
run(`var victim={name:'敵プレイヤー',hp:100,place:S.place,bag:[{id:'handgun',count:1,ammo:3},{id:'stone',count:10},{id:'wood',count:10},{id:'wire',count:10},{id:'cloth',count:10},{id:'bullets',count:40}],equipment:{weapon:'rifle',head:'stone',arm:'armguard',body:'passion_bikini',legs:'cloth',accessory:'telescope'},equipmentAmmo:{weapon:12}};var body=defeatPlayer(victim);var firstToken=S.corpseVisit.token`);
eq('body.items.length',12);eq('body.expiresAt',null);eq('victim.hp',0);eq('victim.bag.length',0);eq('Object.values(victim.equipment).every(x=>x===null)',true);
eq(`($('modalBody').innerHTML.match(/class="bp-corpse-item"/g)||[]).length`,12);
run('takeCorpseItem(6,firstToken)');eq('S.inventory.rifle',1);eq('S.bag[0].ammo',12);eq('body.items.length',11);eq('S.corpseVisit',null);
run('takeCorpseItem(0,firstToken)');eq('S.inventory.handgun||0',0);eq('defeatPlayer(victim).id===body.id',true);eq('corpses.length',1);
// The second explicit encounter grants a new token; the old button cannot claim another slot.
run('openCorpse(body.id);var nextToken=S.corpseVisit.token;takeCorpseItem(0,firstToken)');eq('body.items.length',11);run('takeCorpseItem(0,nextToken)');eq('S.bag.find(x=>x.id==="handgun").ammo',3);eq('body.items.length',10);
// Whole-stack transfer, no partial removal or phantom acquisition on full inventory.
active();run(`var body=createCorpse('player','所持品',S.place,[{id:'arrows',count:20},{id:'wood',count:10}]);receive('arrows',80);openCorpse(body.id);var token=S.corpseVisit.token;takeCorpseItem(0,token)`);eq('S.inventory.arrows',80);eq('body.items[0].count',20);eq('S.corpseVisit.token===token',true);
run(`showBag();discardStack(0)`);eq('S.corpseVisit.token===token',true);eq(`$('modalBody').innerHTML.includes('死体へ戻る')`,true);run('renderCorpse();takeCorpseItem(0,token)');eq('S.inventory.arrows',20);eq('body.items.length',1);
// An explicit close relinquishes the visit without removing an item; a corpse remains rediscoverable.
run('openCorpse(body.id);var oldToken=S.corpseVisit.token;closeModal();takeCorpseItem(0,oldToken)');eq('body.items.length',1);eq('S.inventory.wood||0',0);
run('Math.random=()=>0;primary()');h.tickAction();eq('S.corpseVisit.id===body.id',true);run('takeCorpseItem(0,S.corpseVisit.token)');eq('S.inventory.wood',10);eq('body.items.length',0);eq('corpses.includes(body)',true);
// Drone corpses expire exactly two minutes after death, even with their screen open.
active();run(`var body=createDroneCorpse('bird',S.place);openCorpse(body.id);var token=S.corpseVisit.token`);h.advance(119999);eq('!!findCorpse(body.id)',true);h.advance(1);eq('findCorpse(body.id)',undefined);eq('S.corpseVisit',null);run('takeCorpseItem(0,token)');eq('S.inventory.feather||0',0);
// Expiry is also checked directly on click, without relying on an interval tick.
active();run(`var body=createDroneCorpse('bird',S.place);openCorpse(body.id);var token=S.corpseVisit.token`);h.setNow(run('body.expiresAt'));run('takeCorpseItem(0,token)');eq('S.inventory.feather||0',0);
// Player corpses survive beyond the drone lifetime, but cannot be accessed from a different region.
active();run(`var body=createCorpse('player','長期保存',S.place,[{id:'stone',count:1}]);var origin=S.place;S.place='森林区画';openCorpse(body.id)`);eq('S.corpseVisit',null);h.advance(180000);eq('!!findCorpse(body.id)',true);run('S.place=origin;openCorpse(body.id)');eq('S.corpseVisit.id===body.id',true);
// Character death transfers the inventory exactly once and prevents taking from the player's own corpse.
active();run(`receive('rifle',1,{ammo:0});equip('rifle');receive('stone',10);eliminatePlayer('テスト脱落');var body=corpses.find(c=>c.id===S.corpseId);var corpseCount=corpses.length;eliminatePlayer('もう一度');openCorpse(body.id)`);eq('corpses.length===corpseCount',true);eq('S.bag.length',0);eq('S.equipment.weapon',null);eq('body.items.find(x=>x.id==="rifle").ammo',0);eq('S.corpseVisit',null);
// A lockdown while inspecting closes the claim and does not award the selected item.
active();run(`var body=createDroneCorpse('bird',S.place);openCorpse(body.id);var token=S.corpseVisit.token;matchClock.nextBlocked=[S.place]`);h.setNow(run('matchClock.sectionEndsAt'));run('takeCorpseItem(0,token)');eq('S.hp',0);eq('S.corpseVisit',null);eq('S.inventory.feather||0',0);
console.log('PASS: twelve slots, player death transfer, ammo metadata, one-stack visit tokens, capacity, inventory return, rediscovery, exact expiry and lockdown cancellation');
