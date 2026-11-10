// Writes a small local "helper mod": script effects that change a loaded save from inside the game, each behind a
// decision the player takes once. See .claude/skills/save-edit/SKILL.md for the method.
//   const hm = require('./helper_mod.js');
//   const mod = hm.open('ArsBelliPlaytestTools', { name: 'Ars Belli Playtest Tools', id: 'arsbelli.playtesttools', description: '...' });
//   mod.effects('abm_playtest_cleanup', text);                  // in_game/common/scripted_effects/<file>.txt, checked
//   mod.decisions('abm_playtest_decisions', [{ key, effect, title, desc, button, tooltip }], { header, locFile });
//   hm.staticTags()                                             // tags script can name as c:TAG
const fs = require('fs');
const path = require('path');
const { GAME, MOD, MODS } = require('./paths.js');

// Tags defined in setup/countries or as a formable can be written as c:TAG. Countries created during a campaign
// (AAA01, ABA33...) cannot: reach those through iterators (every_subject, every_country) and saved scopes.
function staticTags() {
	const tags = new Set();
	const dirs = root => [path.join(root, 'in_game/setup/countries'), ...(fs.existsSync(path.join(root, 'dlc')) ? fs.readdirSync(path.join(root, 'dlc')).map(d => path.join(root, 'dlc', d, 'in_game/setup/countries')) : [])];
	for (const dir of [...dirs(GAME), ...dirs(MOD)]) if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir))
		for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^﻿?([A-Z][A-Z0-9]{2,5})\s*=\s*\{/gm)) tags.add(m[1]);
	for (const root of [GAME, MOD]) { const dir = path.join(root, 'in_game/common/formable_countries'); if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^\s*tag\s*=\s*([A-Z][A-Z0-9]{2,5})\b/gm)) tags.add(m[1]); }
	return tags;
}
// brace balance, location names that exist, and no c:TAG the game cannot resolve
function check(text, { locNames, tags } = {}) {
	const problems = [];
	let d = 0, min = 0;
	for (const ch of text.replace(/#.*/g, '')) { if (ch === '{') d++; if (ch === '}') { d--; min = Math.min(min, d); } }
	if (d !== 0 || min < 0) problems.push(`braces do not balance (end depth ${d}, lowest ${min})`);
	if (locNames) { const known = new Set(locNames); const bad = [...new Set([...text.matchAll(/location:([A-Za-z0-9_]+)/g)].map(m => m[1]))].filter(n => !known.has(n)); if (bad.length) problems.push('unknown locations: ' + bad.slice(0, 10).join(' ')); }
	if (tags) { const bad = [...new Set([...text.matchAll(/\bc:([A-Z0-9]+)/g)].map(m => m[1]))].filter(t => !tags.has(t)); if (bad.length) problems.push('tags script cannot name: ' + bad.slice(0, 10).join(' ')); }
	return problems;
}
function open(folder, { name, id, description, version = '1.0.0', gameVersion = '1.4.*' }) {
	const out = path.join(MODS, folder);
	// every script and loc file here: UTF-8 with BOM, CRLF
	const write = (rel, text, bom = true) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, (bom ? '﻿' : '') + text.replace(/\r\n/g, '\n').split('\n').join('\r\n')); return f; };
	write('.metadata/metadata.json', JSON.stringify({ name, id, version, game_id: 'eu5', supported_game_version: gameVersion, short_description: description, tags: ['Gameplay'], relationships: [], game_custom_data: {} }, null, 2) + '\n', false);
	return {
		out, write,
		effects(file, text, opts) { const p = check(text, opts); if (p.length) throw new Error(file + ': ' + p.join('; ')); return write(`in_game/common/scripted_effects/${file}.txt`, text); },
		// One decision per step. The effect MUST sit in hidden_effect with a one-line custom_tooltip: the game builds the
		// tooltip text of everything else, and for a few thousand lines that froze it. The global variable hides the
		// decision once taken (and stays in the save, harmlessly).
		decisions(file, list, { header = '', locFile = file } = {}) {
			write(`in_game/common/decisions/${file}.txt`, (header ? header + '\n' : '') + list.map(d => `${d.key}_decision = {
	decision_category = other_decisions

	potential = {
		is_ai = no
		NOT = { has_global_variable = ${d.done || d.key + '_done'} }
	}

	allow = {
		always = yes
	}

	option = {
		name = ${d.key}_decision.a
		effect = {
			custom_tooltip = ${d.key}_decision.tt
			hidden_effect = {
				set_global_variable = { name = ${d.done || d.key + '_done'} value = yes }
				${d.effect}
			}
		}
	}
}
`).join('\n'));
			write(`main_menu/localization/english/${locFile}_l_english.yml`, 'l_english:\n' + list.map(d => ` ${d.key}_decision: "${d.title}"\n ${d.key}_decision.title: "${d.title}"\n ${d.key}_decision.desc: "${d.desc}"\n ${d.key}_decision.a: "${d.button}"\n ${d.key}_decision.tt: "${d.tooltip}"\n`).join(''));
		},
	};
}
module.exports = { staticTags, check, open };
