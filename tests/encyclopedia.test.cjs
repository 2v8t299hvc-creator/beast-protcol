const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./character-catalog.test.cjs');
const plain=(run,code)=>JSON.parse(run('JSON.stringify('+code+')'));
test('selection screen offers encyclopedia and browsing never starts or mutates a match',()=>{
 const {run}=harness();assert(run("$('characterSelectContent').innerHTML.includes('showEncyclopedia()')"));
 const before=run('JSON.stringify({S,comActors,matchClock,playJournal,regionStock,regionObjects})');
 run("showEncyclopedia();encyclopediaSelectItem('dragon_buster');encyclopediaSelectItem('drago_core');encyclopediaBack();encyclopediaFilter('query','ナックル');encyclopediaPage(1);encyclopediaClearFilters()");
 assert.equal(run('matchStarted'),false);assert.equal(run('matchClock'),null);
 assert.equal(run('JSON.stringify({S,comActors,matchClock,playJournal,regionStock,regionObjects})'),before);
 assert.equal(run("$('characterSelect').inert"),true);
 run('startSelectedCharacter()');assert.equal(run('matchStarted'),false);
 run('closeEncyclopedia();startSelectedCharacter()');assert.equal(run('matchStarted'),true);assert(run('matchClock!==null'));
});
test('search, weapon/slot, rarity and fixed-area filters use catalog data',()=>{
 const {run}=harness();assert.equal(run("encyclopediaFilteredItems({query:'ＫＵＫＲＩ'}).some(i=>i.id==='kukri')"),true);
 assert(run("encyclopediaFilteredItems({category:'weapon:bow'}).every(i=>i.equipment.weaponType==='bow')"));
 assert(run("encyclopediaFilteredItems({category:'armor:legs',rarity:'legendary'}).some(i=>i.id==='dragon_scale_boots')"));
 assert(run("encyclopediaFilteredItems({query:'龍の魂'}).some(i=>i.id==='dragon_heart')"));
 assert(run("encyclopediaFilteredItems({area:'山岳区画'}).every(i=>regionStock['山岳区画'][i.id]>0&&i.id!=='laurel')"));
 assert.equal(run("encyclopediaFilteredItems({query:'存在しない名前'}).length"),0);
 run("showEncyclopedia();encyclopediaFilter('query','存在しない名前')");assert(run("$('encyclopediaList').innerHTML.includes('一致するアイテムがありません')"));
});
test('details show real stats, recovery, ingredients, outputs and forward crafting links',()=>{
 const {run}=harness();run("showEncyclopedia();encyclopediaSelectItem('kukri')");
 assert(run("$('encyclopediaDetail').innerHTML.includes(String(EQUIPMENT_DEFS.kukri.attack))"));
 assert(run("$('encyclopediaDetail').innerHTML.includes(names.jambiya)"));
 run("encyclopediaSelectItem('heaven_pot')");assert(run("$('encyclopediaDetail').innerHTML.includes('HPを'+RECOVERY_ITEMS.heaven_pot.amount+'回復')"));
 assert(run("$('encyclopediaDetail').innerHTML.includes('1回で3個')"));
 run("encyclopediaSelectItem('stone')");assert(run("$('encyclopediaDetail').innerHTML.includes(names.medical_stone)"));
});
test('random and fixed sources stay distinct; inactive meteorite has no invented route',()=>{
 const {run}=harness();assert.equal(run("encyclopediaSources('laurel').areas.length"),0);
 assert(run("!!encyclopediaSources('laurel').randomPlacement"));assert(run("!!encyclopediaSources('dragon_scale').randomPlacement"));
 assert(run("encyclopediaSources('dragon_scale').drones.some(d=>d.kind==='dragon')"));
 assert(run("encyclopediaSources('water').areas.every(x=>x.perObject===itemSetCount('water'))"));
 run("showEncyclopedia();encyclopediaSelectItem('meteorite')");assert(run("$('encyclopediaDetail').innerHTML.includes('登録された入手経路はありません')"));
});
test('tree handles alternatives, output batches, depth limits and cycles',()=>{
 const {run}=harness();assert(run("encyclopediaRecipeTree('heaven_pot',4).includes('2回製作')"));
 run("recipes.push({id:'stone',name:names.stone,category:'item',need:{stone:1}})");
 assert(run("encyclopediaRecipeTree('stone').includes('循環参照')"));
 assert(run("encyclopediaRecipeTree('stone',1,[],{remaining:0}).includes('続きは素材名')"));
});
test('pagination is bounded and selections can be followed backward without losing filters',()=>{
 const {run}=harness();run("showEncyclopedia();encyclopediaPage(999)");
 assert(run('encyclopediaState.page<Math.ceil(ITEM_DEFS.length/ENCYCLOPEDIA_PAGE_SIZE)'));
 run("encyclopediaFilter('query','剣');encyclopediaSelectItem('dragon_buster');encyclopediaSelectItem('drago_core');encyclopediaBack()");
 assert.equal(run('encyclopediaState.selected'),'dragon_buster');assert.equal(run('encyclopediaState.query'),'剣');
 run('closeEncyclopedia();showEncyclopedia()');assert.equal(run('encyclopediaState.query'),'剣');
});
test('the catalog remains extensible without a separate encyclopedia item list',()=>{
 const {run}=harness(false,s=>s.replace('const ITEM_BY_ID=',"ITEM_DEFS.push({id:'ency_new',name:'新しい図鑑アイテム',fallback:'📦',recovery:{group:'hp',amount:43}});\nconst ITEM_BY_ID="));
 assert(run("encyclopediaFilteredItems({query:'新しい図鑑'}).some(i=>i.id==='ency_new')"));
 run("showEncyclopedia();encyclopediaSelectItem('ency_new')");assert(run("$('encyclopediaDetail').innerHTML.includes('HPを43回復')"));
});
test('delayed encyclopedia image loads hydrate safely before match initialization',()=>{
 const {run}=harness(false,s=>s.replace('installPlayRecording();',"var pendingImages=[];Image=class{constructor(){pendingImages.push(this)}};var savedRefresh=refresh,encyRefreshCalls=0;refresh=()=>{encyRefreshCalls++;return savedRefresh()};\ninstallPlayRecording();"));
 run('showEncyclopedia();pumpItemSheets()');assert(run('pendingImages.length>0'));
 run('pendingImages[0].onload()');assert.equal(run('encyRefreshCalls'),0);assert.equal(run('matchClock'),null);
 run('closeEncyclopedia();startSelectedCharacter();encyRefreshCalls=0');
 run('pendingImages[1].onload()');assert.equal(run('encyRefreshCalls'),1);
});
test('armguard display follows its starter and crafting links carry their own rarity',()=>{
 const {run}=harness();
 for(const filter of ['{}',"{category:'armor:arm'}","{query:'アームガード'}"]){
  const ids=plain(run,'encyclopediaFilteredItems('+filter+').map(i=>i.id)');assert.equal(ids.indexOf('armguard'),ids.indexOf('simple_armguard')+1);
 }
 assert(run("ITEM_DEFS.findIndex(i=>i.id==='armguard')<ITEM_DEFS.findIndex(i=>i.id==='simple_armguard')"));
 for(const id of ['stone','armguard','iron_armguard','kukri','dragon_heart'])assert(run(`encyclopediaLink('${id}').includes('data-rarity="'+(ITEM_BY_ID['${id}'].rarity||'common')+'"')`));
 assert(run("encyclopediaRecipeTree('kukri').includes('data-rarity=\"rare\"')"));
 run("readySheets.basic=true;readySheets.slash_03=true");
 assert(run("itemIconHTML('stone').includes('border:0;outline:0;box-shadow:none')"));
 assert(run("itemSheetUrl('basic').includes('artVersion=')"));
 assert(run("itemSheetUrl('basic',2).includes('&artRetry=2')"));
 assert.equal(run("itemSheetUrl('slash_03')"),run('itemArtSheets.slash_03'));
});
test('water item artwork uses alpha-enabled frame-free atlases in the shared renderer',()=>{
 const {run}=harness(),fs=require('node:fs'),path=require('node:path');
 const sheets=plain(run,"Object.fromEntries(Object.entries(ITEM_ART_SHEETS).filter(([key])=>/^water_(?:[1-5]|gear_[1-3])$/.test(key)))");
 assert.equal(Object.keys(sheets).length,8);
 for(const [sheet,url]of Object.entries(sheets)){
  assert(url.startsWith('assets/unframed/'),sheet);
  const bytes=fs.readFileSync(path.join(__dirname,'..',url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  let alpha=false;for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4),kind=bytes.toString('ascii',offset,offset+4);if(kind==='VP8X')alpha=!!(bytes[offset+8]&16);offset+=8+size+(size%2)}
  assert(alpha,sheet+' must contain true alpha transparency');
  run(`readySheets['${sheet}']=true`);
 }
 for(const id of ['onyx_suit','paradise_sashimi','paradise_platter','paradise_broth','water','rubber'])assert(run(`itemIconHTML('${id}').includes('assets/unframed/')`),id);
 assert.equal(run("JSON.stringify(itemArt.onyx_suit)"),'["water_gear_3",2]');
 assert.equal(run("JSON.stringify(itemArt.paradise_sashimi)"),'["water_4",3]');
});
