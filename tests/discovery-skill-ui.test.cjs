const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(){
 let now=1000000;const timers=[],elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},setAttribute(k,v){this[k]=v},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return now}},getComputedStyle:()=>({backgroundImage:''}),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},console});
 vm.runInContext("globalThis.seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}",context);
 vm.runInContext(source,context);

 return {fireTimeout(ms){const i=timers.findIndex(t=>t.ms===ms);assert(i>=0);timers.splice(i,1)[0].fn()},run:code=>vm.runInContext(code,context),setNow:x=>{now=x},advance(ms){now+=ms;vm.runInContext('tickMatchClock()',context)},tickAction(){const i=timers.findIndex(t=>t.ms===1000);assert(i>=0);timers.splice(i,1)[0].fn()}};
}






let h,run;function fresh(){h=harness();run=h.run;run("selectPracticeWeapon('practice_gauntlet');move('山岳区画');matchClock.section=1;matchClock.competitive=false;matchClock.sectionEndsAt=3000000;matchClock.nextBlocked=[];matchClock.blocked=[];for(const c of comActors)c.nextActionAt=3000000;S.bag=[];syncInventory(S);Math.random=()=>0;attackRoll=()=>0;rollCritical=()=>false;rollBodyInjury=()=>false;var objects=['stone','wood','mystery'].map(id=>regionObjects[S.place].find(x=>x.id===id&&!x.taken));");}const eq=(s,v)=>assert.equal(run(s),v,s);function handlers(){return [...run("$('modalBody').innerHTML").matchAll(/onclick="(decideDiscoveredItem\(\d+,true\))"/g)].map(m=>m[1])}
// Render all3 physical objects in one row and click the actual third-card handler first.
fresh();run('presentSearchBatch(objects)');eq("($('modalBody').innerHTML.match(/class=\"bp-discovery-card\"/g)||[]).length",3);assert(run("$('modalBody').innerHTML.includes('--discovery-count:3')"));const choices=handlers();assert.equal(choices.length,3);run(choices[2]);eq('S.inventory.mystery',1);eq('S.pendingFound.uid',run('objects[0].uid'));eq('S.discoveryQueue[0].uid',run('objects[1].uid'));eq("($('modalBody').innerHTML.match(/class=\"bp-discovery-card\"/g)||[]).length",2);run(choices[2]);eq('S.inventory.mystery',1);eq('S.discoveryQueue.length',1);run(choices[1]);eq('S.inventory.wood',1);eq('S.pendingFound.uid',run('objects[0].uid'));run(choices[0]);eq('S.inventory.stone',1);eq('S.pendingFound',null);eq('S.discoveryQueue.length',0);eq("$('back').classList.contains('on')",false);eq('objects.every(x=>x.taken)',true);eq('S.st',120);eq('S.ticks',0);
// A pickup can fill the last slot: remaining cards stay visible and offer keep, never silently vanish.
fresh();run("S.bag=Array.from({length:5},()=>({id:'cloth',count:10}));syncInventory(S);presentSearchBatch(objects)");const limited=handlers();run(limited[2]);eq('S.bag.length',6);eq('S.discoveryQueue.length',1);eq("($('modalBody').innerHTML.match(/ disabled/g)||[]).length",2);run(limited[0]);eq('S.pendingFound.uid',run('objects[0].uid'));eq('objects[0].taken',false);eq('S.inventory.stone||0',0);run('decideDiscoveredItem(discoveryChoiceToken(objects[1]),false)');eq('S.found.includes(objects[1])',true);eq('S.pendingFound.uid',run('objects[0].uid'));run('closeModal()');eq('S.pendingFound',null);eq('S.discoveryQueue.length',0);eq('S.found.includes(objects[0])',true);eq('objects[0].taken',false);
// Closing a3-card discovery keeps all remaining objects, and displayed choices reserve the real stock.
fresh();run('presentSearchBatch(objects);for(let i=0;i<100;i++)if(objects.includes(drawRegionItem(S.place)))throw Error("reserved discovery drawn");closeModal()');eq('S.pendingFound',null);eq('S.discoveryQueue.length',0);eq('objects.every(x=>S.found.includes(x)&&!x.taken)',true);eq('new Set(S.found.map(x=>x.uid)).size',3);
fresh();run('addFound(objects[0])');assert(run("$('modalBody').innerHTML.includes('bp-discovery-keep')"));run('decideFound(true)');eq('S.inventory.stone',1);
// Semantic hidden must beat the skill icon's author-level display:grid; ten-character switching clears labels.
assert.match(html,/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
fresh();for(const character of ['kaito','hayate','snow_leopard','bjorn','flugel','jerk','bat','zakuro','kankan','raku','kaito']){
 run(`S.character=${JSON.stringify(character)};renderCharacterSkills(1000000)`);eq("$('characterFieldBtn').hidden",!run('!!CHARACTER_SKILLS[S.character].field'));eq("$('characterSkillBtn').hidden",!run('!!CHARACTER_SKILLS[S.character].active'));eq("$('characterPassive').hidden",!run('!!CHARACTER_SKILLS[S.character].passive'));if(!run('!!CHARACTER_SKILLS[S.character].field')){eq("$('characterFieldBtn').textContent",'');eq("$('characterFieldBtn').disabled",true)}
}
// Every supported active gets a clear, independent enemy callout, without interrupting discovery or pending actions.
for(const [character,name] of [['kaito','カイト'],['hayate','ハヤテ'],['snow_leopard','ヒョウガ'],['bjorn','ビヨルン'],['flugel','フリューゲル'],['jerk','ジャーク'],['bat','ノクス'],['zakuro','ザクロ']]){
 fresh();run(`matchClock.competitive=true;S.hp=10000;presentSearchBatch(objects);S.busy=true;var token=S.actionToken;var a=comActors[3];a.character=${JSON.stringify(character)};a.name=${JSON.stringify(name)};a.place=S.place;a.hp=180;a.equipment={weapon:'practice_bow'};a.equipmentAmmo.weapon=20;var skill=CHARACTER_SKILLS[a.character].active;var result=playerCombatRound(a,S,1000000,true,skill.id)`);eq('incomingSkillNotices.length',1);eq('incomingSkillNotices[0].text',run('a.name+"の"+skill.name+"！"'));assert(run("$('skillFeed').innerHTML.includes(a.name+'の'+skill.name+'！')"));eq('S.pendingFound.uid',run('objects[0].uid'));eq('S.discoveryQueue.length',2);eq('S.actionToken',run('token'));eq('S.busy',true);assert(run("$('log').children.some(x=>x.textContent.includes(a.name+'の'+skill.name+'！'))"));h.fireTimeout(3200);eq('incomingSkillNotices.length',0);
}
// Normal and unrelated fights do not announce actives. Catch-up events remain in the log without stale popups.
fresh();run("matchClock.competitive=true;S.hp=10000;var a=comActors[3];a.place=S.place;playerCombatRound(a,S,1000000,true)");eq('incomingSkillNotices.length',0);
fresh();run("matchClock.competitive=true;S.hp=10000;var a=comActors[3];a.place=S.place;playerCombatRound(a,S,997000,true,'une_deux')");eq('incomingSkillNotices.length',0);
fresh();run("matchClock.competitive=true;var a=comActors[3],b=comActors[1];a.place=b.place=S.place;b.hp=10000;playerCombatRound(a,b,1000000,false,'une_deux')");eq('incomingSkillNotices.length',0);
fresh();run("matchClock.competitive=true;S.hp=10000;var a=comActors[3];a.place=S.place;playerCombatRound(a,S,1000000,true,'une_deux');showIncomingDamage(a,{dealt:7},1000000)");eq('incomingSkillNotices.length',1);assert(run("$('skillFeed').innerHTML.includes('フリューゲルのユヌードゥ！')"));
console.log('PASS: simultaneous selectable discovery cards, real out-of-order handlers/stale double-click protection/full-bag reservation/all-keep, CSS hidden/ten-character buttons, eight active callouts/volley once/no interruption/stale suppression and expiry');
