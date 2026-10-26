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
 vm.runInContext(source,context);

 return {run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}





const config=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../REGION_STOCK_20261026.json'),'utf8'));
const h=harness(),run=h.run;
assert.equal(run('Object.keys(regionStock).length'),18);
assert.equal(run('Object.values(regionObjects).flat().length'),813);
assert.equal(run("Object.values(regionObjects).flat().filter(x=>x.id==='laurel').length"),3);
assert.equal(run("Object.values(regionStock).every(stock=>Object.entries(stock).filter(([id])=>id!=='laurel').reduce((n,[,count])=>n+count,0)===45)"),true);
assert.equal(run("new Set(Object.values(regionObjects).flat().map(x=>x.uid)).size"),813);
assert.equal(run("Object.values(regionObjects).flat().every(x=>names[x.id]&&x.count===itemSetCount(x.id))"),true);
for(const [id,count] of Object.entries({cloth:30,thread:12,core:4,scissors:16,lighter:16}))assert.equal(run(`Object.values(regionStock).reduce((n,s)=>n+(s['${id}']||0),0)`),count);
assert.equal(run("!!regionStock['医療区画'].herb&&!!regionStock['医療区画'].small_flower&&!!regionStock['医療区画'].water"),true);
assert.equal(run("!regionStock['森林区画'].small_flower&&regionStock['密林区画'].beast_meat>regionStock['森林区画'].beast_meat"),true);
assert.equal(run("Object.values(regionObjects).flat().filter(x=>['water','lighter','energy_fruit'].includes(x.id)).every(x=>x.count===3)"),true);
run(`var reachable=new Set(Object.values(regionStock).flatMap(stock=>Object.keys(stock)));for(const d of Object.values(DRONE_DEFS))for(const id of d.drops)reachable.add(id);for(const table of Object.values(RANDOM_SUPPLY_TABLES))for(const list of Object.values(table))if(Array.isArray(list))for(const id of list)reachable.add(id);for(const id of GENERATED_MINERALS)reachable.add(id);var changed=true;while(changed){changed=false;for(const r of recipes)if(!reachable.has(r.id)&&Object.keys(r.need).every(id=>reachable.has(id))){reachable.add(r.id);changed=true}};var missing=recipes.filter(r=>!reachable.has(r.id)).map(r=>r.id)`);
assert.deepEqual(JSON.parse(run('JSON.stringify(missing)')),[]);assert.equal(run("reachable.has('stargazing_telescope')"),true);
console.log('PASS: 18x45 base objects + 3 random laurels, all recipe routes reachable, unique physical IDs, stack sets, cloth/thread/core and recovery role distribution');
