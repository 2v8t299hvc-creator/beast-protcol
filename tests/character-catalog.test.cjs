// Character registration and extension behavior. Shared fixtures have no test side effects.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const {harness}=require('./helpers/game-harness.cjs');
let {run}=harness();
assert.equal(run('validateCharacterDefinitions(CHARACTER_DEFS)'),true);
for(const asset of run('CHARACTER_DEFS.flatMap(c=>[c.art,...c.skins.map(s=>s.art),...Object.values(c.skills).map(s=>s.icon)]).filter(Boolean)'))assert(fs.existsSync(path.join(root,asset)),asset);
for(const edit of ["defs.push(defs[0])","defs[0].statTargets.pop()","defs[0].skins.push(defs[0].skins[0])","defs[0].skills.active.icon=''","defs[0].weaponTypes=['invalid']"]){
 assert.throws(()=>run(`(()=>{const defs=JSON.parse(JSON.stringify(CHARACTER_DEFS));${edit};return validateCharacterDefinitions(defs)})()`));
}
({run}=harness(true));
assert.equal(run('COM_COUNT'),9);
run("showCharacterSelection('catalog_test')");
assert(run("$('characterSelectContent').innerHTML.includes('登録テスト')"));
assert.equal(run("actorArt({character:'catalog_test'})"),run('CHARACTER_DEFS[0].art'));
assert.equal(run("actorArt({character:'catalog_test',skin:'test_skin'})"),'assets/skins/hayate_hunter.webp');
assert.equal(run("JSON.stringify(comWeaponTypes({character:'catalog_test'}))"),'["gun","bow"]');
assert.equal(run("initialMastery('catalog_test').gun"),20);
run("selectedCharacter='kaito';startSelectedCharacter()");
assert.equal(run('comActors.length'),9);
run('initializeComActors(PLAYABLE_CHARACTERS.length-1)');
assert.equal(run("comActors.filter(a=>a.character==='catalog_test').length"),1);
assert.equal(run("comActors.some(a=>a.character==='kaito')"),false);
({run}=harness(true));
run("selectedCharacter='catalog_test';startSelectedCharacter()");
assert.equal(run('S.character'),'catalog_test');
assert.equal(run('S.masteryAttacks.gun'),20);
assert.equal(run('comActors.length'),9);
assert.equal(run("comActors.some(a=>a.character==='catalog_test')"),false);
console.log('PASS: catalog validation, artwork paths, extra-character selection, skins, mastery, weapons, player initialization and complete COM roster');
