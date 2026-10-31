const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,process.argv[2]));
const t=s.sectionText('war_manager');
console.log('len',t.length,'country=1303 count',(t.match(/country=1303\b/g)||[]).length,'battle={',(t.match(/\tbattle=\{/g)||[]).length);
const countries=s.section('countries'); const id=Object.keys(countries.tags).find(k=>countries.tags[k]==='MOR'); console.log('MOR id',id);
const wm=s.section('war_manager').database;
let n=0; for(const [wid,w] of Object.entries(wm)){ if(!w||typeof w!=='object') continue; const txt=JSON.stringify(w); if(!txt.includes('"'+id+'"')) continue; n++; const bt=[].concat(w.battle||[]); console.log('WAR',wid,JSON.stringify(w.war_name||w.name||'').slice(0,90),'start',w.start_date,'end',w.end_date||'-','keys',bt.length,'att',JSON.stringify(w.all||'').slice(0,200)); if(n>14) break; }
const i=t.indexOf('country=1303'); console.log(t.slice(Math.max(0,i-700),i+300));
