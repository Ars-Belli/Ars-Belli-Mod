const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const GAME=P.GAME;
const tmpl=[...fs.readFileSync(path.join(GAME,'in_game/map_data/location_templates.txt'),'utf8').matchAll(/^([a-z0-9_]+)\s*=\s*\{/gm)].map(m=>m[1]);
const seen=new Set(); const out=[];
for(const f of process.argv.slice(2)){
 const s=P.openSave(path.join(dir,f));
 const countries=s.section('countries'), tags=countries.tags; const TAG=k=>tags[k]||k;
 const wm=s.section('war_manager');
 const wars=wm.database||wm; console.log(f.slice(0,26),'war keys',Object.keys(wm).slice(0,5).join(' '),'n',Object.keys(wars).length);
 for(const [wid,w] of Object.entries(wars)){
  if(!w||typeof w!=='object'||!w.battle) continue;
  for(const b of [].concat(w.battle)){
   const who=x=>[].concat(x.who||[]);
   const ids=[...who(b.attacker),...who(b.defender)].map(y=>+y.country);
   const key=wid+'|'+b.date+'|'+b.location;
   if(seen.has(key)) continue; seen.add(key);
   const num=a=>[].concat(a||[]).map(Number);
   const sum=a=>num(a).reduce((t,x)=>t+x,0);
   const fmt=a=>num(a).slice(0,6).map(x=>+x.toFixed(2)).join('/');
   const side=x=>({tags:who(x).map(y=>TAG(y.country)).join('+'),size:who(x).reduce((t,y)=>t+ +y.size,0),levy:who(x).reduce((t,y)=>t+ +(y.levy||0),0),total:fmt(x.total),losses:fmt(x.losses),lost:sum(x.losses),tot:sum(x.total)});
   const A=side(b.attacker),D=side(b.defender);
   out.push({wid,date:b.date,loc:tmpl[+b.location-1]||b.location,res:b.result,A,D,mor:ids.some(i=>TAG(i)==='MOR')});
  }
 }
}
const P2=x=>x.toFixed(2).padStart(6);
const key=d=>d.split('.').map((x,i)=>x.padStart(i?2:4,'0')).join('');
out.sort((a,b)=>key(a.date).localeCompare(key(b.date)));
const mine=out.filter(b=>b.mor);
console.log('battles total',out.length,'involving MOR',mine.length);
console.log('date        location          result  ATT (size/levy-field?) total cats li/hi/lc/hc/art.. | lost || DEF ...');
for(const b of mine) console.log(b.date.padEnd(10),b.loc.slice(0,16).padEnd(17),String(b.res).padEnd(4),b.A.tags.slice(0,10).padEnd(10),'tot',P2(b.A.tot),'['+b.A.total+']','lost',P2(b.A.lost),'||',b.D.tags.slice(0,10).padEnd(10),'tot',P2(b.D.tot),'['+b.D.total+']','lost',P2(b.D.lost));
fs.writeFileSync(path.join(__dirname,'mor_battles.json'),JSON.stringify(mine,null,1));
