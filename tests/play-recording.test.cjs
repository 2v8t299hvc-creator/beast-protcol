// Combat economy, recovery preparation and closure-safe COM movement regressions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(storage=new Map(),broken=false){
 const downloads=[],urls=[];
 const elements=new Map(),timers=[];
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''},click(){downloads.push({href:this.href,name:this.download})},remove(){}}}
 const document={body:{appendChild(){}},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Blob,URL:{createObjectURL(blob){urls.push(blob);return "blob:test"},revokeObjectURL(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(broken)throw Error("quota");storage.set(k,v)}},Image:class {},Date:class extends Date{static now(){return 1000000}},getComputedStyle:()=>({backgroundImage:''}),timers,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext('Math.random=()=>.5',context);
 vm.runInContext(source,context);vm.runInContext('startSelectedCharacter()',context);
 const run=s=>vm.runInContext(s,context);
 run(`matchClock.section=1;matchClock.sectionEndsAt=9000000;matchClock.blocked=[];matchClock.nextBlocked=[];
 S.place='山岳区画';S.bag=[];syncInventory();S.equipment={};S.equipmentAmmo={};S.equipmentEffects={};S.hp=100000;S.st=100;
 var target=comActors[0];target.place=S.place;target.hp=100000;target.equipment={};target.equipmentEffects={};
 var d=drones.bird;Object.assign(d,{spawned:true,hp:100000,area:S.place,generation:1});`);
 run.storage=storage;run.downloads=downloads;run.urls=urls;run.timers=timers;return run;
}

(async()=>{
 const run=harness(),plain=s=>JSON.parse(run(`JSON.stringify(${s})`));
 assert.equal(run('playJournal.events[0].kind'),'match-start');
 assert(run('playRecords.length===1'));assert(run('playJournal.comCheckpoints[0].analysisOnly'));
 run(`for(const d of Object.values(drones))d.spawned=false;matchClock.competitive=false;S.hp=180;S.st=100;S.bag=[];syncInventory();receive('cloth',1);receive('boots',1);setCraftTarget('fur_hat')`);
 let actions=plain(`playJournal.events.filter(e=>e.kind==='action')`);assert.equal(actions.at(-1).data.action,'setCraftTarget');
 run(`move('港湾区画')`);let move=plain(`playJournal.events.filter(e=>e.kind==='action'&&e.data.action==='move').at(-1)`);
 assert.equal(run(`playJournal.states[${move.before}].place`),'山岳区画');assert.equal(run(`playJournal.states[${move.after}].place`),'港湾区画');assert.equal(move.data.args[0],'港湾区画');
 assert.equal(run(`playJournal.states[${move.before}].bag.find(x=>x.id==='cloth').count`),1);
 run(`S.bag.find(x=>x.id==='cloth').count=9;syncInventory()`);assert.equal(run(`playJournal.states[${move.before}].bag.find(x=>x.id==='cloth').count`),1);
 run(`equip('boots')`);assert.equal(run(`playJournal.events.filter(e=>e.kind==='action').at(-1).data.action`),'equip');
 let n=run('playJournal.events.length');run(`equip('nonexistent')`);assert.equal(run('playJournal.events.length'),n);
 run(`receive('ration',2);S.hp=50;useItem('ration')`);assert.equal(run(`playJournal.events.filter(e=>e.kind==='action').at(-1).data.action`),'useItem');
 run(`S.enemy=false;S.pendingFound=null;S.discoveryQueue=[];primary()`);assert(run('S.busy'));assert.equal(run(`playJournal.events.filter(e=>e.kind==='action').at(-1).data.action`),'primary');
 run(`Date.now=()=>1001000`);const callback=run.timers.filter(t=>t.ms===1000).at(-1);assert(callback);callback.fn();assert(!run('S.busy'));assert(run(`playJournal.events.some(e=>e.kind==='state-observed'&&e.ms===1000)`));
 // Visible choices survive both the decision and the world object's later mutation.
 run(`S.enemy=false;S.pendingFound=null;S.discoveryQueue=[];var obj={id:'stone',count:1,uid:'test-choice',area:S.place};addFound(obj);decideDiscoveredItem(discoveryChoiceToken(obj),false)`);
 const choice=plain(`playJournal.events.filter(e=>e.kind==='action'&&e.data.action==='decideDiscoveredItem').at(-1)`);assert.equal(run(`playJournal.states[${choice.before}].discoveries[0].id`),'stone');assert.equal(choice.data.args[1],false);
 run(`for(let i=0;i<250;i++)recordMatchEvent(S,'test','event '+i);flushPlayRecords()`);assert.equal(run('S.matchEvents.length'),200);assert(run('playJournal.events.length>250'));
 const persisted=JSON.parse(run.storage.get('beast-protocol-play-records-v1'));assert.equal(persisted[0].events.length,run('playJournal.events.length'));
 // COM checkpoints are throttled and cannot leak into the player's own state.
 const old=run('playJournal.comCheckpoints.length');run(`samplePlayCom(1029999)`);assert.equal(run('playJournal.comCheckpoints.length'),old);run(`samplePlayCom(1030000)`);assert.equal(run('playJournal.comCheckpoints.length'),old+1);assert(!('comActors' in plain('playPlayerState()')));
 run(`matchClock.result='win';matchClock.winnerId=S.id;matchClock.ended=true;sealMatchRecord(1040000)`);assert.equal(run('playJournal.status'),'finished');assert.equal(run('playJournal.events.at(-1).kind'),'match-end');n=run('playJournal.events.length');run(`recordMatchEvent(S,'test','after finish')`);assert.equal(run('playJournal.events.length'),n);
 run(`exportPlayRecord(0)`);assert.equal(run.downloads.length,1);assert(run.downloads[0].name.endsWith('.json'));const exported=JSON.parse(await run.urls[0].text());const summary=require('../tools/analyze-play-record.cjs').analyze(exported);assert.equal(summary.character,'kaito');assert(summary.actionCounts.move>=1);assert.equal(summary.elapsedSeconds,40);assert(summary.comparisons.length===0);assert.equal(exported.schemaVersion,1);assert.equal(exported.rules.recoveryCooldownMs,5000);assert(exported.dictionary.recipes.length>100);assert.equal(exported.events.length,n);
 // Starting again retains bounded previous records; inaccessible storage never interrupts play.
 run(`beginPlayRecord(1050000);beginPlayRecord(1060000);beginPlayRecord(1070000);flushPlayRecords()`);assert.equal(run('playRecords.length'),3);
 const restored=harness(run.storage);assert.equal(restored('playRecords.length'),3);assert(restored('playRecords.some(r=>r.startedAt===1060000)'));
 const blocked=harness(new Map(),true);blocked(`move('港湾区画');flushPlayRecords();showPlayRecords()`);assert.equal(blocked('playRecordStorageError'),true);assert.equal(blocked('S.place'),'港湾区画');assert(blocked(`document.getElementById('modalBody').innerHTML.includes('自動保存ができていません')`));assert(blocked(`document.getElementById('back').classList.contains('bp-play-records')`));blocked(`Object.defineProperty(globalThis,'localStorage',{get(){throw Error('SecurityError')},configurable:true})`);assert.equal(blocked('flushPlayRecords()'),false);
 console.log('PASS: player before/after actions and async search outcomes; visible choices and immutable snapshots; full history beyond 200; throttled separate COM checkpoints; automatic persistence, bounded archives, quota failure, finalization and real JSON export.');
})().catch(e=>{console.error(e);process.exitCode=1});
