// Combat presentation and button routing against the actual game script.
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
h.advance(30000);
run('discoverDrone()');
eq('S.enemy',true);eq(`$('enemy').classList.contains('on')`,true);eq(`$('game').classList.contains('in-combat')`,true);
eq(`$('mainBtn').textContent`,'⚔ 攻撃');eq(`$('skillBtn').textContent`,'↩ 逃走');eq(`$('skillBtn').disabled`,false);eq(`$('moveBtn').disabled`,true);eq(`$('back').classList.contains('on')`,false);
assert(!html.includes('id="ehp"'),'Enemy exact HP must not appear in markup');
assert(!/HP\s*<span id="ehp"/.test(html));
run('S.ehp=34;refresh()');eq(`$('ebar').style.width`,'40%');
run('var oldPlace=S.place;move("森林区画")');eq('S.place===oldPlace',true);
// Main action attacks once, not another search. Double tap and escape during an attack are ignored.
run('Math.random=()=>0;var beforeTicks=S.ticks;primary()');eq('S.busy',true);eq(`$('mainBtn').disabled`,true);eq(`$('skillBtn').disabled`,true);
run('primary();skill()');eq('S.enemy',true);h.tickAction();eq('S.ticks===beforeTicks',true);eq('S.enemy',false);eq('S.busy',false);eq('droneHp()<85',true);
eq(`$('mainBtn').textContent`,'⌕ 探索');eq(`$('enemy').classList.contains('on')`,false);eq(`$('moveBtn').disabled`,false);
// Escape does not attack, spend ammunition, reset HP or grant XP.
run(`discoverDrone();var savedHp=droneHp();var xpBefore=S.xp;var masteryBefore=S.masteryAttacks.fist;skill()`);
eq('S.enemy',false);eq('droneHp()===savedHp',true);eq('S.xp===xpBefore',true);eq('S.masteryAttacks.fist===masteryBefore',true);
run('discoverDrone()');eq('S.ehp===savedHp',true);run('skill()');
// Last bullet + empty weapon fallback are visible in the combat controls.
run(`droneHpByArea[S.place]=85;receive('handgun',1,{ammo:1});equip('handgun');discoverDrone()`);
eq(`$('combatWeapon').textContent.includes('1/20')`,true);run('primary()');h.tickAction();run('discoverDrone()');
eq(`$('combatWeapon').textContent.includes('弾切れ・素手で攻撃')`,true);run('skill()');
// Killing a drone hides the enemy and opens the existing loot screen.
run('S.enemy=true;S.ehp=1;primary()');h.tickAction();eq('S.enemy',false);eq('S.pendingFound.id','scrap');eq(`$('enemy').classList.contains('on')`,false);
// Section lockdown terminates the combat screen and disables escape/attack.
h=harness();h.advance(30000);run('S.place=matchClock.nextBlocked[0];discoverDrone()');h.setNow(run('matchClock.sectionEndsAt'));run('tickMatchClock()');eq('S.enemy',false);eq(`$('enemy').classList.contains('on')`,false);eq(`$('mainBtn').disabled`,true);eq(`$('skillBtn').disabled`,true);
console.log('PASS: central enemy state, HP bar only, main attack routing, escape, button locking, preserved HP, ammo fallback, loot and lockdown cleanup');
