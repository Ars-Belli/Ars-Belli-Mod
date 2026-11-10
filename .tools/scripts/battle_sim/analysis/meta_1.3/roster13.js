const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const U=require(R+'units_1.3.11.json').units, types=P.loadDb('in_game/common/unit_types'), adv=P.loadDb('in_game/common/advances');
const by={}; for(const [k,v] of Object.entries(adv)) for(const [x,y] of v) if(x==='unlock_unit'&&U[y]) (by[y]=by[y]||[]).push(k+'('+(P.get(v,'age')||'').replace('age_','').slice(0,1)+')');
const list=Object.entries(U).filter(([k,u])=>!u.levy&&u.a>=3&&u.a<=4&&u.c!=='aux');
const pot=k=>{const b=types[k]; if(!b) return ''; const cp=P.get(b,'country_potential'); return cp?JSON.stringify(cp).replace(/[\[\]"]/g,'').slice(0,120):'';};
for(const [k,u] of list.sort((a,b)=>a[1].a-b[1].a||a[1].c.localeCompare(b[1].c))){ const p=pot(k); const rel=/SPA|CAS|castil|iber|spani|LOT|burgund|lorrain|BUR|lothar|german|Reform|protest|luther/i.test(p); if(u.special&&!rel&&p) continue; console.log(k.padEnd(28),u.c.padEnd(3),'age',u.a,'p',u.p,'s',u.s,'sdd',u.sdd,'sdt',u.sdt,'mdd',u.mdd,'mdt',u.mdt,'i',u.i,'cs',u.cs,'|',(by[k]||['-']).join(',').slice(0,50),'|',p.slice(0,70)); }
