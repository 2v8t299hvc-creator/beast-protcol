// Delayed and failed image events against the real HTML script, including already-open modal markup.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
function harness(){
 const elements=new Map(),images=[],timers=[];
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',scrollTop:0,children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(selector){
  if(selector!=='[data-item-sheet]')return [];
  return [...elements.values()].flatMap(owner=>[...owner.innerHTML.matchAll(/<span class="itemIcon" data-item-id="([^"]+)" data-item-sheet="([^"]+)">[^<]*<\/span>/g)].map(m=>({dataset:{itemId:m[1],itemSheet:m[2]},set outerHTML(value){owner.innerHTML=owner.innerHTML.replace(m[0],value)}})));
 }};
 const context=vm.createContext({document,Image:class {constructor(){images.push(this)}},getComputedStyle:()=>({backgroundImage:''}),setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext(source.replace('function grantStartingSupplies(actor){','function grantStartingSupplies(actor){ return; // Isolate the pre-supply fixture\n'),context);vm.runInContext('comActors.splice(1)',context);vm.runInContext('matchClock.competitive=false',context);
 const run=s=>vm.runInContext(s,context);
 function flushZero(){let n=0;while(true){const i=timers.findIndex(t=>t.ms===0);if(i<0)break;assert(n++<200,'pump must terminate');timers.splice(i,1)[0].fn()}}
 function tick(ms){const i=timers.findIndex(t=>t.ms===ms);assert(i>=0,'scheduled timer '+ms);timers.splice(i,1)[0].fn();flushZero()}
 return {run,images,flushZero,tick,loaded(url){const img=images.find(x=>x.src===url&&x.onload);assert(img,'pending '+url);img.onload();flushZero()},failed(url){const img=images.find(x=>x.src===url&&x.onerror);assert(img,'pending '+url);img.onerror();flushZero()}};
}
let h=harness(),run=s=>h.run(s);const eq=(s,v)=>assert.equal(run(s),v,s);
// Startup requests only icons being displayed, rather than downloading every 34 MB atlas immediately.
eq('Object.keys(itemSheetStates).length',3);eq('Object.keys(readySheets).length',0);
run('showCraft("weapon","bow");$("modalBody").scrollTop=137;globalThis.cached=$("modalBody").innerHTML');
assert(run('cached.includes(\'data-item-sheet="bows_1"\')'));h.flushZero();assert(run('activeItemSheetLoads<=4'));
h.loaded('assets/icon_bows_1.webp');
eq('$("modalBody").innerHTML.includes(\'data-item-sheet="bows_1"\')',false);
eq('$("modalBody").innerHTML.includes("background-image:url(assets/icon_bows_1.webp)")',true);
eq('$("modalBody").scrollTop',137);eq('$("modalTitle").textContent','🔧 製作');
// Restoring a modal cached before load must hydrate too, without requiring another image event.
run('modal("復元",cached)');eq('$("modalBody").innerHTML.includes(\'data-item-sheet="bows_1"\')',false);
// Other contexts update in place as well: discovery, stock, equipment and corpse menus share the same hook.
for(const title of ['発見','ストック','装備','死体']){run(`modal('${title}',itemIconHTML('japanese_bow'))`);eq('$("modalBody").innerHTML.includes("bp-item-art")',true)}
// Repeated render calls cannot duplicate requests. Real failures retry, and successful retry URLs reach CSS.
h=harness();run=s=>h.run(s);h.flushZero();run('for(let i=0;i<20;i++)itemIconHTML("ration")');h.flushZero();eq('itemSheetStates.gear.attempts',1);
run('modal("装備",itemIconHTML("ration"))');h.failed('assets/icon_gear.png');eq('itemSheetStates.gear.status','retry');h.tick(1000);eq('itemSheetStates.gear.attempts',2);
h.loaded('assets/icon_gear.png?artRetry=2');eq('readySheets.gear',true);eq('$("modalBody").innerHTML.includes("assets/icon_gear.png?artRetry=2")',true);eq('$("modalBody").innerHTML.includes("data-item-sheet")',false);
// Retry limits and resume recovery prevent a one-time offline event becoming a permanent emoji state.
h=harness();run=s=>h.run(s);h.flushZero();h.failed('assets/icon_gear.png');h.tick(1000);h.failed('assets/icon_gear.png?artRetry=2');h.tick(2000);h.failed('assets/icon_gear.png?artRetry=3');eq('itemSheetStates.gear.status','failed');eq('activeItemSheetLoads>=0',true);run('retryFailedItemArt()');h.flushZero();eq('itemSheetStates.gear.attempts',1);h.loaded('assets/icon_gear.png');eq('readySheets.gear',true);
// Every configured image exists and retains correct atlas quadrant coordinates.
run('readySheets.bows_1=true');assert(run('itemIconHTML("azusa_bow").includes("background-position:100% 100%")'));
for(const asset of run('Object.values(itemArtSheets)'))assert(fs.existsSync(path.join(__dirname,'..',asset)),asset);
eq('Object.values(itemArt).every(([sheet])=>!!itemArtSheets[sheet])',true);eq('itemIconHTML("unregistered").includes("data-item-sheet")',false);
console.log('PASS: delayed modal art hydration, cached-menu restoration, preserved scroll, lazy limited loading, deduplication, bounded retries, resumed loading, retry CSS URLs and complete atlas paths');
