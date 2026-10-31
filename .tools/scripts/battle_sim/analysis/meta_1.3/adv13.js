const path=require('path');
const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const adv=P.loadDb('in_game/common/advances'), types=P.loadDb('in_game/common/unit_types');
const s=require(__dirname+'/spa_lot_13.json');
const ks=Object.keys(s.countries); console.log(ks.length,'entries:',ks.join(' | ').slice(0,300));
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const S=P.openSave(path.join(dir,'SP_SPA_1547_01_04_7f25c496-f283-4e84-b8b6-b35a16c851c9_0.eu5'));
const cs=S.section('countries'),tags=cs.tags,db=cs.database;
const has={}; for(const T of ['SPA','LOT']){const id=Object.keys(tags).find(k=>tags[k]===T); has[T]=new Set(Object.keys(db[id].researched_advances||{}));}
const show=['tercio','landsknechte','platoon_fire','cas_lanzas_de_castilla','swiss_reislaufer','winged_hussars_advance','unlock_pikemen_advance','unlock_arquebusiers_advance','unlock_heavy_lancers_advance','unlock_pistoleers_advance','unlock_chambered_cannon_advance','unlock_halberdiers_advance','unlock_light_lancers_advance','unlock_early_arquebusiers_advance','combined_arms_advance_reformation','spanish_square','maurician_infantry','pike_square'];
for(const a of show){ const v=adv[a]; if(!v){console.log(a,'-- no such advance');continue;} const pot=P.get(v,'potential'); console.log(a.padEnd(36),'age',String(P.get(v,'age')).replace('age_','').padEnd(14),'SPA',has.SPA.has(a)?'yes':'no ','LOT',has.LOT.has(a)?'yes':'no ','req',String(P.get(v,'requires')||'-').slice(0,28).padEnd(28),'pot',pot?JSON.stringify(pot).replace(/[\[\]"]/g,'').slice(0,120):'-'); }
// any age 4 unit unlock by name
const u4=[]; for(const [k,v] of Object.entries(adv)) for(const [x,y] of v) if(x==='unlock_unit'&&/pikemen|arquebus|heavy_lancers|pistoleer|chambered/.test(y)) u4.push(k+'->'+y); console.log('unlocks:',u4.join(' ').slice(0,400));
console.log('a_lanzas upgrades_to',P.get(types.a_lanzas_de_castilla||[],'upgrades_to'),'| a_lancers',P.get(types.a_lancers||[],'upgrades_to'),'| a_light_lancers',P.get(types.a_light_lancers||[],'upgrades_to'),'| a_tercio pot',JSON.stringify(P.get(types.a_tercio||[],'country_potential')||'').slice(0,160));
