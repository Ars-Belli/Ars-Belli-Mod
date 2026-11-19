const path=require('path'),fs=require('fs');
const R=require('path').resolve(__dirname,'..','..','..','..','..');
const P=require(R+'/.tools/scripts/battle_sim/paradox.js');
const dir=path.join(process.env.USERPROFILE,'Documents/Paradox Interactive/Europa Universalis V/save games');
const s=P.openSave(path.join(dir,process.argv[2]));
const txt=s.text;
const i=txt.indexOf('attacker_losses');
console.log(txt.slice(i-900,i+1500));
