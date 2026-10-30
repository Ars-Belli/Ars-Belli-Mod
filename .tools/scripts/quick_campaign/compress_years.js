// Quick Campaign: rebuilds the vanilla situation files whose dates would fall after the game ends. Each file is copied from the
// installed game and every `current_year` date moves to the same point in the 30-year ages (the Reformation's 1510, 73 years
// into Age III, lands 22 years into it). Run after a game update: node .tools/scripts/quick_campaign/compress_years.js
const fs = require('fs'), path = require('path');
const { GAME } = require('../battle_sim/paradox.js');
const ROOT = path.resolve(__dirname, '../../..');

// age start years from Age II on, vanilla and in in_game/common/age/00_default.txt on this branch
const VANILLA = [1342, 1437, 1537, 1637, 1737], QUICK = [1342, 1372, 1402, 1432, 1462];
const FILES = [
	'in_game/common/situations/reformation.txt',
	'in_game/common/situations/council_of_trent.txt',
	'in_game/common/situations/war_of_religions.txt', // the Reformation's settlement outcome waits for this one
	'in_game/common/situations/little_ice_age.txt',
	'in_game/events/situations/little_ice_age.txt',
];
const ICE_AGE_END = 1715; // vanilla little_ice_age_end_trigger, used only by the situation

function quick(year) {
	if (year <= VANILLA[0]) return year;
	let i = VANILLA.length - 1;
	while (year < VANILLA[i]) i--;
	const span = (VANILLA[i + 1] ?? VANILLA[i] + 100) - VANILLA[i], quickSpan = (QUICK[i + 1] ?? QUICK[i] + 30) - QUICK[i];
	return Math.round(QUICK[i] + (year - VANILLA[i]) * quickSpan / span);
}

for (const rel of FILES) {
	const raw = fs.readFileSync(path.join(GAME, rel), 'utf8');
	const bom = raw.startsWith('﻿') ? '﻿' : '';
	let moved = 0;
	const body = raw.slice(bom.length)
		.replace(/\bcurrent_year(\s*(?:>=|<=|>|<|=)\s*)(\d{4})\b/g, (_, op, y) => { moved++; return `current_year${op}${quick(+y)}`; })
		.replace(/\blittle_ice_age_end_trigger = yes\b/g, () => { moved++; return `current_year > ${quick(ICE_AGE_END)}`; });
	const note = '# QUICK CAMPAIGN: vanilla file with its dates moved by .tools/scripts/quick_campaign/compress_years.js, do not edit by hand';
	fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
	fs.writeFileSync(path.join(ROOT, rel), bom + note + (raw.includes('\r\n') ? '\r\n' : '\n') + body, 'utf8');
	console.log(`${rel}: ${moved} dates`);
}
