const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
function setup(){const h=harness();h.run(`selectedCharacter='raku';startSelectedCharacter();var now=Date.now(),a=comActors.find(x=>x.character==='zakuro');matchClock.section=5;matchClock.sectionEndsAt=now+1000000;matchClock.blocked=[];matchClock.nextBlocked=[];matchClock.competitive=true;a.place='山岳区画';a.equipment={weapon:'kukri'};a.equipmentEffects={weapon:equipmentInstanceEffects('kukri',{durability:3,wearAttacks:32})};a.masteryAttacks={slash:62};a.bag=[{id:'army_knife',count:1,effects:equipmentInstanceEffects('army_knife')}];a.hp=actorMax(a,'hp');a.st=100;a.goal=null;a.exhausted={};a.characterFieldReadyAt=now+100000;syncInventory(a);`);return h.run}
test('logged Zakuro swaps once to fresh knife, then stays stable over 100 decisions',()=>{
 const run=setup();assert(run('comEquipBetter(a,now)'));assert.equal(run('a.equipment.weapon'),'army_knife');
 for(let i=0;i<100;i++)assert.equal(run(`comEquipBetter(a,now+${i*1000})`),false);
 assert.equal(run('a.bag.find(x=>x.id===\'kukri\').effects.durability'),3);
 run("a.bag.push({id:'dragon_buster',count:1});syncInventory(a)");assert(run('comEquipBetter(a,now)'));assert.equal(run('a.equipment.weapon'),'dragon_buster');
});
test('consumption frees smaller stack, preserves order/metadata, handles multiple stacks and shortage atomically',()=>{
 const run=setup();run(`var stacks=[{id:'water',count:10},{id:'kukri',count:1,effects:{durability:3}},{id:'water',count:1},{id:'water',count:3}];`);
 const val=s=>JSON.parse(run(`JSON.stringify(${s})`));
 assert.deepEqual(val("removeFromStacks(stacks,'water',1)"),[{id:'water',count:10},{id:'kukri',count:1,effects:{durability:3}},{id:'water',count:3}]);
 assert.deepEqual(val("removeFromStacks(stacks,'water',5)"),[{id:'water',count:9},{id:'kukri',count:1,effects:{durability:3}}]);
 assert.equal(run("removeFromStacks(stacks,'water',15)"),null);assert.equal(run('stacks[2].count'),1);
 run("a.bag=[{id:'water',count:10},{id:'water',count:1}];syncInventory(a);a.st=0;recoverActor(a,'water',now)");assert.equal(run('a.bag.length'),1);assert.equal(run('a.bag[0].count'),10);
 run("a.bag=[{id:'water',count:10},{id:'water',count:1},{id:'lighter',count:1}];syncInventory(a);var r=craftConsumption(recipes.find(x=>x.id==='hotwater'),a)");assert.equal(run("r.stacks.find(x=>x.id==='water').count"),10);
});
test('injury treatment avoids recent hits, resumes after quiet or relocation, and is forgone in endgame',()=>{
 const run=setup();run("a.bodyInjuries={head:true};a.damageNotice={at:now-9000,area:a.place}");assert.equal(run('comShouldTreatInjury(a,now)'),false);
 run('stepCom(a,now)');assert.equal(run('!!a.bodyTreatment'),false);assert.equal(run('a.restMode'),null);
 run('a.opponent=null;a.damageNotice.at=now-20000');assert.equal(run('comShouldTreatInjury(a,now)'),true);
 run('stepCom(a,now)');assert.equal(run('a.bodyTreatment.part'),'head');
 run('matchClock.section=9;a.opponent=null;stepCom(a,now+1000)');assert.equal(run('a.bodyTreatment'),null);assert.equal(run('a.bodyInjuries.head'),true);
 run("matchClock.section=5;a.damageNotice={at:now,area:'海岸区画'}");assert.equal(run('comShouldTreatInjury(a,now)'),true);
});
test('late low stamina searches with HP, and lethal search cost receives only minimal healing',()=>{
 const run=setup();run("matchClock.section=9;a.bodyInjuries={head:true};a.bag=[];syncInventory(a);a.hp=100;a.st=0;a.restMode='stamina';stepCom(a,now)");assert.equal(run('a.restMode'),null);assert.equal(run('!!a.bodyTreatment'),false);assert.equal(run('a.hp'),97);
 run('a.opponent=null;a.hp=1;a.st=0;stepCom(a,now+1000)');assert(run('a.hp>1'));assert.equal(run('a.restMode'),null);
});
