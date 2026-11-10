const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,'SP_SPA_1547_01_04_7f25c496-f283-4e84-b8b6-b35a16c851c9_0.eu5'));
const cs=s.section('countries'),tags=cs.tags,db=cs.database;
const units=s.section('unit_manager').database, subs=s.section('subunit_manager').database, chars=s.section('character_db');
const U=require(R+'units_1.3.11.json').units;
const adv=P.loadDb('in_game/common/advances');
const types=P.loadDb('in_game/common/unit_types');
const cm=s.section('culture_manager').database; const cn=x=>{const o=cm[x];return o?(o.culture_definition||x):x};
const rm=(()=>{try{return s.section('religion_manager').database}catch{return {}}})();
for(const T of ['SPA','LOT']){
 const id=Object.keys(tags).find(k=>tags[k]===T), c=db[id];
 console.log('\n##',T,'gov',c.government?.type,'culture',cn(c.primary_culture),'accepted',[].concat(c.accepted_cultures||[]).map(cn).join(','),'| religion',(rm[c.primary_religion]||{}).key||c.primary_religion,'| manpower max',(+c.max_manpower).toFixed(0)+'k cur',(+(c.currency_data?.manpower||0)).toFixed(0)+'k income',(+c.last_month_manpower_income).toFixed(2)+'k net',(+c.monthly_manpower).toFixed(2)+'k','| gold',(+(c.currency_data?.gold||0)).toFixed(0),'income',(+c.last_month_gold_income).toFixed(0),'army maint',(+c.last_months_army_maintenance).toFixed(0),'| tradition',(+(c.currency_data?.army_tradition||0)).toFixed(1),'pop',(+c.last_months_population||0).toFixed(0)+'k');
 const ra=Object.keys(c.researched_advances||{}); console.log(' advances',ra.length);
 const unl=[]; for(const a of ra){ const v=adv[a]; if(!v) continue; for(const [k,x] of v) if(k==='unlock_unit'&&String(x).startsWith('a_')) unl.push(x); }
 const age=u=>U[u]?.a||0; const list=unl.filter(u=>U[u]&&age(u)>=3).sort((a,b)=>age(a)-age(b)||U[a].c.localeCompare(U[b].c));
 console.log(' unlocked (age 3+):',list.map(u=>`${u}(${U[u].c}${age(u)})`).join(' '));
 const by={}; let m0=0,n0=0;
 for(const x of Object.values(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id||!String(x.type).startsWith('a_')) continue; const k=x.type; const b=by[k]=by[k]||{n:0,men:0,morMax:0,morSum:0,exp:0}; b.n++; b.men+=+x.strength||0; const mo=+x.morale||0; b.morMax=Math.max(b.morMax,mo); b.morSum+=mo; b.exp+=+x.experience||0; }
 for(const [k,b] of Object.entries(by)) console.log('  ',k.padEnd(26),'x'+String(b.n).padStart(3),'men',b.men.toFixed(1).padStart(6)+'k morale avg',(b.morSum/b.n).toFixed(2),'max',b.morMax.toFixed(2),'exp',(b.exp/b.n).toFixed(1));
 const ar=Object.entries(units).filter(([k,u])=>u&&+u.country===+id&&u.is_army==='yes'); const gens=[]; for(const [k,u] of ar){ if(u.leader&&chars.database?.[u.leader]){const h=chars.database[u.leader]; gens.push([h.adm,h.dip,h.mil].join('/')+(h.traits?(' '+[].concat(h.traits).slice(0,3).join(',')):''));} } console.log(' armies',ar.length,'generals',gens.join(' | ').slice(0,300));
}
