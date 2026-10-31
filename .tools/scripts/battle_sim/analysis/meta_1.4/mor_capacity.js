const path=require('path');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
for(const f of process.argv.slice(2)){
 const t0=Date.now();
 const s=P.openSave(path.join(dir,f));
 const countries=s.section('countries'), tags=countries.tags;
 const id=Object.keys(tags).find(k=>tags[k]==='MOR');
 const c=countries.database[id];
 console.log('\n#####',f.slice(0,28),s.constructor.name,s.date(),((Date.now()-t0)/1000).toFixed(0)+'s','meta rank?');
 if(!c){console.log('no MOR');continue;}
 const cm=s.section('culture_manager').database; const cn=x=>{const o=cm[x];return o?(o.culture_definition||x):x};
 const adv=Object.keys(c.researched_advances||{});
 console.log('gov',c.government.type,'primary',cn(c.primary_culture),'accepted',[].concat(c.accepted_cultures||[]).map(cn).join(','),'| tolerated',[].concat(c.tolerated_cultures||[]).map(cn).join(','));
 console.log('advances',adv.length,'levy:',adv.filter(a=>/sanhaja|zenata|hilali|kabyle|masmuda|feudalism_advance/.test(a)).join(' '));
 const privs=[].concat(c.government.implemented_privileges||[]).map(p=>p.object);
 console.log('priv',privs.filter(p=>/tribes|tribal|levy|mor_/.test(p)).join(' '));
 console.log('manpower max',c.max_manpower,'cur',(c.currency_data||{}).manpower,'income',c.last_month_manpower_income,'army tradition',(c.currency_data||{}).army_tradition);
 const locs=s.section('locations').locations, pops=s.section('population').database;
 const owned=[].concat(c.owned_locations||[]);
 const by={},byType={}; let tot=0;
 const estOf={};
 for(const l of owned){const L=locs[l]; if(!L) continue; for(const pid of [].concat(L.population?.pops||[])){const p=pops[pid]; if(!p) continue; const sz=+p.size||0; tot+=sz; byType[p.type]=(byType[p.type]||0)+sz; if(p.type==='tribesmen'||p.type==='nobles'){const k=p.type+'/'+cn(p.culture)+'/'+(p.status||'-'); by[k]=(by[k]||0)+sz;}}}
 console.log('owned locs',owned.length,'pop(k)',tot.toFixed(0),Object.entries(byType).map(([k,v])=>k+' '+v.toFixed(0)).join(', '));
 console.log(Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>k+' '+v.toFixed(1)).join(' | '));
 const pdb=s.section('provinces').database; let cur=0,max=0;
 for(const o of Object.values(pdb)){ if(!o||!o.army_levies) continue; const e=o.army_levies[id]; if(e){cur+=+e.current||0;max+=+e.max||0;} }
 console.log('province army_levies total: current',cur.toFixed(2),'max',max.toFixed(2),'(thousands)');
 const units=s.section('unit_manager').database, subs=s.section('subunit_manager').database;
 const b={}; for(const x of Object.values(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id||!String(x.type).startsWith('a_')) continue; const k=x.type+(x.levies?' [levy]':''); const g=b[k]=b[k]||{n:0,men:0}; g.n++; g.men+=+x.strength||0; }
 console.log('FIELDED',Object.entries(b).map(([k,v])=>k+' x'+v.n+' ('+v.men.toFixed(1)+'k)').join(', ')||'none');
}
