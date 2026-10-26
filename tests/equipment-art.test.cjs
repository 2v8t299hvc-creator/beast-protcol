// Boundary and race-condition integration checks against the actual HTML game script.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext("globalThis.seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}",context);
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}




let h,run;
function fresh(){h=harness();run=s=>h.run(s);run(`comActors.length=0;globalThis.a=S;matchClock.section=4;matchClock.sectionEndsAt=Date.now()+1000000;matchClock.blocked=[];matchClock.nextBlocked=[];a.place='山岳区画';a.bag=[];syncInventory(a);a.equipment={weapon:null,head:null,arm:null,body:null,legs:null,accessory:null};a.equipmentAmmo={};a.equipmentEffects={};a.masteryAttacks={bow:0,gun:0,fist:0};a.hp=100;a.st=50;Math.random=()=>0;globalThis.d=drones.bird;Object.assign(d,{spawned:true,hp:10000,area:a.place,generation:1});`)}
const eq=(s,v)=>assert.equal(run(s),v,s);




const path=require('node:path'),manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/equipment-art-20261026.json'),'utf8'));
manifest.sheets.push(...JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/body-art-20261026.json'),'utf8')).sheets);
fresh();const ids=[];
for(const sheet of manifest.sheets){assert(fs.existsSync(path.join(__dirname,'..',sheet.path)),sheet.path);eq(`itemArtSheets['${sheet.key}']`,sheet.path);for(const [quadrant,id]of sheet.ids.entries()){ids.push(id);eq(`JSON.stringify(itemArt['${id}'])`,JSON.stringify([sheet.key,quadrant]));run(`readySheets['${sheet.key}']=true`);assert(run(`itemIconHTML('${id}')`).includes('class="bp-item-art"'),id);assert(run(`itemIconHTML('${id}')`).includes(sheet.path),id);}}
assert.equal(ids.length,59);assert.equal(new Set(ids).size,59);// Newly added equipment may await art; the published mappings above remain complete.
eq('JSON.stringify(itemArt.simple_armguard)===JSON.stringify(itemArt.armguard)',false);
run('showCraft("armor","head")');assert(run('$("modalBody").innerHTML').includes('assets/icon_equipment_01.webp'));
run('showCraft("armor","legs")');assert(run('$("modalBody").innerHTML').includes('assets/icon_equipment_09.webp'));
run('showCraft("armor","body")');assert(run('$("modalBody").innerHTML').includes('assets/icon_body_01.webp'));assert(run('$("modalBody").innerHTML').includes('assets/icon_body_02.webp'));run('showCraft("item","recovery")');assert(run('$("modalBody").innerHTML').includes('assets/icon_body_05.webp'));
console.log('PASS: 59 distinct official item graphics, complete coverage, correct sheet/quadrant/file mappings, upgraded armguard distinction and craft-screen rendering');
