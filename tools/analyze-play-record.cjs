// Usage: node tools/analyze-play-record.cjs BEAST_PROTOCOL_play_....json
// Offline only. This reads observations and does not modify the game or its COM.
const fs=require('node:fs');
function analyze(record){
 if(record?.schemaVersion!==1||!Array.isArray(record.events)||!Array.isArray(record.states))throw Error('Unsupported play-record format');
 const names=record.dictionary?.items||{},rarities=record.dictionary?.rarities||{},label=id=>names[id]||id;
 const stateAt=e=>record.states[e.after];
 const elapsed=Math.max(0,...record.events.map(e=>e.ms));
 function build(s){return {level:s.level,weapon:label(s.equipment?.weapon||'unarmed'),weaponRarity:rarities[s.equipment?.weapon]||null,defense:s.defense,attack:s.attack,armorSlots:['head','arm','body','legs'].filter(k=>s.equipment?.[k]).length}}
 function milestone(test){const e=record.events.find(e=>stateAt(e)&&test(stateAt(e)));return e?{seconds:Math.round(e.ms/1000),...build(stateAt(e))}:null}
 const actions=record.events.filter(e=>e.kind==='action'),counts={};for(const e of actions)counts[e.data.action]=(counts[e.data.action]||0)+1;
 const moves=actions.filter(e=>e.data.action==='move').map(e=>e.data.startedMs??e.ms).sort((a,b)=>a-b),gaps=moves.slice(1).map((t,i)=>t-moves[i]).sort((a,b)=>a-b);
 const checkpoints=record.comCheckpoints||[];
 const comparisons=[300,600,900,1200].filter(t=>t*1000<=elapsed).map(seconds=>{
  const cutoff=seconds*1000,p=record.events.filter(e=>e.ms<=cutoff&&stateAt(e)).at(-1),c=checkpoints.filter(c=>c.ms<=cutoff).at(-1);
  return {seconds,player:p?build(stateAt(p)):null,com:(c?.actors||[]).map(a=>({name:a.id,alive:a.alive,...build(a)}))};
 });
 return {build:record.build,character:record.character,status:record.status,result:record.result||null,elapsedSeconds:Math.round(elapsed/1000),truncated:!!record.truncated,
  milestones:{rareWeapon:milestone(s=>['rare','epic','legendary'].includes(rarities[s.equipment?.weapon])),epicWeapon:milestone(s=>['epic','legendary'].includes(rarities[s.equipment?.weapon])),allArmorSlots:milestone(s=>['head','arm','body','legs'].every(k=>s.equipment?.[k]))},
  actionCounts:counts,movementGapSeconds:gaps.length?{minimum:gaps[0]/1000,median:gaps[Math.floor(gaps.length/2)]/1000,samples:gaps.length}:null,comparisons,
  note:'Action timings include operation time and deliberate waits. These observations do not identify intent or prove that a particular choice caused victory.'};
}
module.exports={analyze};
if(require.main===module){try{console.log(JSON.stringify(analyze(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
