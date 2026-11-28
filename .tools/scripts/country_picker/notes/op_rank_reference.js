// Rank start countries by the summed strength of the content gated to them (tag, culture, group, region).
// Scopes: plain, "Always", "Well funded, up to" (bureaucracies at full funding). Local/location scopes skipped.
// Laws: one policy per law, so per modifier the best policy of each law. Bureaucracies: only as many as the
// country has slots (Reformation +1, Revolutions +1, plus its own slot advances), best per modifier.
const d=require(process.argv[2]);const N=d.mods.map(m=>m[0]);const idx=n=>{const i=N.indexOf(n);if(i<0)throw n;return i;};
const W=(list)=>{const o={};for(const [n,w] of list){N.forEach((x,i)=>{if(x===n)o[i]=w;});}return o;};
const MIL=W([["Discipline",100],["Army Morale",50],["Military Tactics",25],["Light Cavalry Power",33],["Heavy Infantry Power",33],["Heavy Cavalry Power",33],["Artillery Power",33],["Light Infantry Power",33],["Manpower",25],["Levy Combat Efficiency",20],["Levy Size",10],["Army Levy Size",10],["Army Maintenance Efficiency",25],["Mercenary Maintenance Efficiency",5],["Heavy Cavalry Maintenance Cost",-8],["Light Cavalry Maintenance Cost",-8],["Artillery Maintenance Cost",-8],["Heavy Infantry Maintenance Cost",-8],["Light Infantry Maintenance Cost",-8]]);
const ECO=W([["Tax Efficiency",50],["Production Efficiency",50],["Monthly Research Progress %",30],["Trade Capacity %",10],["Trade Advantage",10],["Buildings Construction Efficiency",10],["Maximum RGO Size",10],["Max Control",30],["Monthly Control",500]]);
const I=n=>N.indexOf(n);
const SLOTS=idx("Max Bureaucracy Slots");
const out=[];
for(const c of d.countries){
  const OWN=new Set(c.refs.filter(r=>!r[2]).map(r=>d.items[r[0]]).filter(it=>it.t==="ref"||it.t==="priv").map(it=>it.n));
  const plain=new Map(), law=new Map(), bur=[]; let slots=Infinity; const contrib=new Map();
  for(const r of c.refs){const it=d.items[r[0]];if(r[2]&&process.env.STRICT&&!r[2].split("one of: ").join("").split(" / ").join("; ").split(" and ").join("; ").split("; ").every(p=>{p=p.trim();if(p.startsWith("Advance: ")||p.startsWith("Age: ")||p.startsWith("Institution: "))return true;const m=p.match(/^(Reform|Privilege): (.*)$/);return !!(m&&OWN.has(m[2]));}))continue;if(!it.mv&&!it.mc)continue;it.mv=it.mv||[];
    const vals=(it.mv||[]).filter(([m,s])=>s===0||s===2||s===3).concat((it.mc||[]).filter(([m,s,v,ci])=>(s===0||s===2||s===3)&&/^not Reform: /.test(it.cd[ci])).map(([m,s,v])=>[m,s,v]));
   
    if(it.t==="bur"){bur.push({it,vals});continue;}
    if(it.t==="pol"){const L=it.x||it.id;if(!law.has(L))law.set(L,new Map());const lm=law.get(L);for(const [m,,v] of vals){const o=lm.get(m);if(!o||v>o.v)lm.set(m,{v,it});}continue;}
    for(const [m,,v] of vals){plain.set(m,(plain.get(m)||0)+v);if(MIL[m]||ECO[m])contrib.set(it.id,(contrib.get(it.id)||0)+v*(MIL[m]||ECO[m]));}
  }
  for(const lm of law.values())for(const [m,{v,it}] of lm){plain.set(m,(plain.get(m)||0)+v);if(MIL[m]||ECO[m])contrib.set(it.id,(contrib.get(it.id)||0)+v*(MIL[m]||ECO[m]));}
  const byMod=new Map();for(const b of bur)for(const [m,s,v0] of b.vals){const v=s===3?v0*(+process.env.BURX||1):v0;if(!byMod.has(m))byMod.set(m,[]);byMod.get(m).push({v,id:b.it.id});}
  for(const [m,arr] of byMod){arr.sort((a,b)=>b.v-a.v);for(const {v,id} of arr.slice(0,slots)){plain.set(m,(plain.get(m)||0)+v);if(MIL[m]||ECO[m])contrib.set(id,(contrib.get(id)||0)+v*(MIL[m]||ECO[m]));}}
  let mil=0,eco=0;for(const [m,v] of plain){if(MIL[m])mil+=v*MIL[m];if(ECO[m])eco+=v*ECO[m];}
  out.push({tag:c.tag,n:c.n,locs:c.locs,gov:c.gov,ovl:c.ovl?c.ovl.tag:"",mil,eco,disc:plain.get(I("Discipline"))||0,mor:N.reduce((s,n,i)=>n==="Army Morale"?s+(plain.get(i)||0):s,0),mp:plain.get(I("Manpower"))||0,tax:plain.get(I("Tax Efficiency"))||0,prod:plain.get(I("Production Efficiency"))||0,tac:plain.get(I("Military Tactics"))||0,ame:plain.get(I("Army Maintenance Efficiency"))||0,top:[...contrib].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,s])=>{const it=d.items.find(i=>i.id===id);return (it?it.n:id)+"="+s.toFixed(1)+(it&&it.m?"*":"")})});
}
const f=x=>x.toFixed(1);const pct=x=>(x*100).toFixed(1)+"%";
const big=out.filter(o=>o.locs>=8&&!o.ovl);
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
console.log("independent countries with 8+ locations:",big.length,"median mil",f(med(big.map(o=>o.mil))),"median eco",f(med(big.map(o=>o.eco))));
for(const [k,label] of [["mil","MILITARY"],["eco","ECONOMY"]]){console.log("\n== "+label+" top 30 (independent, 8+ locations)");
 for(const o of [...big].sort((a,b)=>b[k]-a[k]).slice(0,30))console.log(o.tag.padEnd(6),o.n.slice(0,22).padEnd(23),String(o.locs).padStart(3),"mil",f(o.mil).padStart(6),"eco",f(o.eco).padStart(6),"disc",pct(o.disc),"mor",pct(o.mor),"mp",pct(o.mp),"tax",pct(o.tax),"prod",pct(o.prod),"|",o.top.join("; "));}
console.log("\n== MILITARY top 15, any size/subjects");for(const o of [...out].sort((a,b)=>b.mil-a.mil).slice(0,15))console.log(o.tag.padEnd(6),o.n.slice(0,22).padEnd(23),String(o.locs).padStart(3),o.ovl.padEnd(4),"mil",f(o.mil),"disc",pct(o.disc),"mor",pct(o.mor),"|",o.top.slice(0,3).join("; "));
require("fs").writeFileSync(process.argv[3],JSON.stringify(out));
