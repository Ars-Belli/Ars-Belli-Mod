// Vanilla English loc plus the helpers both pages use to show modifiers the way the game does:
// in-game names (MODIFIER_TYPE_NAME_*), tooltip text (MODIFIER_TYPE_DESC_*) and value formats.
const fs = require('fs');
const path = require('path');

module.exports = function load(game) {
	const loc = {};
	const dir = path.join(game, 'main_menu/localization/english');
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.yml'))) {
		const txt = fs.readFileSync(path.join(dir, f), 'utf8');
		for (const m of txt.matchAll(/^\s*([A-Za-z0-9_.]+):\d*\s*"(.*)"\s*$/gm)) loc[m[1]] = m[2];
	}

	const UNIT_CATS = { army_artillery: 'artillery', army_auxiliary: 'auxiliary', navy_galley: 'galley', navy_heavy_ship: 'heavy ship', navy_light_ship: 'light ship' };
	function clean(text, depth = 0) {
		if (depth > 4) return text;
		return text
			.replace(/\$([A-Za-z0-9_.]+)\$/g, (_, k) => (k in loc ? clean(loc[k], depth + 1) : ''))
			.replace(/\[([a-z_]+)\|[eE]\]/g, (_, k) => {
				const n = loc['game_concept_' + k];
				return (n && !n.includes('[') && !n.includes('$') ? n : k.replace(/_/g, ' ')).toLowerCase();
			})
			.replace(/\[ShowUnitCategoryName\('([a-z_]+)'\)\]/g, (_, k) => UNIT_CATS[k] || k.replace(/_/g, ' '))
			.replace(/\[ShowGoodsName\('([a-z_]+)'\)\]/g, (_, k) => (loc[k] || k).toLowerCase())
			.replace(/\[ShowModifierTypeName\('([a-z_]+)'\)\]/g, (_, k) => (loc['MODIFIER_TYPE_NAME_' + k] || k).toLowerCase())
			.replace(/\[ShowSubjectTypeName\('([a-z_]+)'\)\]/g, (_, k) => (loc[k] || k).toLowerCase())
			.replace(/\[([a-z_]+)\]/g, (_, k) => {
				const n = loc['game_concept_' + k];
				return (n && !n.includes('[') && !n.includes('$') ? n : k.replace(/_/g, ' ')).toLowerCase();
			})
			.replace(/\[[^\]]*\]/g, '')
			.replace(/@[A-Za-z0-9_]+!\s*/g, '')
			.replace(/#[A-Za-z_]+ /g, '').replace(/#!/g, '')
			.replace(/\\n/g, '\n')
			.replace(/ ship ships/g, ' ships').replace(/galley ships/g, 'galleys')
			.replace(/[ \t]+/g, ' ').trim();
	}
	// Concept text that explains these better than the generic modifier line.
	const CONCEPT_INFO = { discipline: 'discipline', military_tactics: 'military_tactics' };
	function modInfo(key) {
		const parts = [];
		const d = loc['MODIFIER_TYPE_DESC_' + key];
		if (d) parts.push(clean(d));
		if (CONCEPT_INFO[key]) parts.push(clean(loc['game_concept_' + CONCEPT_INFO[key] + '_desc'] || ''));
		return [...new Set(parts.filter(Boolean))].join(' ') || null;
	}
	const modName = key => clean(loc['MODIFIER_TYPE_NAME_' + key] || key);

	function fmtNum(v, decimals) {
		const r = Math.round(v * 10 ** decimals) / 10 ** decimals;
		return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toLocaleString('en-US', { maximumFractionDigits: decimals });
	}
	// A modifier value as the game shows it (def from defs.js).
	function fmtValue(def, v) {
		const dec = def.decimals != null ? parseInt(def.decimals, 10) : 2;
		if (def.percent) return fmtNum(v * 100, dec) + '%';
		if (def.already) return fmtNum(v, dec) + '%';
		if (def.format === 'FormatManPower') return fmtNum(v * 1000, 0);
		if (def.format === 'FormatPopCaps') return fmtNum(v * 1000, dec);
		return fmtNum(v, dec);
	}

	return { loc, clean, modInfo, modName, fmtValue };
};
