const R=require('path').resolve(__dirname,'..','..')+'/';
const os=require('os');try{os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);}catch{}
const S=require(R+'engine.js');S.setUnitDB(require(R+'units_1.3.11.json'));Object.assign(S.D,S.RULES_13);
const B=require(__dirname+'/battles13.json').filter(b=>{const a=b.A.tot.reduce((x,y)=>x+y,0),d=b.D.tot.reduce((x,y)=>x+y,0);return a>=3&&d>=3;});
const types=['a_early_arquebusiers','a_halberdiers','a_light_lancers','a_lancers','a_falconet','a_supply_convoy'];
const base={tactics:2.6,discipline:.27,moraleMod:.457,moraleFlat:.5,experience:.4,frontageMod:.06,correctBoxChance:.3};
const side=(tot,m)=>{const units=[];types.forEach((t,i)=>{const n=Math.round((tot[i]||0)/S.unitStats(t).s);if(n>0)units.push({type:t,count:n});});return{name:'x',morale:m,general:{adm:60,dip:59,mil:61},country:base,units};};
for(const M of [1,.7]){let br=0,hit=0;const r=[];for(const b of B){const m=S.monteCarloScenario({location:{topography:b.topo,vegetation:b.veg},attacker:{armies:[side(b.A.tot,M)]},defender:{armies:[side(b.D.tot,M)]}},30,{seed:3});const p=(m.wins[0]+m.draws/2)/m.n,y=b.res==='yes'?1:0;br+=(p-y)**2;hit+=(p>=.5)===(y===1)?1:0;const ma=b.A.tot.reduce((x,c)=>x+c,0),md=b.D.tot.reduce((x,c)=>x+c,0),la=b.A.lost.reduce((x,c)=>x+c,0),ld=b.D.lost.reduce((x,c)=>x+c,0);r.push({rL:y?ld/md:la/ma,rW:y?la/ma:ld/md,sL:(y?m.losses[1]/md:m.losses[0]/ma),sW:(y?m.losses[0]/ma:m.losses[1]/md)});}
const a=k=>(100*r.reduce((t,x)=>t+x[k],0)/r.length).toFixed(0)+'%';console.log(`  real battles, morale ${M}: winner ${hit}/${B.length}, Brier ${(br/B.length).toFixed(3)}; loser lost real ${a('rL')} sim ${a('sL')}; winner real ${a('rW')} sim ${a('sW')}`);}
