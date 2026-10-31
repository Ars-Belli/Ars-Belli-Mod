const path=require('path');
const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,'SP_SPA_1547_01_04_7f25c496-f283-4e84-b8b6-b35a16c851c9_0.eu5'));
const cs=s.section('countries'),tags=cs.tags,db=cs.database,units=s.section('unit_manager').database,subs=s.section('subunit_manager').database,ch=s.section('character_db').database;
const U=require(R+'units_1.3.11.json').units, adv=P.loadDb('in_game/common/advances');
for(const T of ['SPA','LOT']){ const id=Object.keys(tags).find(k=>tags[k]===T),c=db[id];
 const A={}; for(const x of Object.values(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id||!String(x.type).startsWith('a_')) continue; const a=A[x.unit]=A[x.unit]||{n:0,men:0,max:0,min:9,leader:u.leader,loc:u.location,pref:u.unit_formation_preference}; a.n++; a.men+=+x.strength||0; const m=+x.morale||0; a.max=Math.max(a.max,m); a.min=Math.min(a.min,m); }
 console.log('##',T); for(const a of Object.values(A)){ const h=a.leader&&ch[a.leader]; console.log('  regs',String(a.n).padStart(3),'men',a.men.toFixed(1).padStart(5)+'k morale',a.min.toFixed(2),'-',a.max.toFixed(2),'leader',h?[h.adm,h.dip,h.mil].map(x=>(+x||0).toFixed(0)).join('/'):'none',a.pref); }
 const ra=Object.keys(c.researched_advances||{}); const unl=[]; for(const a of ra){const v=adv[a]; if(!v) continue; for(const [k,x] of v) if(k==='unlock_unit'&&String(x).startsWith('a_')&&U[x]&&U[x].a>=2&&U[x].c!=='aux') unl.push(`${x}(${U[x].c}${U[x].a})`);} console.log('  unlocked age2+:',unl.join(' '));
 const pc=c.primary_culture, cm=s.section('culture_manager').database[pc]; console.log('  culture',cm?.culture_definition, Object.keys(cm||{}).slice(0,14).join(' ').slice(0,120));
}
