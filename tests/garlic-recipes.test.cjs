const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./character-catalog.test.cjs');
const dishes=[['fried_garlic',{heated_oil:1,garlic:1},8,'rare','hp',25],['stamina_soup',{hotwater:1,garlic:1},4,'uncommon','stamina',42],['garlic_oil',{oil:1,garlic:1},2,'uncommon','stamina',30],['garlic_steak',{steak:1,garlic_oil:1},3,'epic','hp',150],['ajillo',{garlic_oil:1,fish_scale:1},2,'rare','hp',70]];
for(const [id,need,count,rarity,group,amount] of dishes)test(id+' crafts the specified batch and restores the correct resource',()=>{
 const {run}=harness();run('startSelectedCharacter();matchClock.section=1;S.bag='+JSON.stringify(Object.entries(need).map(([id,count])=>({id,count})))+';syncInventory()');
 assert.equal(run(`RECIPE_RARITY.${id}`),rarity);
 assert.equal(JSON.stringify(run(`recipes.find(r=>r.id==='${id}').need`)),JSON.stringify(need));
 assert(run(`craftActor(S,recipes.find(r=>r.id==='${id}'),1000000)`));
 assert.equal(run(`S.inventory.${id}`),count);
 for(const material of Object.keys(need))assert.equal(run(`S.inventory.${material}||0`),0);
 run('S.hp=1;S.st=0');assert(run(`recoverActor(S,'${id}',1001000)`));
 assert.equal(run(group==='hp'?'S.hp':'S.st'),group==='hp'?Math.min(amount+1,run("actorMax(S,'hp')")):amount);
 assert.equal(run(`S.inventory.${id}`),count-1);
});
test('garlic is placed only in the two requested areas; rewards exclude garlic steak',()=>{
 const {run}=harness();assert.equal(run('RECIPE_RARITY.garlic'),'common');assert.equal(run('RECOVERY_ITEMS.garlic.amount'),10);
 assert.equal(JSON.stringify(run("Object.entries(regionStock).filter(([,stock])=>stock.garlic).map(([area,stock])=>[area,stock.garlic])")),JSON.stringify([['住宅区画',4],['商業区画',4]]));
 for(const id of ['garlic',...dishes.map(x=>x[0])])assert.equal(run(`isRandomSupplyItem('${id}')`),id!=='garlic_steak');
 for(const [id,,count] of dishes)if(id!=='garlic_steak')assert.equal(run(`supplySetCount('${id}')`),count);
});
test('COM can plan and craft stamina soup from stocked ingredients',()=>{
 const {run}=harness();run("startSelectedCharacter();matchClock.section=1;var a=comActors[0];a.bag=[{id:'hotwater',count:1},{id:'garlic',count:1}];syncInventory(a);var p=comRecoveryPlan(a,1000000,{needed:{}})");
 assert.equal(run('p.recipeId'),'stamina_soup');
 assert(run("craftActor(a,recipes.find(r=>r.id===p.recipeId),1000000)"));assert.equal(run('a.inventory.stamina_soup'),4);
});
