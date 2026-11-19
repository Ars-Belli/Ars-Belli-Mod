const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
for(const [f,TAG] of [[process.argv[2],'MOR'],[process.argv[3],process.argv[4]]]){ if(!f) continue;
const s=P.openSave(path.join(dir,f));
const countries=s.section('countries'),tags=countries.tags; const id=Object.keys(tags).find(k=>tags[k]===TAG);
const c=countries.database[id];
const units=s.section('unit_manager').database, subs=s.section('subunit_manager').database;
console.log('\n##',f.slice(0,24),TAG,'date',s.date(),'budget',JSON.stringify(c.economy?.expense_sliders||c.economy?.sliders||'').slice(0,200),'keys',Object.keys(c.economy||{}).slice(0,25).join(' '));
const by={};
for(const x of Object.values(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id||!String(x.type).startsWith('a_')) continue; const k=x.type+(x.levies?'[L]':''); const b=by[k]=by[k]||{n:0,min:99,max:0,sum:0,exSamples:null}; const m=+x.morale||0; b.n++;b.min=Math.min(b.min,m);b.max=Math.max(b.max,m);b.sum+=m; if(!b.exSamples) b.exSamples=JSON.stringify(x).slice(0,420);}
for(const [k,b] of Object.entries(by)) console.log(k.padEnd(36),'n',String(b.n).padStart(4),'morale min',b.min.toFixed(2),'avg',(b.sum/b.n).toFixed(2),'max',b.max.toFixed(2));
console.log(Object.values(by).find(b=>/levies/.test(b.exSamples))?.exSamples);
const hist={}; for(const x of Object.values(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id||!String(x.type).startsWith('a_')||!x.levies) continue; const m=(+x.morale||0).toFixed(1); hist[m]=(hist[m]||0)+1;} console.log('levy morale hist',JSON.stringify(Object.fromEntries(Object.entries(hist).sort())));
}
