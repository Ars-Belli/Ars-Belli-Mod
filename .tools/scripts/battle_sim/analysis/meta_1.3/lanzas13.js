const R=require('path').resolve(__dirname,'..','..')+'/';
process.env.EU5_UNITS=R+'units_1.3.11.json';
const S=require(R+'engine.js');S.setUnitDB(require(process.env.EU5_UNITS));const pool=require(R+'pool.js')();
const PATCH={D:S.RULES_13},LOC={topography:'flatland',vegetation:'farmland'};
const C={tactics:2.6,discipline:.27,moraleMod:.31,moraleFlat:.5,experience:.4,initiativeMod:.2,correctBoxChance:.2,combinedPerType:.025};
const G={adm:60,dip:59,mil:61};
const A=(t,n,c=C)=>({name:t,general:G,country:c,units:[{type:t,count:n}]});
const fight=async(a,b,n=800)=>{const [x,y]=await Promise.all([pool.mc({location:LOC,attacker:{armies:[a]},defender:{armies:[b]}},n,{seed:9,patch:PATCH}),pool.mc({location:LOC,attacker:{armies:[b]},defender:{armies:[a]}},n,{seed:500009,patch:PATCH})]);return{win:(x.wins[0]+x.draws/2+y.wins[1]+y.draws/2)/(2*n),lost:(x.losses[0]+y.losses[1])/2,killed:(x.losses[1]+y.losses[0])/2};};
const up=t=>S.unitStats(t).pr.m[1]*S.unitStats(t).s;
(async()=>{
 const SPA={...C,power:{hc:.1,lc:.1}};
 console.log('Lanzas de Castilla win rate:');
 for(const inf of ['a_early_arquebusiers','a_arquebusiers','a_halberdiers','a_pikemen']){
  const eq=Math.round(30*up(inf)/up('a_lanzas_de_castilla'));
  const a=await fight(A('a_lanzas_de_castilla',30),A(inf,30)), b=await fight(A('a_lanzas_de_castilla',30,SPA),A(inf,30)), c=await fight(A('a_lanzas_de_castilla',60,SPA),A(inf,60)), d=await fight(A('a_lanzas_de_castilla',eq,SPA),A(inf,30));
  console.log(`  vs ${inf.padEnd(22)} neutral ${(100*a.win).toFixed(0).padStart(3)}% | Spain +10% power ${(100*b.win).toFixed(0).padStart(3)}% (men lost ${b.lost.toFixed(0)}k/${b.killed.toFixed(0)}k) | 60v60 ${(100*c.win).toFixed(0).padStart(3)}% | equal manpower ${eq}v30 ${(100*d.win).toFixed(0).padStart(3)}%`);}
 await pool.close();
})();
