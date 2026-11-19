// real 1.3.11 battles from the campaign save, written to battles13.json for the validation
const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,'SP_SPA_1547_01_04_7f25c496-f283-4e84-b8b6-b35a16c851c9_0.eu5'));
const tags=s.section('countries').tags;
const tmpl={}; for(const m of fs.readFileSync(path.join(P.GAME,'in_game/map_data/location_templates.txt'),'utf8').matchAll(/^([a-z0-9_]+)\s*=\s*\{([^}]*)\}/gm)){const o={};for(const kv of m[2].matchAll(/(\w+)\s*=\s*(\w+)/g))o[kv[1]]=kv[2];tmpl[m[1]]=o;}
const keys=Object.keys(tmpl);
const wm=s.section('war_manager').database; const out=[]; let n=0;
const sample=[];
for(const [wid,w] of Object.entries(wm)){ if(!w||typeof w!=='object'||!w.battle) continue;
 for(const b of [].concat(w.battle)){ n++; const who=x=>[].concat(x.who||[]); const num=a=>[].concat(a||[]).map(Number);
  if(sample.length<1) sample.push(JSON.stringify(b).slice(0,500));
  const A={tot:num(b.attacker.total),lost:num(b.attacker.losses),tags:who(b.attacker).map(y=>tags[y.country]),levy:who(b.attacker).reduce((t,y)=>t+ +(y.levy||0),0),size:who(b.attacker).reduce((t,y)=>t+ +(y.size||0),0)};
  const D={tot:num(b.defender.total),lost:num(b.defender.losses),tags:who(b.defender).map(y=>tags[y.country]),levy:who(b.defender).reduce((t,y)=>t+ +(y.levy||0),0),size:who(b.defender).reduce((t,y)=>t+ +(y.size||0),0)};
  const k=keys[+b.location-1], t=tmpl[k]||{};
  out.push({date:b.date,loc:k,topo:t.topography,veg:t.vegetation,res:b.result,A,D});
 }}
console.log('battles',n,'kept',out.length); console.log(sample[0]);
const land=out.filter(b=>b.A.tot.slice(0,5).reduce((a,c)=>a+c,0)>0&&b.D.tot.slice(0,5).reduce((a,c)=>a+c,0)>0);
const years={}; for(const b of land){const y=String(b.date).slice(0,3)+'0s'; years[y]=(years[y]||0)+1;} console.log('land',land.length,JSON.stringify(years));
fs.writeFileSync(path.join(__dirname,'battles13.json'),JSON.stringify(land));
const big=land.filter(b=>{const a=b.A.tot.reduce((x,y)=>x+y,0),d=b.D.tot.reduce((x,y)=>x+y,0);return a>=3&&d>=3;}); console.log('both sides >=3k men:',big.length);
for(const b of big.slice(-6)) console.log(b.date,b.loc,b.topo,b.veg,'res',b.res,b.A.tags.join('+'),'tot',b.A.tot.slice(0,6).map(x=>+x.toFixed(1)).join('/'),'lost',b.A.lost.slice(0,6).map(x=>+x.toFixed(1)).join('/'),'levyf',b.A.levy.toFixed(1),'of',b.A.size.toFixed(1),'||',b.D.tags.join('+'),'tot',b.D.tot.slice(0,6).map(x=>+x.toFixed(1)).join('/'),'lost',b.D.lost.slice(0,6).map(x=>+x.toFixed(1)).join('/'));
