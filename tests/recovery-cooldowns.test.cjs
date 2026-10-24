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
function active(){h=harness();h.advance(30000);run('S.hp=20;S.st=20;S.bag=[];syncInventory()')}
// Every supported recovery applies its configured amount, consumes one, and closes the menu with items remaining.
for(const id of ['egg','beast_meat','premium_ration','energy_drink','ration','kit','seaweed','seaweed_soup','fried_swordfish','swordfish_sashimi','minefish_sashimi','paradise_sashimi','paradise_platter','paradise_broth','drink','water']){
 active();run(`receive('${id}',3);showItem('${id}');useItem('${id}')`);eq(`S.inventory['${id}']`,2);eq(`$('back').classList.contains('on')`,false);eq(`recoveryWait(RECOVERY_ITEMS['${id}'].group)`,3000);eq(`RECOVERY_ITEMS['${id}'].group==='hp'?S.hp:S.st`,run(`20+RECOVERY_ITEMS['${id}'].amount`));
}
// HP items share one cooldown, stamina items another; alternating categories is permitted.
active();run(`receive('ration',3);receive('kit',3);receive('drink',3);receive('water',3);showBag();useItem('ration');useItem('kit')`);eq('S.hp',40);eq('S.inventory.kit',3);
run(`useItem('drink');useItem('water')`);eq('S.st',40);eq('S.inventory.drink',2);eq('S.inventory.water',3);
h.advance(2999);run(`useItem('kit');useItem('water')`);eq('S.inventory.kit',3);eq('S.inventory.water',3);
h.advance(1);run(`showBag();useItem('kit')`);eq('S.hp',100);eq('S.inventory.kit',2);eq(`$('back').classList.contains('on')`,false);run(`useItem('water')`);eq('S.st',50);
// Staggered category clocks remain independent.
active();run(`receive('ration',3);receive('drink',3);useItem('ration')`);h.advance(1000);run(`useItem('drink')`);h.advance(2000);run(`useItem('ration');useItem('drink')`);eq('S.inventory.ration',1);eq('S.inventory.drink',2);h.advance(1000);run(`useItem('drink')`);eq('S.inventory.drink',1);
// Failed use at full HP/stamina or without inventory must neither consume nor start a cooldown.
active();run(`S.hp=maxHp();S.st=maxSt();receive('ration',2);receive('drink',2);useItem('ration');useItem('drink');useItem('kit')`);eq('S.inventory.ration',2);eq('S.inventory.drink',2);eq(`recoveryWait('hp')`,0);eq(`recoveryWait('stamina')`,0);
// Recovery from corpse inventory management also returns to the main screen and relinquishes the visit.
active();run(`receive('ration',2);var body=createDroneCorpse('bird',S.place);openCorpse(body.id);showBag();useItem('ration')`);eq('S.corpseVisit',null);eq(`$('back').classList.contains('on')`,false);eq('S.inventory.ration',1);
// Buttons report and clear cooldowns automatically without reopening the menu.
active();run(`receive('ration',2);useItem('ration');var button={dataset:{recoveryGroup:'hp',useLabel:'使用する'}};document.querySelectorAll=()=>[button];renderRecoveryCooldowns()`);eq('button.disabled',true);eq('button.textContent','あと 3.0秒');h.advance(3000);eq('button.disabled',false);eq('button.textContent','使用する');
// Reloading ammunition remains independent of recovery cooldowns.
active();run(`receive('handgun',1,{ammo:0});equip('handgun');receive('bullets',20);useItem('bullets')`);eq('weaponAmmo()',20);eq(`recoveryWait('hp')`,0);eq(`recoveryWait('stamina')`,0);
console.log('PASS: recovery amounts, independent shared-category cooldowns, exact three-second boundary, failed-use atomicity, successful menu closure and button countdown');

// Explicit design values and dedicated art assignments.
for(const [id,amount] of Object.entries({egg:10,beast_meat:30,premium_ration:80,energy_drink:50,ration:20,drink:20}))eq(`RECOVERY_ITEMS['${id}'].amount`,amount);
for(const id of ['egg','fish_scale','beast_meat','premium_ration','energy_drink']){run(`readySheets[itemArt['${id}'][0]]=true`);assert.match(run(`itemIconHTML('${id}')`),/bp-item-art/);assert(fs.existsSync(require('node:path').join(__dirname,'..',run(`itemArtSheets[itemArt['${id}'][0]]`))))}
