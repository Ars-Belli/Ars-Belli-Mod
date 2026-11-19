const R=require('path').resolve(__dirname,'..','..')+'/';
const os=require('os');try{os.setPriority(os.constants.priority.PRIORITY_LOW);}catch{}
const S=require(R+'engine.js');S.setUnitDB(require(R+'units_1.3.11.json'));Object.assign(S.D,S.RULES_13);
const LOC={topography:'flatland',vegetation:'farmland'},G={adm:60,dip:59,mil:61};
const C={tactics:2.6,discipline:.27,moraleMod:.31,moraleFlat:.5,experience:.4,initiativeMod:.2,correctBoxChance:.2,combinedPerType:.025};
const A=(t,n)=>({name:t,general:G,country:C,units:[{type:t,count:n}]});
const N=+process.argv[2]||300;
const f=(a,b)=>{const x=S.monteCarloScenario({location:LOC,attacker:{armies:[a]},defender:{armies:[b]}},N,{seed:4}),y=S.monteCarloScenario({location:LOC,attacker:{armies:[b]},defender:{armies:[a]}},N,{seed:7004});return{w:(x.wins[0]+x.draws/2+y.wins[1]+y.draws/2)/(2*N),l:(x.losses[0]+y.losses[1])/2,k:(x.losses[1]+y.losses[0])/2,d:(x.days+y.days)/2};};
const t0=Date.now();
const show=(n,r)=>console.log(n.padEnd(46),(100*r.w).toFixed(0).padStart(3)+'%','men lost',r.l.toFixed(1)+'k/'+r.k.toFixed(1)+'k',r.d.toFixed(0)+' ticks');
show('Light Lancers vs Lancers, 30v30',f(A('a_light_lancers',30),A('a_lancers',30)));
show('Light Lancers vs Lancers, 36v36 (over W)',f(A('a_light_lancers',36),A('a_lancers',36)));
show('Light Lancers vs Lancers, 45 vs 30 (equal gold)',f(A('a_light_lancers',45),A('a_lancers',30)));
show('Pistoleers vs Heavy Lancers, 30v30',f(A('a_pistoleers',30),A('a_heavy_lancers',30)));
show('Pistoleers vs Heavy Lancers, 36v36',f(A('a_pistoleers',36),A('a_heavy_lancers',36)));
show('Arquebusiers vs Pikemen, 30v30',f(A('a_arquebusiers',30),A('a_pikemen',30)));
show('Arquebusiers vs Heavy Lancers, 30v30',f(A('a_arquebusiers',30),A('a_heavy_lancers',30)));
show('Pikemen vs Heavy Lancers, 30v30',f(A('a_pikemen',30),A('a_heavy_lancers',30)));
console.log(((Date.now()-t0)/1000).toFixed(1)+' s, one thread');
