const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
function game(){
 const {run}=harness();
 run("selectedCharacter='raz';startSelectedCharacter();S.place='山岳区画';matchClock.section=1;matchClock.blocked=[];matchClock.sectionEndsAt=Date.now()+999999");
 return run;
}
test('Raz starts with both weapon skills at D and nine opponents',()=>{
 const run=game();
 assert.equal(run('S.masteryAttacks.slash'),14);
 assert.equal(run('S.masteryAttacks.hammer'),14);
 assert.equal(run('comActors.length'),9);
 assert.equal(run('comActors.some(a=>a.character===S.character)'),false);
});
test('first player corpse grants exactly one stack and correct bonuses',()=>{
 const run=game();
 run("var razCorpseTest=createCorpse('player','test','山岳区画',[],Date.now(),{ownerId:'victim-test'})");
 assert.equal(run('razFindCorpse(S,razCorpseTest)'),true);
 assert.equal(run('razFindCorpse(S,razCorpseTest)'),false);
 assert.equal(run('S.razCorpseStacks'),1);
 assert.equal(run("actorStatMultiplier('attack',S)"),1.03);
 assert.equal(run("characterSkillHook(S,'passive','criticalBonus',Date.now())"),0.01);
});
test('tracking marks only configured corpse types and snapshots the current set',()=>{
 const run=game();
 run("var birdCorpseTest=createCorpse('drone','bird','山岳区画',[{id:'feather',count:1}],Date.now(),{droneKind:'bird',lifetimeMs:80000})");
 run("var humanCorpseTest=createCorpse('drone','human','山岳区画',[{id:'cell',count:1}],Date.now(),{droneKind:'humanoid',lifetimeMs:80000})");
 assert.equal(run("SKILL_BEHAVIORS.scent_tracking.execute(S,Date.now())"),true);
 assert.equal(run('razScentMarked(S,birdCorpseTest)'),true);
 assert.equal(run('razScentMarked(S,humanCorpseTest)'),false);
 assert.equal(run('corpseDiscoveryRate(birdCorpseTest,S)'),1);
 assert.equal(run('corpseDiscoveryRate(humanCorpseTest,S)'),0.05);
 assert.equal(run('razScentAreas(S).has("山岳区画")'),true);
});
test('dragon corpses persist until area seal and then vanish',()=>{
 const run=game();
 run("var dragonCorpseTest=createCorpse('drone','dragon','山岳区画',[{id:'dragon_scale',count:1}],Date.now(),{droneKind:'dragon',lifetimeMs:180000})");
 assert.equal(run('dragonCorpseTest.expiresAt'),null);
 assert.equal(run('corpseAvailable(dragonCorpseTest,Date.now()+500000)'),true);
 run("matchClock.blocked=['山岳区画']");
 assert.equal(run('corpseAvailable(dragonCorpseTest)'),false);
});
