const R=require('path').resolve(__dirname,'..','..')+'/';
const P=require(R+'paradox.js');
const U=require(R+'units_1.3.11.json').units, types=P.loadDb('in_game/common/unit_types'), adv=P.loadDb('in_game/common/advances');
const by={}; for(const [k,v] of Object.entries(adv)) for(const [x,y] of v) if(x==='unlock_unit'&&U[y]) (by[y]=by[y]||[]).push(k);
const potOf=k=>{const out=[];for(const a of by[k]||[]){const p=P.get(adv[a],'potential');if(p)out.push(JSON.stringify(p).replace(/[\[\]"]/g,'').slice(0,90));}const c=P.get(types[k]||[],'country_potential');if(c)out.push(JSON.stringify(c).replace(/[\[\]"]/g,'').slice(0,90));return out.join(' ; ');};
for(const [k,u] of Object.entries(U).filter(([k,u])=>!u.levy&&u.a===5&&u.c!=='aux').sort((a,b)=>a[1].c.localeCompare(b[1].c))){const p=potOf(k); if(p&&!/iberian|SPA|CAS|castil|french|burgund|LOT|lothar|BUR/i.test(p)) continue; console.log(k.padEnd(26),u.c.padEnd(3),'p',u.p,'s',u.s,'sdd',u.sdd,'sdt',u.sdt,'mdd',u.mdd,'mdt',u.mdt,'i',u.i,'|',(by[k]||['-']).join(',').slice(0,34),'|',p.slice(0,80));}
console.log('tercio upgrades_to',P.get(types.a_tercio||[],'upgrades_to'),P.get(types.a_tercio||[],'upgrades_to_only'));
