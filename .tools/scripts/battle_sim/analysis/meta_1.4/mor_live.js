const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,process.argv[2]));
const countries=s.section('countries'),tags=countries.tags; const id=Object.keys(tags).find(k=>tags[k]==='MOR');
const tmpl=[...fs.readFileSync(path.join(P.GAME,'in_game/map_data/location_templates.txt'),'utf8').matchAll(/^([a-z0-9_]+)\s*=\s*\{/gm)].map(m=>m[1]);
const wm=s.section('war_manager').database;
for(const [wid,w] of Object.entries(wm)){ if(!w||typeof w!=='object') continue; const all=[].concat(w.all||[]); if(!all.some(a=>+a.country===+id)) continue;
 console.log('WAR',wid,'start',w.start_date,'attackers/defenders',all.map(a=>tags[a.country]+':'+a.status).join(' ').slice(0,300),'battles',[].concat(w.battle||[]).length);
 const fm=a=>JSON.stringify([].concat(a||[]).map(Number).slice(0,6));for(const b of [].concat(w.battle||[])) { const who=x=>[].concat(x.who||[]); console.log('  ',b.date,tmpl[+b.location-1],'res',b.result,who(b.attacker).map(y=>tags[y.country]).join('+'),'tot',fm(b.attacker.total),'lost',fm(b.attacker.losses),'||',who(b.defender).map(y=>tags[y.country]).join('+'),'tot',fm(b.defender.total),'lost',fm(b.defender.losses));}
}
const cm=s.section('combat_manager'); console.log('combat keys',Object.keys(cm).slice(0,6).join(' '));
const db=cm.database||cm; let n=0;
for(const [k,b] of Object.entries(db)){ if(!b||typeof b!=='object') continue; n++; if(!JSON.stringify(b).includes('"'+id+'"')) continue; console.log('BATTLE',k,JSON.stringify(b).slice(0,2500)); }
console.log('battles live',n);
// MOR armies: men, location, levy share, morale
const units=s.section('unit_manager').database, subs=s.section('subunit_manager').database;
const armies={};
for(const x of Object.values(subs)){ if(!x) continue; const u=units[x.unit]; if(!u||+u.country!==+id||!String(x.type).startsWith('a_')) continue; const A=armies[x.unit]=armies[x.unit]||{loc:tmpl[+u.location-1],leader:u.leader,regs:0,men:0,mor:0,exp:0,types:{}}; A.regs++;A.men+=+x.strength||0;A.mor+=+x.morale||0;A.exp+=+x.experience||0;A.types[x.type]=(A.types[x.type]||0)+1;}
for(const [k,A] of Object.entries(armies)) console.log(k,A.loc,'regs',A.regs,'men',A.men.toFixed(1),'morale',(A.mor/A.regs).toFixed(2),'exp',(A.exp/A.regs).toFixed(1),JSON.stringify(A.types));
