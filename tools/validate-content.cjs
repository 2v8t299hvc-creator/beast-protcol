#!/usr/bin/env node
// Read-only registration checks. Runs the inline game in a minimal, timer-free VM, not a browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function loadContent(root){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 const elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},Date:class extends Date{static now(){return 1000000}},getComputedStyle:()=>({backgroundImage:''}),setTimeout(){},clearTimeout(){},setInterval(){},console:{log(){},warn(){},error(){}}});
 vm.runInContext('globalThis.seed=7;Math.random=()=>{seed=seed*16807%2147483647;return seed/2147483647}',context);
 vm.runInContext(source,context,{filename:'index.html:inline',timeout:5000});
 const data=vm.runInContext(`({characters:CHARACTER_DEFS,items:ITEM_DEFS,sheets:ITEM_ART_SHEETS,behaviors:SKILL_BEHAVIORS,regions:regionStock,drones:DRONE_DEFS,stageArt:stageArtRegistry,craftGroups:CRAFT_SUBCATEGORIES.item.map(([id])=>id),tableOrder:ITEM_TABLE_ORDER,runtime:{names,recipes,EQUIPMENT_DEFS,EQUIPMENT_SPECIAL_EFFECTS,RECIPE_RARITY,RECOVERY_ITEMS,itemArt,itemArtSheets,itemFallback,ITEM_CRAFT_GROUP,AMMO_LIMITS,PRACTICE_WEAPONS},edible:[...EDIBLE_MINERALS],generated:GENERATED_MINERALS,randomOther:[...RANDOM_OTHER_ITEMS],supplyTables:RANDOM_SUPPLY_TABLES,startingTables:STARTING_SUPPLY_TABLES,droneTables:DRONE_SUPPLY_TABLES,goals:{bow:COM_GOALS,western:COM_WESTERN_GOALS,gun:COM_GUN_GOALS,hammer:COM_HAMMER_GOALS,slash:COM_SLASH_GOALS,fist:COM_FIST_GOALS},validators:{characters:validateCharacterDefinitions,items:validateItemDefinitions,skills:validateSkillBehaviors,buildItems:buildItemTables}})`,context);
 data.staticAssets=[...html.matchAll(/(?:src|href)\s*=\s*["'](assets\/[^"']+)["']|url\(\s*["']?(assets\/[^"'()\s]+)["']?\s*\)/g)].map(m=>m[1]||m[2]);
 return data;
}
function validateContent(data,root,{assetExists=fs.existsSync}={}){
 const errors=[],warnings=[],assets=new Set();
 const issue=(severity,code,location,message)=>(severity==='error'?errors:warnings).push({code,location,message});
 const error=(code,location,message)=>issue('error',code,location,message);
 const warn=(code,location,message)=>issue('warning',code,location,message);
 const items=new Map(data.items.map(item=>[item.id,item]));
 const characters=new Set(data.characters.map(c=>c.id)),regions=new Set(Object.keys(data.regions));
 for(const [name,run] of Object.entries({characters:()=>data.validators.characters(data.characters),items:()=>data.validators.items(data.items,data.sheets),skills:()=>data.validators.skills(data.characters,data.behaviors)})){
  try{run()}catch(e){error('SCHEMA',name,e.message)}
 }
 function itemRef(id,location){if(!items.has(id))error('UNKNOWN_ITEM',location,'未登録のアイテムID: '+id)}
 function areaRef(area,location){if(!regions.has(area))error('UNKNOWN_REGION',location,'未登録の区画: '+area)}
 function asset(url,location){
  if(typeof url!=='string'||!url){error('MISSING_IMAGE',location,'画像パスがありません');return}
  if(/^https?:\/\//.test(url)){warn('EXTERNAL_IMAGE',location,'外部画像はローカルで確認できません: '+url);return}
  const clean=url.split(/[?#]/)[0],absolute=path.resolve(root,clean),relative=path.relative(path.resolve(root),absolute);
  if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)){error('IMAGE_OUTSIDE_REPO',location,'画像がリポジトリ外を参照しています');return}
  assets.add(clean);
  if(!assetExists(absolute)){error('MISSING_IMAGE',location,'画像が見つかりません: '+clean);return}
  if(!/\.(?:png|jpe?g|webp|gif|svg)$/i.test(clean))error('IMAGE_EXTENSION',location,'対応する画像拡張子ではありません: '+clean);
 }
 for(const url of data.staticAssets||[])asset(url,'index.html.staticImage');
 for(const [sheet,url]of Object.entries(data.sheets))asset(url,'atlas.'+sheet);
 for(const c of data.characters){
  asset(c.art,'character.'+c.id+'.art');
  if(c.startArea!=null)areaRef(c.startArea,'character.'+c.id+'.startArea');
  for(const skin of c.skins||[])if(skin.art)asset(skin.art,'character.'+c.id+'.skin.'+skin.id);
  for(const [kind,skill]of Object.entries(c.skills||{}))asset(skill.icon,'skill.'+skill.id+'.icon');
 }
 const registeredSkills=new Set(data.characters.flatMap(c=>Object.values(c.skills||{}).map(s=>s.id)));
 const behaviorDataFields=new Set(['kind','tooltip','normalHitActive','unavailableMessage','comPhase','gains','requirements']);
 for(const [id,behavior]of Object.entries(data.behaviors)){
  if(!registeredSkills.has(id))warn('UNASSIGNED_SKILL','skill.'+id,'挙動があるのにキャラへ割り当てられていません');
  for(const [key,value]of Object.entries(behavior))if(!behaviorDataFields.has(key)&&typeof value!=='function')error('INVALID_SKILL_HOOK','skill.'+id+'.'+key,'スキルのフックが関数ではありません');
 }
 if(data.runtime&&data.validators.buildItems){
  try{const generated=data.validators.buildItems(data.items,data.sheets,data.tableOrder);for(const [name,value]of Object.entries(data.runtime))if(JSON.stringify(value)!==JSON.stringify(generated[name]))error('CATALOG_DRIFT','runtime.'+name,'実行時テーブルが登録元の定義と一致しません')}catch(e){/* Schema errors are already reported above. */}
 }
 const recipeOrders=new Map();
 for(const item of data.items){
  if(!item.art&&!item.fallback)error('MISSING_ITEM_ICON','item.'+item.id,'画像も代替アイコンも登録されていません');
  if(item.equipment?.ammoType&&(typeof item.equipment.capacity!=='number'||!(item.equipment.capacity===Infinity||(Number.isInteger(item.equipment.capacity)&&item.equipment.capacity>=0))))error('INVALID_AMMO_CAPACITY','item.'+item.id,'装填数は0以上の整数またはInfinityにしてください');
  if(item.craftGroup&&!data.craftGroups.includes(item.craftGroup))error('UNKNOWN_CRAFT_GROUP','item.'+item.id,'未登録の製作分類: '+item.craftGroup);
  if(item.recovery&&item.recipes?.some(r=>r.category==='item')&&item.craftGroup!=='recovery')error('RECOVERY_CRAFT_GROUP','item.'+item.id,'回復アイテムの製作分類がrecoveryではありません');
  if(item.skillIcon)asset(item.skillIcon.art,'item.'+item.id+'.skillIcon');
  for(const [index,recipe]of (item.recipes||[]).entries()){
   const location='recipe.'+item.id+'['+index+']';
   for(const ingredient of Object.keys(recipe.need||{}))itemRef(ingredient,location+'.need');
   if(recipe.category==='weapon'&&item.equipment?.slot!=='weapon')error('RECIPE_EQUIPMENT',location,'武器レシピに武器性能がありません');
   if(recipe.category==='armor'&&(!item.equipment||item.equipment.slot==='weapon'))error('RECIPE_EQUIPMENT',location,'防具レシピに対応する防具性能がありません');
   if(recipe.order!=null){
    if(!Number.isInteger(recipe.order)||recipe.order<0)error('RECIPE_ORDER',location,'レシピ順は0以上の整数にしてください');
    else if(recipeOrders.has(recipe.order))warn('DUPLICATE_RECIPE_ORDER',location,'レシピ順が重複: '+recipeOrders.get(recipe.order));
    else recipeOrders.set(recipe.order,location);
   }
  }
 }
 for(const [area,stock]of Object.entries(data.regions))for(const [id,count]of Object.entries(stock)){
  itemRef(id,'region.'+area);if(!Number.isInteger(count)||count<0)error('REGION_QUANTITY','region.'+area+'.'+id,'配置数は0以上の整数にしてください');
 }
 for(const [id,drone]of Object.entries(data.drones)){
  asset(drone.art,'drone.'+id+'.art');
  for(const area of drone.areas||[])areaRef(area,'drone.'+id+'.areas');
  for(const drop of drone.drops||[])itemRef(drop,'drone.'+id+'.drops');
 }
 for(const [area,url]of Object.entries(data.stageArt.backgrounds)){areaRef(area,'background.'+area);asset(url,'background.'+area)}
 for(const [id,url]of Object.entries(data.stageArt.characters)){if(!characters.has(id))error('UNKNOWN_CHARACTER','stageArt.'+id,'未登録のキャラID');asset(url,'stageArt.'+id)}
 for(const [name,ids]of Object.entries({edible:data.edible,generated:data.generated,randomOther:data.randomOther,...data.goals}))for(const id of ids)itemRef(id,'list.'+name);
 for(const [drone,tables]of Object.entries(data.droneTables)){
  if(!data.drones[drone])error('UNKNOWN_DRONE','droneTables.'+drone,'未登録のドローン');
  for(const table of tables)if(!data.supplyTables[table])error('UNKNOWN_SUPPLY_TABLE','droneTables.'+drone,'未登録の補給テーブル: '+table);
 }
 for(const table of data.startingTables)if(!data.supplyTables[table])error('UNKNOWN_SUPPLY_TABLE','startingTables','未登録の補給テーブル: '+table);
 for(const [weapon,goals]of Object.entries(data.goals))for(const goal of goals)if(items.has(goal)&&!items.get(goal).equipment)error('INVALID_COM_GOAL','goals.'+weapon,'装備目標に装備性能がありません: '+goal);
 // Reachability is advisory: special skills or future scripted rewards may provide additional sources.
 const obtainable=new Set([...Object.values(data.regions).flatMap(stock=>Object.keys(stock).filter(id=>stock[id]>0)),...Object.values(data.drones).flatMap(d=>d.drops||[]),...data.randomOther,...data.generated,...data.items.filter(i=>i.startingWeapon).map(i=>i.id),...data.items.filter(i=>i.equipment&&['common','uncommon'].includes(i.rarity||'common')).map(i=>i.id)]);
 let changed=true;while(changed){changed=false;for(const item of data.items)if(!obtainable.has(item.id)&&(item.recipes||[]).some(r=>Object.keys(r.need||{}).every(id=>obtainable.has(id)))){obtainable.add(item.id);changed=true}}
 for(const item of data.items)if(!obtainable.has(item.id))warn('NO_ACQUISITION_ROUTE','item.'+item.id,'配置・ドロップ・補給・素材からたどれる製作経路がありません（専用スキル等は別途確認）');
 return {counts:{characters:data.characters.length,skills:registeredSkills.size,items:data.items.length,recipes:data.items.reduce((n,i)=>n+(i.recipes?.length||0),0),images:assets.size,regions:regions.size},errors,warnings};
}
function main(args=process.argv.slice(2)){
 const root=path.resolve(__dirname,'..');let report;
 try{report=validateContent(loadContent(root),root)}catch(e){report={counts:{},errors:[{code:'GAME_LOAD',location:'index.html',message:e.message}],warnings:[]}}
 if(args.includes('--json'))console.log(JSON.stringify(report,null,2));
 else{
  console.log('Content validation:',Object.entries(report.counts).map(([k,v])=>k+'='+v).join(', '));
  for(const [severity,issues]of [['ERROR',report.errors],['WARN',report.warnings]])for(const issue of issues)console.log(severity+' ['+issue.code+'] '+issue.location+': '+issue.message);
  console.log(report.errors.length+' error(s), '+report.warnings.length+' warning(s)');
 }
 return report.errors.length||(args.includes('--strict')&&report.warnings.length)?1:0;
}
if(require.main===module)process.exitCode=main();
module.exports={loadContent,validateContent,main};
