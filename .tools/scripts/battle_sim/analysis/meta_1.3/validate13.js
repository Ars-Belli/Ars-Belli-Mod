// real 1.3.11 battles against the simulator: node validate13.js 1.3|1.4
const R=require('path').resolve(__dirname,'..','..')+'/';
const S=require(R+'engine.js'); const rules=process.argv[2]||'1.3';
if(rules==='1.3') process.env.EU5_UNITS=R+'units_1.3.11.json'; else delete process.env.EU5_UNITS;
S.setUnitDB(require(process.env.EU5_UNITS||R+'units.json'));
const pool=require(R+'pool.js')(); const PATCH=rules==='1.3'?{D:S.RULES_13}:undefined;
const B=require(__dirname+'/battles13.json');
const big=B.filter(b=>{const a=b.A.tot.reduce((x,y)=>x+y,0),d=b.D.tot.reduce((x,y)=>x+y,0);return a>=3&&d>=3;});
const types=['a_early_arquebusiers','a_halberdiers','a_light_lancers','a_lancers','a_falconet','a_supply_convoy'];
const base={tactics:2.6,discipline:.27,moraleMod:.457,moraleFlat:.5,experience:.4,frontageMod:.06,correctBoxChance:.3};
const side=tot=>{const units=[];types.forEach((t,i)=>{const n=Math.round((tot[i]||0)/S.unitStats(t).s);if(n>0)units.push({type:t,count:n});});return {name:'x',general:{adm:60,dip:59,mil:61},country:base,units};};
(async()=>{
 let brier=0,hit=0,n=0; const rows=[]; const sum=(a,k)=>a.reduce((t,x)=>t+x[k],0)/a.length;
 const res=await Promise.all(big.map(async b=>{const sc={location:{topography:b.topo,vegetation:b.veg},attacker:{armies:[side(b.A.tot)]},defender:{armies:[side(b.D.tot)]}};const m=await pool.mc(sc,300,{seed:3,patch:PATCH});return{b,m};}));
 for(const {b,m} of res){ const p=(m.wins[0]+m.draws/2)/m.n, y=b.res==='yes'?1:0; brier+=(p-y)**2; hit+=(p>=.5)===(y===1)?1:0; n++;
  const ma=b.A.tot.reduce((x,c)=>x+c,0), md=b.D.tot.reduce((x,c)=>x+c,0), la=b.A.lost.reduce((x,c)=>x+c,0), ld=b.D.lost.reduce((x,c)=>x+c,0);
  const realLoser=y?ld/md:la/ma, realWinner=y?la/ma:ld/md; const simA=m.losses[0]/ma, simD=m.losses[1]/md;
  rows.push({realLoser,realWinner,simLoser:y?simD:simA,simWinner:y?simA:simD,days:m.days,p,y,ma,md,la,ld,sa:m.losses[0],sd:m.losses[1]}); }
 const c=rows.filter(r=>Math.max(r.ma,r.md)/Math.min(r.ma,r.md)<1.6); // close fights: numbers alone do not decide them
 const corr=(a,f,g)=>{const x=a.map(f),y=a.map(g),mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;let sxy=0,sxx=0,syy=0;x.forEach((v,i)=>{sxy+=(v-mx)*(y[i]-my);sxx+=(v-mx)**2;syy+=(y[i]-my)**2;});return sxy/Math.sqrt(sxx*syy);};
 console.log(`rules ${rules}: ${n} battles. winner predicted ${hit}/${n}, Brier ${(brier/n).toFixed(3)} (always 50% = 0.250)`);
 console.log(`  loser's share of men lost: real ${(100*sum(rows,'realLoser')).toFixed(0)}%, simulated ${(100*sum(rows,'simLoser')).toFixed(0)}%. winner's: real ${(100*sum(rows,'realWinner')).toFixed(0)}%, simulated ${(100*sum(rows,'simWinner')).toFixed(0)}%`);
 console.log(`  men lost, correlation with reality across sides: ${corr(rows.flatMap(r=>[{a:r.la,b:r.sa},{a:r.ld,b:r.sd}]),x=>x.a,x=>x.b).toFixed(3)}; mean ratio simulated/real ${(rows.flatMap(r=>[r.sa,r.sd]).reduce((s,v)=>s+v,0)/rows.flatMap(r=>[r.la,r.ld]).reduce((s,v)=>s+v,0)).toFixed(2)}; simulated length ${sum(rows,'days').toFixed(0)} ${rules==='1.3'?'ticks':'days'}`);
 console.log(`  close fights only (${c.length}, numbers within 1.6:1): loser ${(100*sum(c,'realLoser')).toFixed(0)}% real, ${(100*sum(c,'simLoser')).toFixed(0)}% sim; winner ${(100*sum(c,'realWinner')).toFixed(0)}% real, ${(100*sum(c,'simWinner')).toFixed(0)}% sim`);
 await pool.close();
})();
