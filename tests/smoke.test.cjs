// User-visible essentials only; feature-specific expectations live in optional suites.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./helpers/game-harness.cjs');
const {loadContent,validateContent}=require('../tools/validate-content.cjs');
test('current content registrations, recipes and image references are valid',()=>{
 const root=path.resolve(__dirname,'..');assert.deepEqual(validateContent(loadContent(root),root).errors,[]);
});
test('selection opens before a match; choosing a character creates player and opponents',()=>{
 const {run}=harness();assert.equal(run('matchClock'),null);
 run("selectedCharacter='raku';startSelectedCharacter()");assert.equal(run('S.character'),'raku');assert.equal(run('comActors.length'),9);assert.equal(run("comActors.some(a=>a.character==='raku')"),false);
 assert.equal(run('matchClock.section'),0);assert.equal(run('S.place'),'待機所');
 run("selectPracticeWeapon('practice_sword');move('山岳区画')");assert.equal(run('S.equipment.weapon'),'practice_sword');assert.equal(run('S.place'),'山岳区画');
});
test('crafting consumes materials and a recovery item restores its intended resource',()=>{
 const {run}=harness();run("startSelectedCharacter();matchClock.section=1;matchClock.sectionEndsAt=Date.now()+100000;S.place='山岳区画';S.bag=[{id:'water',count:1},{id:'lighter',count:1}];syncInventory();var recipe=recipes.find(r=>r.id==='hotwater');var outcome=craftConsumption(recipe)");
 assert(run('canCraft(recipe)'));assert.equal(run("outcome.stacks.some(x=>x.id==='water')"),false);
 run("craft('hotwater','item')");assert(run('(S.inventory.hotwater||0)>0'));assert.equal(run('S.inventory.water||0'),0);
 run("S.bag=[{id:'water',count:10},{id:'water',count:1}];syncInventory();S.st=0;var recovered=recoverActor(S,'water',Date.now())");assert(run('recovered'));assert(run('S.st>0'));assert.equal(run('S.bag.length'),1);assert.equal(run('S.bag[0].count'),10);
});
test('closing an ended match result still allows starting the next game',()=>{
 const {run,context}=harness();let reloads=0;context.location={reload(){reloads++}};
 run("startSelectedCharacter();matchClock.result='win';matchClock.ended=true;showMatchResult();closeModal();primary()");assert.equal(reloads,1);
});
