// Shared paths for the save edit tools. EU5_GAME = the game folder whose map and country files match the save
// (default: the installed game). EU5_SAVE_WORK = where extracts, plans and maps go (default: .work here, not in git).
// EU5_MODS = where helper mods are written (default: the game's local mod folder).
const fs = require('fs');
const path = require('path');
const { GAME, MOD } = require('../battle_sim/paradox.js');
const DOCS = path.join(process.env.USERPROFILE || '', 'Documents/Paradox Interactive/Europa Universalis V');
const WORK = process.env.EU5_SAVE_WORK || path.join(__dirname, '.work');
fs.mkdirSync(WORK, { recursive: true });
// a save by path, by file name in the save games folder, or 'latest'
function savePath(arg) {
	const dir = path.join(DOCS, 'save games');
	if (arg === 'latest') return fs.readdirSync(dir).filter(f => f.endsWith('.eu5')).map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
	return fs.existsSync(arg) ? arg : path.join(dir, arg);
}
module.exports = { GAME, MOD, DOCS, WORK, MODS: process.env.EU5_MODS || path.join(DOCS, 'mod'), MAP: path.resolve(__dirname, '../location_sim/map.json'), savePath, work: f => path.join(WORK, f) };
