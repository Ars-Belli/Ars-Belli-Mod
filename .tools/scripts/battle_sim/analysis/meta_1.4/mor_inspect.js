const path=require('path');
const P=require('../../paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const file=path.join(dir,process.argv[2]||'SP_MOR_1372_06_01_7c79e0a2-7da9-479b-a52b-4989855aca25.eu5');
const TAG=process.argv[3]||'MOR';
const t0=Date.now();
const s=P.openSave(file);
console.log(s.constructor.name,'date',s.date(),((Date.now()-t0)/1000).toFixed(1)+'s');
const countries=s.section('countries');
const tags=countries.tags;
const id=Object.keys(tags).find(k=>tags[k]===TAG);
console.log('id',id);
const c=countries.database[id];
console.log(Object.keys(c).join(' ').slice(0,1500));
const g=c.government||{};
console.log('gov keys',Object.keys(g).join(' ').slice(0,600));
console.log('type',g.type,'reforms',JSON.stringify(g.reforms||g.implemented_reforms||'').slice(0,400));
console.log('privs',JSON.stringify(g.implemented_privileges||'').slice(0,800));
console.log('laws',JSON.stringify(g.implemented_laws||'').slice(0,600));
console.log('manpower',c.max_manpower,c.monthly_manpower,c.last_month_manpower_income,(c.currency_data||{}).manpower, 'culture',c.primary_culture, c.primary_religion, 'age?',c.current_age);
console.log('n locations',[].concat(c.owned_locations||[]).length);
const um=s.section('unit_manager'); const sm=s.section('subunit_manager');
console.log('um keys',Object.keys(um).join(' ').slice(0,200),'sm keys',Object.keys(sm).join(' ').slice(0,200));
const units=um.database, subs=sm.database;
const mine=Object.entries(units).filter(([k,u])=>u&&+u.country===+id);
console.log('units',mine.length);
for(const [k,u] of mine){
  console.log('UNIT',k,Object.keys(u).join(' ').slice(0,300));
  console.log('  loc',u.location,'leader',u.leader,'is_army',u.is_army,'levy?',JSON.stringify(u.levies||u.levy||null).slice(0,100), 'pref',u.unit_formation_preference);
}
const bySub={};
let nn=0;
for(const [k,x] of Object.entries(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id) continue; if(nn++<2) console.log('SUB',k,JSON.stringify(x).slice(0,500));
 const key=x.type+(x.levies?' [levy]':''); const b=bySub[key]=bySub[key]||{n:0,men:0,minS:9,maxS:0}; b.n++; const st=+x.strength||0; b.men+=st; b.minS=Math.min(b.minS,st); b.maxS=Math.max(b.maxS,st);}
console.table(bySub);
