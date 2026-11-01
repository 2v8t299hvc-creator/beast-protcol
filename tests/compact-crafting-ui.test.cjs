const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/game-harness.cjs');
const unfolded=html=>html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
test('crafting and related lists prioritize craftable recipes before family order',()=>{
 const {run}=harness();run("startSelectedCharacter();canCraft=r=>r.id==='premium_ration';showCraft('item','recovery')");
 const html=run("$('modalBody').innerHTML");
 assert(html.indexOf('data-recipe-id="premium_ration"')<html.indexOf('data-recipe-id="medium_ration"'));
 assert(!html.includes('bp-item-information'));assert(!html.includes('銃声の発生率'));
 run("showRecipesFor('ration')");const related=run("$('modalBody').innerHTML");
 assert(related.indexOf('data-recipe-id="premium_ration"')<related.indexOf('data-recipe-id="medium_ration"'));
 assert.equal(run("JSON.stringify(encyclopediaFilteredItems({query:'レーション'}).map(i=>i.id))"),'["ration","medium_ration","premium_ration","compressed_ration"]');
});
test('inventory puts equip controls first and equipment explanations start collapsed',()=>{
 const {run}=harness();run("startSelectedCharacter();S.bag=[{id:'dragon_buster',count:1}];syncInventory();showItemStack(0)");
 const html=run("$('modalBody').innerHTML");assert(html.indexOf('装備する')<html.indexOf('詳しい説明'));
 assert(!unfolded(html).includes('ドローンに与えるダメージが200%'));assert(!/<details[^>]*\bopen\b/.test(html));
 run("S.equipment.weapon='dragon_buster';showEquipment()");const equipment=run("$('modalBody').innerHTML");
 assert(!unfolded(equipment).includes('ドローンに与えるダメージが200%'));
 assert(!unfolded(equipment).includes('武器は最初の10回'));assert(equipment.includes('耐久値の仕組み'));
 run("showEncyclopedia();encyclopediaSelectItem('dragon_buster')");assert(run("$('encyclopediaDetail').innerHTML.includes('ドローンに与えるダメージが200%')"));
});
