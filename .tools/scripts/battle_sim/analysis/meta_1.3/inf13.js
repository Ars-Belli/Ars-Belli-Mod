const R=require('path').resolve(__dirname,'..','..')+'/';
process.env.EU5_UNITS=R+'units_1.3.11.json';
const S=require(R+'engine.js');S.setUnitDB(require(process.env.EU5_UNITS));const pool=require(R+'pool.js')();
const PATCH={D:S.RULES_13},LOC={topography:'flatland',vegetation:'farmland'};
const C={tactics:2.85,discipline:.27,moraleMod:.31,moraleFlat:.8,experience:.4,initiativeMod:.2,correctBoxChance:.3,combinedPerType:.035};
const G={adm:60,dip:59,mil:61};
const A=(t,n)=>({name:t,general:G,country:C,units:[{type:t,count:n}]});
const fight=async(a,b,n=800)=>{const [x,y]=await Promise.all([pool.mc({location:LOC,attacker:{armies:[a]},defender:{armies:[b]}},n,{seed:9,patch:PATCH}),pool.mc({location:LOC,attacker:{armies:[b]},defender:{armies:[a]}},n,{seed:500009,patch:PATCH})]);return{win:(x.wins[0]+x.draws/2+y.wins[1]+y.draws/2)/(2*n),lost:(x.losses[0]+y.losses[1])/2,killed:(x.losses[1]+y.losses[0])/2,days:(x.days+y.days)/2};};
(async()=>{
 const P=[['a_pikemen','a_heavy_lancers'],['a_arquebusiers','a_heavy_lancers'],['a_tercio','a_heavy_lancers'],['a_pikemen','a_pistoleers'],['a_arquebusiers','a_pistoleers']];
 console.log('infantry win rate (same stats both sides, no unit power bonus):');
 for(const [a,b] of P){ const r30=await fight(A(a,30),A(b,30)), r38=await fight(A(a,30),A(b,38)), r60=await fight(A(a,60),A(b,60));
  console.log(`  ${a.padEnd(15)} vs ${b.padEnd(16)} 30v30 ${(100*r30.win).toFixed(0).padStart(3)}% (men lost ${r30.lost.toFixed(0)}k/${r30.killed.toFixed(0)}k) | equal manpower 30v38 ${(100*r38.win).toFixed(0).padStart(3)}% (${r38.lost.toFixed(0)}k/${r38.killed.toFixed(0)}k) | 60v60 ${(100*r60.win).toFixed(0).padStart(3)}%`);}
 const m=await fight({...A('a_pikemen',15),units:[{type:'a_pikemen',count:15},{type:'a_arquebusiers',count:15}]},A('a_heavy_lancers',30));console.log(`  15 pikemen + 15 arquebusiers vs 30 heavy lancers ${(100*m.win).toFixed(0)}%`);
 await pool.close();
})();
