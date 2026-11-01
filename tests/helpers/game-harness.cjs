// Exercise registration through the real game script, including a hypothetical extra character.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../..');
const source=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function harness(extra=false,transform=s=>s){
 const elements=new Map();
 function element(){const classes=new Set();return {style:{},textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},prepend(x){this.children.unshift(x)},get lastChild(){return {remove:()=>this.children.pop()}},getAttribute(){return ''}}}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({document,Image:class {},getComputedStyle:()=>({backgroundImage:''}),setTimeout(){},clearTimeout(){},setInterval(){},console});
 const registration=`CHARACTER_DEFS.push({...CHARACTER_DEFS[0],id:'catalog_test',name:'登録テスト',emoji:'🐺',weapon:'gun',weaponTypes:['gun','bow'],initialMastery:{gun:20,bow:14},skills:{},skins:[{id:'default',name:'オリジナル',art:null},{id:'test_skin',name:'追加衣装',art:'assets/skins/hayate_hunter.webp'}]});\n`;
 vm.runInContext(transform(extra?source.replace('validateCharacterDefinitions(CHARACTER_DEFS);',registration+'validateCharacterDefinitions(CHARACTER_DEFS);'):source),context);
 return {run:s=>vm.runInContext(s,context),context};
}
module.exports={harness};
