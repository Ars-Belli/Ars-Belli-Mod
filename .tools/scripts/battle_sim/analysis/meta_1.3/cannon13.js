const R=require('path').resolve(__dirname,'..','..')+'/';
const os=require('os');try{os.setPriority(os.constants.priority.PRIORITY_LOW);}catch{}
const S=require(R+'engine.js'),db=JSON.parse(JSON.stringify(require(R+'units_1.3.11.json')));
for(const k of ['a_chambered_cannon','a_royal_mortar','a_flying_battery']) { db.units['x_weak_'+k]={...db.units[k],p:1.5}; }
S.setUnitDB(db);Object.assign(S.D,S.RULES_13);
const LOC={topography:'flatland',vegetation:'farmland'},G={adm:60,dip:59,mil:61},N=250;
const base=a=>({tactics:2.6+.25*(a-3),discipline:.27+(a>=6?.05:0),moraleMod:.31,moraleFlat:[0,.25,.5,.8,1.15,1.55][a-1],experience:.4,initiativeMod:.2,correctBoxChance:.2,combinedPerType:.025+(a>=4?.01:0)+(a>=6?.01:0),frontageMod:a>=5?.1:0});
const Am=(u,c)=>({name:'x',general:G,country:c,units:Object.entries(u).filter(([,n])=>n).map(([type,count])=>({type,count}))});
const f=(a,b,bomb=true)=>{const save=S.D.BOMBARD_CHANCE;if(!bomb)S.D.BOMBARD_CHANCE=0;const x=S.monteCarloScenario({location:LOC,attacker:{armies:[a]},defender:{armies:[b]}},N,{seed:4}),y=S.monteCarloScenario({location:LOC,attacker:{armies:[b]},defender:{armies:[a]}},N,{seed:7004});S.D.BOMBARD_CHANCE=save;return{w:(x.wins[0]+x.draws/2+y.wins[1]+y.draws/2)/(2*N),l:(x.losses[0]+y.losses[1])/2,k:(x.losses[1]+y.losses[0])/2};};
const show=(n,r)=>console.log('  '+n.padEnd(60),(100*r.w).toFixed(0).padStart(3)+'%','men lost',r.l.toFixed(1)+'k/'+r.k.toFixed(1)+'k');
const up=t=>db.units[t].pr.m[1]*db.units[t].s*1000;
console.log('manpower a month per regiment:',['a_heavy_lancers','a_pistoleers','a_chambered_cannon','a_pikemen','a_arquebusiers','a_musketeers','a_hunters','a_royal_mortar','a_gallop_cavalry','a_fusiliers','a_sharpshooters','a_flying_battery','a_cuirassiers'].map(t=>t.slice(2)+' '+up(t).toFixed(0)).join(', '));
// age IV: same regiments cost the same manpower, cannons swap 1:1 with cavalry
{const C=base(4),off={...C,combinedPerType:0};console.log('AGE IV, equal manpower, against 30 Heavy Lancers:');
const foe=Am({a_heavy_lancers:30},C),foeOff=Am({a_heavy_lancers:30},off);
const m={a_heavy_lancers:12,a_pistoleers:12,a_chambered_cannon:6};
show('12 HL 12 Pistoleers 6 Cannons (the meta)',f(Am(m,C),foe));
show('15 HL 15 Pistoleers, no cannons (50% = no bonus)',f(Am({a_heavy_lancers:15,a_pistoleers:15},C),foe));
show('14 HL 13 Pistoleers 3 Cannons',f(Am({a_heavy_lancers:14,a_pistoleers:13,a_chambered_cannon:3},C),foe));
show('10 HL 10 Pistoleers 10 Cannons',f(Am({a_heavy_lancers:10,a_pistoleers:10,a_chambered_cannon:10},C),foe));
show('6 HL 6 Pistoleers 18 Cannons',f(Am({a_heavy_lancers:6,a_pistoleers:6,a_chambered_cannon:18},C),foe));
show('30 Cannons',f(Am({a_chambered_cannon:30},C),foe));
show('the meta, combined-arms bonus OFF',f(Am(m,off),foeOff));
show('the meta, no bombardment',f(Am(m,C),foe,false));
show('the meta, cannon combat power cut to 1.5',f(Am({a_heavy_lancers:12,a_pistoleers:12,x_weak_a_chambered_cannon:6},C),foe));
show('12 HL 12 Pistoleers 6 Pikemen instead of cannons (31 budget)',f(Am({a_heavy_lancers:12,a_pistoleers:12,a_pikemen:5},C),foe));}
{const C=base(5);console.log('AGE V, equal manpower, against 38 Gallop Cavalry:');
const foe=Am({a_gallop_cavalry:38},C);const nA=(hc,lc,art,li)=>({a_gallop_cavalry:hc,a_hussars:lc,a_royal_mortar:art,a_hunters:li});
show('15 Gallop 7 Hussars 7 Mortars 7 Hunters (the meta)',f(Am(nA(15,7,7,7),C),foe));
show('same with 13 more cavalry, no mortars',f(Am(nA(19,10,0,7),C),foe));
show('the meta, mortar combat power cut to 1.5',f(Am({a_gallop_cavalry:15,a_hussars:7,x_weak_a_royal_mortar:7,a_hunters:7},C),foe));}
{const C=base(6);console.log('AGE VI, equal manpower, against 30 Fusiliers:');
const foe=Am({a_fusiliers:30},C);
show('7 Fusiliers 13 Sharpshooters 13 Batteries (the meta)',f(Am({a_fusiliers:7,a_sharpshooters:13,a_flying_battery:13},C),foe));
show('15 Fusiliers 15 Sharpshooters, no guns',f(Am({a_fusiliers:15,a_sharpshooters:15},C),foe));
show('the meta, battery combat power cut to 1.5',f(Am({a_fusiliers:7,a_sharpshooters:13,x_weak_a_flying_battery:13},C),foe));}
