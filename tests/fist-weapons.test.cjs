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



const config=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../FIST_WEAPONS_20261027.json'),'utf8'));
let h,run;const eq=(code,value)=>assert.equal(run(code),value,code);
function fresh(){h=harness();run=h.run;run(`matchClock.section=1;S.bag=[];S.equipment={};S.equipmentEffects={};syncInventory();comActors[0].place=S.place;comActors[0].nextActionAt=3000000;Math.random=()=>0;`)}
for(const item of config.items){
 fresh();eq(`names['${item.id}']`,item.name);eq(`RECIPE_RARITY['${item.id}']`,item.rarity);
 if(item.attack!==undefined){eq(`equipmentDef('${item.id}').weaponType`,'fist');eq(`equipmentDef('${item.id}').attack`,item.attack);eq(`stackLimit('${item.id}')`,1)}
 if(!item.need)continue;
 assert.deepEqual(JSON.parse(run(`JSON.stringify(recipes.find(r=>r.id==='${item.id}').need)`)),item.need);
 for(const [id,n] of Object.entries(item.need))run(`receive('${id}',${n})`);
 eq(`craftActor(S,recipes.find(r=>r.id==='${item.id}'))`,true);eq(`S.inventory['${item.id}']`,1);
 for(const id of Object.keys(item.need))eq(`S.inventory['${id}']||0`,0);
}
// Wearable ingredients and the two-branch finale consume exactly one of each input.
fresh();run("receive('iron_knuckle',1);equip('iron_knuckle');receive('sea_god_amulet',1);equip('sea_god_amulet')");eq("canCraft(recipes.find(r=>r.id==='poseidon_knuckle'))",true);run("craft('poseidon_knuckle','weapon')");eq('S.equipment.weapon',null);eq('S.equipment.accessory',null);eq('S.inventory.poseidon_knuckle',1);
fresh();run("receive('reinforced_wraps',1);equip('reinforced_wraps');receive('leather_wraps',1);craft('beast_fang','weapon')");eq('S.inventory.beast_fang',1);eq('S.equipment.weapon',null);
// Failed crafting is atomic with a full bag if no input stack is freed.
fresh();run("S.bag=[{id:'bandage',count:3},{id:'stone',count:10},{id:'wood',count:10},{id:'water',count:10},{id:'scrap',count:10},{id:'fur',count:10}];S.equipment.weapon='ragglove';syncInventory();var before=JSON.stringify({bag:S.bag,equipment:S.equipment});var made=craftActor(S,recipes.find(r=>r.id==='fighting_wraps'))");eq('made',false);eq('JSON.stringify({bag:S.bag,equipment:S.equipment})',run('before'));
// Bandages restore HP with the shared HP cooldown; set counts apply to drops and supplies.
fresh();run("S.hp=100;receive('bandage',3);receive('ration',1)");eq('itemSetCount("bandage")',3);eq('supplySetCount("bandage")',3);eq('recoverActor(S,"bandage")',true);eq('S.hp',125);eq('S.inventory.bandage',2);eq('recoverActor(S,"ration")',false);h.setNow(1003000);eq('recoverActor(S,"ration")',true);
fresh();run("receive('sea_god_amulet',1);equip('sea_god_amulet')");eq("totalStat('defense')",20);
// Wild Hunt modifies the corpse, once, only for an equipped weapon owned by the actual killer.
fresh();run("S.equipment.weapon='beast_fang';S.bag=Array.from({length:6},()=>({id:'stone',count:10}));var body=createDroneCorpse('bird',S.place,Date.now(),S.id)");eq("body.items.filter(x=>x.source==='ワイルドハント').map(x=>x.id).join(',')",'fur,feather');eq("body.items.filter(x=>x.source==='ワイルドハント').every(x=>x.count===1)",true);eq('S.bag.length',6);
for(const n of [10,11,12]){fresh();run(`S.equipment.weapon='beast_fang';var body=createCorpse('player','victim',S.place,Array.from({length:${n}},()=>({id:'stone',count:1})),Date.now(),{killerId:S.id})`);eq('body.items.length',12);eq("body.items.filter(x=>x.source==='ワイルドハント').map(x=>x.id).join(',')",n===10?'fur,feather':n===11?'fur':'')}
fresh();run("receive('beast_fang',1);var body=createDroneCorpse('bird',S.place,Date.now(),S.id)");eq("body.items.some(x=>x.source==='ワイルドハント')",false);
fresh();run("S.equipment.weapon='beast_fang';var body=createDroneCorpse('bird',S.place,Date.now(),comActors[0].id)");eq("body.items.some(x=>x.source==='ワイルドハント')",false);
fresh();run("var killer=comActors[0];killer.equipment.weapon='beast_fang';var body=createDroneCorpse('bird',S.place,Date.now(),killer.id)");eq("body.items.filter(x=>x.source==='ワイルドハント').length",2);
// Actual lethal player-vs-COM strike carries killer attribution and cannot duplicate corpse rewards.
fresh();run("matchClock.competitive=true;S.equipment.weapon='beast_fang';var victim=comActors[0];victim.hp=1;var result=playerCombatRound(S,victim,Date.now());var body=result.corpse");eq("body.items.filter(x=>x.source==='ワイルドハント').length",2);eq('createPlayerCorpse(victim,S.place,Date.now(),S.id).id',run('body.id'));eq("body.items.filter(x=>x.source==='ワイルドハント').length",2);
// Actual drone death creates the fixed rewards; carrying the fang in the bag does not.
fresh();run("S.equipment.weapon='beast_fang';Object.assign(drones.bird,{spawned:true,hp:1,area:S.place,generation:7});var result=strikeDrone(S,drones.bird,Date.now());var body=result.body");eq('result.defeated',true);eq("body.items.filter(x=>x.source==='ワイルドハント').length",2);
// Each new item has a unique atlas cell that resolves through the normal lazy loader.
fresh();for(const item of config.items){const art=JSON.parse(run(`JSON.stringify(itemArt['${item.id}'])`));assert.ok(art&&art[0].startsWith('fist_'));run(`readySheets['${art[0]}']=true`);assert.ok(run(`itemIconHTML('${item.id}')`).includes('bp-item-art'));assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',run(`itemArtSheets['${art[0]}']`))))}
// Existing boots bonus is independent and takes priority over the capped fixed rewards.
fresh();run("S.equipment={weapon:'beast_fang',legs:'primal_boots'};var body=createCorpse('player','v',S.place,Array.from({length:11},()=>({id:'stone',count:1})),Date.now(),{killerId:S.id})");eq('body.items.length',12);eq("body.items.filter(x=>x.source==='野生の本能').length",1);eq("body.items.filter(x=>x.source==='ワイルドハント').length",0);
for(const [area,stock] of Object.entries(config.placements)){fresh();for(const [id,count]of Object.entries(stock)){eq(`regionObjects['${area}'].filter(x=>x.id==='${id}').length`,count);eq(`regionObjects['${area}'].filter(x=>x.id==='${id}').every(x=>x.count===itemSetCount(x.id))`,true)}}
console.log('PASS: 11 fist/recovery/accessory items, exact routes/stats, worn-input crafting and atomic failure, HP cooldown/sets, killer-only Wild Hunt, 10/11/12 corpse slots, COM, actual lethal attack, repeat suppression and boots coexistence');
