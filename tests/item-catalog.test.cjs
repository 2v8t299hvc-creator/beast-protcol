// A registered item must reach actual crafting, equipment, recovery and art paths.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./character-catalog.test.cjs');
let {run}=harness();
assert.equal(run('validateItemDefinitions(ITEM_DEFS,ITEM_ART_SHEETS)'),true);
for(const url of run('Object.values(ITEM_ART_SHEETS).concat(ITEM_DEFS.filter(item=>item.skillIcon).map(item=>item.skillIcon.art))'))assert(fs.existsSync(path.join(__dirname,'..',url)),url);
const clone="ITEM_DEFS.map(i=>({...i,equipment:i.equipment&&{...i.equipment},recipes:i.recipes&&i.recipes.map(r=>({...r,need:{...r.need}}))}))";
for(const edit of ["defs.push(defs[0])","defs[0].rarity='invalid'","defs[0].art=['missing_atlas',0]","defs[0].recipes=[{category:'item',need:{missing_ingredient:1}}]","defs[0].recipes=[{category:'item',need:{water:0}}]","defs[0].recovery={group:'hp',amount:-1}","defs[0].startingWeapon=true","defs[0].findCount=0"]){
 assert.throws(()=>run(`(()=>{const defs=${clone};${edit};return validateItemDefinitions(defs,ITEM_ART_SHEETS)})()`));
}
const registration=`ITEM_DEFS.push(
 {id:'catalog_drink',name:'登録テストドリンク',rarity:'rare',recovery:{group:'stamina',amount:37},craftGroup:'recovery',fallback:'🧃',art:['gear',0],findCount:3,recipes:[{category:'item',need:{water:1},count:2,desc:'テスト用回復'}]},
 {id:'catalog_weapon',name:'登録テスト武器',rarity:'epic',equipment:{slot:'weapon',weaponType:'fist',attack:35,defense:0},effect:{name:'テスト吸収',description:'吸収5%',lifesteal:.05},recipes:[{category:'weapon',need:{stone:1},desc:'テスト用武器'}]},
 {id:'catalog_fish',name:'登録テスト魚',singleStack:true,fallback:'🐟'},
 {id:'catalog_ammo',name:'登録テスト弾薬',carryLimit:40,findCount:20}
);\n`;
({run}=harness(false,source=>source.replace('const ITEM_BY_ID=',registration+'const ITEM_BY_ID=')));
assert.equal(run('names.catalog_drink'),'登録テストドリンク');
assert.equal(run('RECIPE_RARITY.catalog_drink'),'rare');
assert.equal(run('recipeSubcategory(recipes.find(r=>r.id===\'catalog_drink\'))'),'recovery');
assert.equal(run('itemSetCount(\'catalog_drink\')'),3);
assert.equal(run('stackLimit(\'catalog_fish\')'),1);
assert.equal(run('stackLimit(\'catalog_ammo\')'),40);
run('readySheets.gear=true');assert(run("itemIconHTML('catalog_drink').includes(itemArtSheets.gear)"));
run("startSelectedCharacter();matchClock.section=1;S.bag=[{id:'water',count:1},{id:'stone',count:1}];syncInventory();");
assert.equal(run("craftActor(S,recipes.find(r=>r.id==='catalog_drink'))"),true);
assert.equal(run('S.inventory.catalog_drink'),2);assert.equal(run('S.inventory.water||0'),0);
run('S.st=0');assert.equal(run("recoverActor(S,'catalog_drink',1000000)"),true);
assert.equal(run('S.st'),37);assert.equal(run('S.inventory.catalog_drink'),1);
assert.equal(run("craftActor(S,recipes.find(r=>r.id==='catalog_weapon'))"),true);
assert.equal(run("equipActor(S,S.bag.findIndex(x=>x.id==='catalog_weapon'),1000000)"),true);
assert.equal(run('S.equipment.weapon'),'catalog_weapon');assert.equal(run('equipmentDef(S.equipment.weapon).attack'),35);
assert.equal(run('EQUIPMENT_SPECIAL_EFFECTS[S.equipment.weapon].lifesteal'),.05);
console.log('PASS: item registration feeds recipes, categories, artwork, quantities, recovery and equipment; invalid registrations are rejected');
