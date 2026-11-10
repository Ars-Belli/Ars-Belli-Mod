const R=require('path').resolve(__dirname,'..','..')+'/';
const os=require('os');try{os.setPriority(os.constants.priority.PRIORITY_LOW);}catch{}
const S=require(R+'engine.js');S.setUnitDB(require(R+'units_1.3.11.json'));Object.assign(S.D,S.RULES_13);
const LOC={topography:'flatland',vegetation:'farmland'},C={tactics:2.6,discipline:.27,moraleMod:.31,moraleFlat:.5,experience:.4,initiativeMod:.2,correctBoxChance:.2,combinedPerType:.025};
const A=(t,n,g)=>({name:t,general:g,country:C,units:[{type:t,count:n}]}),N=500;
const f=(a,b)=>{const x=S.monteCarloScenario({location:LOC,attacker:{armies:[a]},defender:{armies:[b]}},N,{seed:4}),y=S.monteCarloScenario({location:LOC,attacker:{armies:[b]},defender:{armies:[a]}},N,{seed:7004});return (x.wins[0]+x.draws/2+y.wins[1]+y.draws/2)/(2*N);};
for(const dip of [30,59,82,100]){const g={adm:60,dip,mil:61};console.log('general dip',String(dip).padStart(3),'Light Lancers vs Lancers',(100*f(A('a_light_lancers',30,g),A('a_lancers',30,g))).toFixed(0)+'%');}
