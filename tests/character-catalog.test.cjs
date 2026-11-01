// Exercise registration through the real game script, including a hypothetical extra character.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const source=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(extra=false){
 const elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},getComputedStyle:()=>({backgroundImage:''}),setTimeout(){},clearTimeout(){},setInterval(){},console});
 const registration=`CHARACTER_DEFS.push({...CHARACTER_DEFS[0],id:'catalog_test',name:'登録テスト',emoji:'🐺',weapon:'gun',weaponTypes:['gun','bow'],initialMastery:{gun:20,bow:14},skills:{},skins:[{id:'default',name:'オリジナル',art:null},{id:'test_skin',name:'追加衣装',art:'assets/skins/hayate_hunter.webp'}]});\n`;
 vm.runInContext(extra?source.replace('validateCharacterDefinitions(CHARACTER_DEFS);',registration+'validateCharacterDefinitions(CHARACTER_DEFS);'):source,context);
 return {run:s=>vm.runInContext(s,context),context};
}
let {run}=harness();
assert.equal(run('validateCharacterDefinitions(CHARACTER_DEFS)'),true);
for(const asset of run('CHARACTER_DEFS.flatMap(c=>[c.art,...c.skins.map(s=>s.art),...Object.values(c.skills).map(s=>s.icon)]).filter(Boolean)'))assert(fs.existsSync(path.join(root,asset)),asset);
for(const edit of ["defs.push(defs[0])","defs[0].statTargets.pop()","defs[0].skins.push(defs[0].skins[0])","defs[0].skills.active.icon=''","defs[0].weaponTypes=['invalid']"]){
 assert.throws(()=>run(`(()=>{const defs=JSON.parse(JSON.stringify(CHARACTER_DEFS));${edit};return validateCharacterDefinitions(defs)})()`));
}
({run}=harness(true));
assert.equal(run('COM_COUNT'),10);
run("showCharacterSelection('catalog_test')");
assert(run("$('characterSelectContent').innerHTML.includes('登録テスト')"));
assert.equal(run("actorArt({character:'catalog_test'})"),run('CHARACTER_DEFS[0].art'));
assert.equal(run("actorArt({character:'catalog_test',skin:'test_skin'})"),'assets/skins/hayate_hunter.webp');
assert.equal(run("JSON.stringify(comWeaponTypes({character:'catalog_test'}))"),'["gun","bow"]');
assert.equal(run("initialMastery('catalog_test').gun"),20);
run("selectedCharacter='kaito';startSelectedCharacter()");
assert.equal(run('comActors.length'),10);
assert.equal(run("comActors.filter(a=>a.character==='catalog_test').length"),1);
assert.equal(run("comActors.some(a=>a.character==='kaito')"),false);
({run}=harness(true));
run("selectedCharacter='catalog_test';startSelectedCharacter()");
assert.equal(run('S.character'),'catalog_test');
assert.equal(run('S.masteryAttacks.gun'),20);
assert.equal(run('comActors.length'),10);
assert.equal(run("comActors.some(a=>a.character==='catalog_test')"),false);
console.log('PASS: catalog validation, artwork paths, extra-character selection, skins, mastery, weapons, player initialization and complete COM roster');
module.exports={harness};
