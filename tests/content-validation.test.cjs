const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {loadContent,validateContent}=require('../tools/validate-content.cjs');const root=path.resolve(__dirname,'..');
const fresh=()=>loadContent(root);
test('current game has no registration errors and reports content counts',()=>{
 const report=validateContent(fresh(),root);assert.deepEqual(report.errors,[]);
 assert(report.counts.characters>0&&report.counts.skills>0&&report.counts.items>0&&report.counts.recipes>0&&report.counts.images>0);
});
const cases=[
 ['duplicate item ID','SCHEMA',d=>d.items.push(d.items[0])],
 ['unnamed item','SCHEMA',d=>d.items[0].name=''],
 ['missing recipe ingredient','UNKNOWN_ITEM',d=>d.items.find(i=>i.recipes?.length).recipes[0].need.missing_item=1],
 ['weapon recipe without weapon stats','RECIPE_EQUIPMENT',d=>d.items.find(i=>i.recipes?.length).recipes[0].category='weapon'],
 ['invalid ammo capacity','INVALID_AMMO_CAPACITY',d=>d.items.find(i=>i.equipment?.ammoType).equipment.capacity=null],
 ['missing item icon','MISSING_ITEM_ICON',d=>{delete d.items[0].art;delete d.items[0].fallback}],
 ['missing atlas reference','SCHEMA',d=>d.items[0].art=['missing_sheet',0]],
 ['unknown craft category','UNKNOWN_CRAFT_GROUP',d=>d.items[0].craftGroup='typo'],
 ['unclassified recovery recipe','RECOVERY_CRAFT_GROUP',d=>delete d.items.find(i=>i.recovery&&i.recipes?.length).craftGroup],
 ['unknown region item','UNKNOWN_ITEM',d=>d.regions[Object.keys(d.regions)[0]].missing_item=1],
 ['invalid region quantity','REGION_QUANTITY',d=>d.regions[Object.keys(d.regions)[0]].stone=-1],
 ['unknown character starting area','UNKNOWN_REGION',d=>d.characters[0].startArea='missing_area'],
 ['missing portrait file','MISSING_IMAGE',d=>d.characters[0].art='assets/missing-portrait.webp'],
 ['missing skin file','MISSING_IMAGE',d=>d.characters[0].skins.find(s=>s.art).art='assets/missing-skin.webp'],
 ['missing character skill icon','MISSING_IMAGE',d=>Object.values(d.characters[0].skills)[0].icon='assets/missing-skill.webp'],
 ['missing equipment skill icon','MISSING_IMAGE',d=>d.items.find(i=>i.skillIcon).skillIcon.art='assets/missing-equipment-skill.webp'],
 ['missing behavior','SCHEMA',d=>delete d.behaviors.step_break],
 ['non-function behavior hook','INVALID_SKILL_HOOK',d=>d.behaviors.step_break.onResolved=null],
 ['unknown drone drop','UNKNOWN_ITEM',d=>d.drones.bird.drops.push('missing_drop')],
 ['unknown drone area','UNKNOWN_REGION',d=>d.drones.bird.areas.push('missing_area')],
 ['unknown mineral candidate','UNKNOWN_ITEM',d=>d.generated.push('missing_mineral')],
 ['unknown COM target','UNKNOWN_ITEM',d=>d.goals.fist.push('missing_goal')],
 ['unknown starting supply table','UNKNOWN_SUPPLY_TABLE',d=>d.startingTables.push('missing_table')],
 ['unknown drone supply table','UNKNOWN_SUPPLY_TABLE',d=>d.droneTables.bird.push('missing_table')],
 ['runtime patch outside catalog','CATALOG_DRIFT',d=>d.runtime.names.unregistered_patch='未登録']
];
for(const [label,code,mutate]of cases)test('detects '+label,()=>{const data=fresh();mutate(data);const report=validateContent(data,root);assert(report.errors.some(e=>e.code===code),JSON.stringify(report.errors));});
test('checks static HTML/CSS fallback artwork as well as catalog images',()=>{
 const data=fresh(),target=path.resolve(root,data.staticAssets[0].split(/[?#]/)[0]);
 const report=validateContent(data,root,{assetExists:p=>p!==target&&fs.existsSync(p)});
 assert(report.errors.some(e=>e.code==='MISSING_IMAGE'&&e.location==='index.html.staticImage'));
});
test('unreachable new material is reported without inventing an acquisition route',()=>{
 const data=fresh();data.items.push({id:'unused_new_material',name:'未配置の追加素材',fallback:'📦'});
 const report=validateContent(data,root);assert(report.warnings.some(e=>e.code==='NO_ACQUISITION_ROUTE'&&e.location==='item.unused_new_material'));
});

test('CLI emits parseable JSON and strict mode respects warning status',()=>{
 const {spawnSync}=require('node:child_process'),script=path.join(root,'tools/validate-content.cjs');
 const normal=spawnSync(process.execPath,[script,'--json'],{encoding:'utf8'});assert.equal(normal.status,0,normal.stderr);
 const report=JSON.parse(normal.stdout);assert.deepEqual(report.errors,[]);
 const strict=spawnSync(process.execPath,[script,'--strict','--json'],{encoding:'utf8'});assert.equal(strict.status,report.warnings.length?1:0,strict.stderr);
});
