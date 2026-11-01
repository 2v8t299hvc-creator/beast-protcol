#!/usr/bin/env node
// Explicit scope: a successful maintained run never claims the pending audit passed.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),manifest=require('../tests/suites.json');
const files=fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.cjs')).sort();
const registered=[...Object.values(manifest.suites).flat(),...Object.keys(manifest.pendingReview)];
const missing=files.filter(x=>!registered.includes(x)),stale=registered.filter(x=>!files.includes(x));
if(missing.length||stale.length||new Set(registered).size!==registered.length){console.error('Test classification needs updating:',{missing,stale,duplicates:registered.length-new Set(registered).size});process.exit(2)}
const args=process.argv.slice(2);let selected=[],audit=false,list=false,dry=false;
for(let i=0;i<args.length;i++){
 const arg=args[i];
 if(arg==='--suite'){if(!args[i+1]){console.error('--suite requires a name');process.exit(2)}selected.push(...args[++i].split(','))}
 else if(arg==='--maintained')selected.push(...Object.keys(manifest.suites));
 else if(arg==='--audit')audit=true;
 else if(arg==='--list')list=true;
 else if(arg==='--dry-run')dry=true;
 else {console.error('Unknown option:',arg);process.exit(2)}
}
for(const name of selected)if(!manifest.suites[name]){console.error('Unknown suite:',name);process.exit(2)}
if(list){for(const [name,tests]of Object.entries(manifest.suites))console.log(`${name}: ${tests.length} files`);console.log(`pending review: ${Object.keys(manifest.pendingReview).length} files (included only with --audit)`);process.exit(0)}
selected=[...new Set(['smoke',...selected])];
const chosen=audit?files:[...new Set(selected.flatMap(name=>manifest.suites[name]))];
console.log(`${audit?'AUDIT (includes unresolved tests)':selected.join(', ')}: ${chosen.length} files; pending review: ${Object.keys(manifest.pendingReview).length}`);
if(dry){console.log(chosen.join('\n'));process.exit(0)}
const result=spawnSync(process.execPath,['--test','--test-concurrency=4',...chosen.map(x=>path.join(root,'tests',x))],{cwd:root,stdio:'inherit'});
if(result.error)console.error(result.error.message);process.exit(result.status??1);
