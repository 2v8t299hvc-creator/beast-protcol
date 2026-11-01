const {test}=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {harness}=require('./character-catalog.test.cjs');
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
test('editing descriptions preserves registered mechanics and recipes',()=>{
 const {createHash}=require('node:crypto'),{run}=harness();
 const data=run("JSON.stringify({items:ITEM_DEFS,characters:CHARACTER_DEFS,recipes},(key,value)=>['description','desc','summary'].includes(key)?undefined:value)");
 assert.equal(createHash('sha256').update(data).digest('hex'),'9968e8fa2501d1e0b1a0e39191fd6c77b23d52b0357e7c56e4029fb99086c20e');
});
