const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
test('classification, real stats and effects are separate and shared',()=>{
 const {run}=harness();
 assert.equal(run("itemClassification('dragon_buster')"),'武器 › 斬り');
 assert.equal(run("itemClassification('water')"),'回復 › スタミナ回復');
 run("showEncyclopedia();encyclopediaSelectItem('dragon_buster')");
 const html=run("$('encyclopediaDetail').innerHTML");
 assert(html.includes('基本性能'));assert(html.includes('固有効果'));assert(html.includes('通常の3倍'));assert(html.includes('対人戦'));
 assert(html.indexOf('分類：')<html.indexOf('基本性能'));assert(html.indexOf('基本性能')<html.indexOf('固有効果'));
 assert.equal(run("equipmentEffectCooldown('blizzard_cannon')"),45);
 assert(run("ITEM_DEFS.filter(i=>i.effect).every(i=>i.effect.description.endsWith('。')&&!/CT|クールタイム|外れ/.test(i.effect.description))"));
 assert(run("ITEM_DEFS.every(i=>!!itemClassification(i.id))"));
});
test('shared presentation reads current catalog values without mutating game state',()=>{
 const {run}=harness();
 const before=run('JSON.stringify({S,comActors,ITEM_DEFS,CHARACTER_DEFS,recipes})');
 run('ITEM_DEFS.forEach(i=>{itemClassification(i.id);itemBasicStats(i.id);itemInformationHTML(i.id);equipmentDetails(i.id)})');
 assert.equal(run('JSON.stringify({S,comActors,ITEM_DEFS,CHARACTER_DEFS,recipes})'),before);
 run("ITEM_DEFS[0].recovery={group:'hp',amount:43}");
 assert(run("itemInformationHTML(ITEM_DEFS[0].id).includes('HPを43回復する。')"));
});
