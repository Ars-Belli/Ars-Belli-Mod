const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,'SP_SPA_1547_01_04_7f25c496-f283-4e84-b8b6-b35a16c851c9_0.eu5'));
console.log(s.constructor.name,s.date(),Object.keys(s.sections).length,'sections');
const cs=s.section('countries'),tags=cs.tags,db=cs.database;
const units=s.section('unit_manager').database, subs=s.section('subunit_manager').database;
const U=require(R+'units_1.3.11.json').units;
const nm=c=>{const n=c.country_name; return typeof n==='object'?(n.name||JSON.stringify(n)):n;};
const by={};
for(const x of Object.values(subs)){ if(!x||!String(x.type).startsWith('a_')) continue; const u=units[x.unit]; if(!u) continue; const k=u.country; const b=by[k]=by[k]||{regs:0,men:0,types:{},armies:new Set()}; b.regs++; b.men+=+x.strength||0; b.armies.add(x.unit); const key=x.type+(x.levies?'[L]':'')+(x.mercenary?'[M]':''); b.types[key]=(b.types[key]||0)+1; }
const rows=Object.entries(by).map(([k,b])=>({k,tag:tags[k],regs:b.regs,men:b.men,arm:b.armies.size,types:b.types})).sort((a,b)=>b.men-a.men);
console.log('top armies by men:'); for(const r of rows.slice(0,14)) console.log(String(r.tag).padEnd(7),'regs',String(r.regs).padStart(4),'men',r.men.toFixed(0).padStart(4)+'k','armies',String(r.arm).padStart(3),Object.entries(r.types).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>t+'x'+n).join(' ').slice(0,105));
for(const T of ['SPA','ABLOM']){ const id=Object.keys(tags).find(k=>tags[k]===T); const c=db[id]; console.log('\n##',T,'id',id,'name',JSON.stringify(c.country_name).slice(0,70),'gov',c.government?.type,'capital',c.capital,'culture',c.primary_culture,'manpower max',c.max_manpower,'cur',c.currency_data?.manpower,'income',c.last_month_manpower_income,'net',c.monthly_manpower,'gold',c.currency_data?.gold,'gold income',c.last_month_gold_income,'tradition',c.currency_data?.army_tradition);
 const r=rows.find(x=>x.k===id); console.log(' armies:',r?JSON.stringify(r.types):'none'); }
const miss=new Set(); for(const r of rows) for(const t of Object.keys(r.types)) { const k=t.replace(/\[.\]/g,''); if(!U[k]) miss.add(k); } console.log('\nunit types not in units_1.3.11.json:',[...miss].slice(0,20).join(' ')||'none');
