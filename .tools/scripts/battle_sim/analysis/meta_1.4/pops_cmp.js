const fs=require('fs'),path=require('path');
const G='E:/Steam/steamapps/common/Europa Universalis V/game', M=require('path').resolve(__dirname,'..','..','..','..','..');
const find=(d,acc=[])=>{ for(const f of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,f.name); if(f.isDirectory()) find(p,acc); else if(/06_pops\.txt$/.test(f.name)) acc.push(p);} return acc; };
const files=[...find(path.join(G,'main_menu/setup')),...find(path.join(M,'main_menu/setup'))]; console.log(files);
function parseTotals(file){
 const t=fs.readFileSync(file,'latin1'); const totals={};
 // blocks: define_pop = { type = tribesmen size = 1.2 culture = sanhaja religion = ... }
 const re=/type\s*=\s*([a-z_]+)[^{}]*?size\s*=\s*([\d.]+)[^{}]*?culture\s*=\s*([a-z_]+)/g; let m,n=0;
 while((m=re.exec(t))){ const k=m[1]+'/'+m[3]; totals[k]=(totals[k]||0)+parseFloat(m[2]); n++; }
 return {n,totals};
}
const v=parseTotals(files[0]), mm=parseTotals(files[files.length-1]);
console.log('entries',v.n,mm.n);
const cult=['sanhaja','zenati','masmuda','tuareg','hassaniya','algerian','tunisian','kabyle','eastern_amazigh','moroccan'];
for(const c of cult){ for(const ty of ['tribesmen','peasants']){const k=ty+'/'+c; console.log(k.padEnd(28),'vanilla',(v.totals[k]||0).toFixed(1).padStart(9),'mod',(mm.totals[k]||0).toFixed(1).padStart(9));}}
let a=0,b=0; for(const [k,x] of Object.entries(v.totals)) if(k.startsWith('tribesmen/')) a+=x; for(const [k,x] of Object.entries(mm.totals)) if(k.startsWith('tribesmen/')) b+=x; console.log('all tribesmen vanilla',a.toFixed(0),'mod',b.toFixed(0));
