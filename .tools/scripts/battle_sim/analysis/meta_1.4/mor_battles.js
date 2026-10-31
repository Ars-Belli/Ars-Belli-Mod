const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,process.argv[2]));
console.log(Object.keys(s.sections).join(' '));
const txt=s.text;
// where do battle records live?
for(const pat of ['battle_location','attacker_losses','last_battle','battles={','battle={','casualties','previous_war','battle_date']){ const i=txt.indexOf(pat); console.log(pat,i); }
const i=txt.indexOf('battle_location'); if(i>0) console.log(txt.slice(i-600,i+900));
