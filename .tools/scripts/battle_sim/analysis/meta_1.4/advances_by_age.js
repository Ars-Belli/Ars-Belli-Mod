// universal (no potential) advances: combat modifiers per age, vanilla + DLC + mod
const fs=require('fs'),path=require('path');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const db=P.loadDb('in_game/common/advances');
const keys=/^(discipline|military_tactics|land_morale_modifier|land_morale|army_.*_power|army_initiative|combat_speed_modifier|levy_combat_efficiency_modifier|combined_bonus_per_type|combined_arms_.*|possible_frontage_modifier|correct_box_chance|army_maintenance_efficiency|army_reinforce_efficiency|regiment_reinforcement_speed|global_levy_size_modifier|global_army_levy_size_modifier|tribes_estate_levy_size|levy_recovery_modifier|bombard_efficiency|artillery_barrage|experience_decay|monthly_experience_gain|global_manpower_modifier|.*morale_damage.*|.*strength_damage.*)$/;
const age={};
let nop=0,withp=0;
const rows=[];
for(const [k,v] of Object.entries(db)){
  const a=P.get(v,'age'); const pot=P.get(v,'potential');
  const mods=v.filter(([x,y])=>typeof y==='string'&&keys.test(x));
  if(!mods.length) continue;
  rows.push({k,a,pot:pot?JSON.stringify(pot).slice(0,110):null,req:P.get(v,'requires'),mods:mods.map(([x,y])=>x+' '+y).join(', ')});
}
const uni=rows.filter(r=>!r.pot);
const order=['age_1_traditions','age_2_renaissance','age_3_discovery','age_4_reformation','age_5_absolutism','age_6_revolutions'];
for(const a of order){ console.log('=== '+a); for(const r of uni.filter(x=>x.a===a)) console.log('  ',r.k.padEnd(46),r.mods); }
console.log('--- other (no age)',uni.filter(r=>!order.includes(r.a)).length);
console.log('--- gated, by potential head:');
const g={}; for(const r of rows.filter(x=>x.pot)){const h=r.pot.replace(/[\[\]"]/g,'').slice(0,50); (g[h]=g[h]||[]).push(r);}
for(const [h,l] of Object.entries(g).sort((a,b)=>b[1].length-a[1].length).slice(0,14)) console.log(String(l.length).padStart(4),h);
