// Parses vanilla modifier_type_definitions into { key: {percent, already, decimals, color, boolean, format} }.
const fs = require('fs'), path = require('path');
module.exports = function loadDefs(game) {
	const dir = path.join(game, 'main_menu/common/modifier_type_definitions');
	const defs = {};
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
		const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').replace(/#[^\n]*/g, '');
		const re = /([A-Za-z0-9_]+)\s*=\s*\{/g;
		let m;
		while ((m = re.exec(t))) {
			const start = re.lastIndex;
			let depth = 1, j = start;
			while (depth && j < t.length) { if (t[j] === '{') depth++; else if (t[j] === '}') depth--; j++; }
			const body = t.slice(start, j - 1);
			re.lastIndex = j;
			const g = k => { const x = body.match(new RegExp('(?:^|[^A-Za-z0-9_])' + k + '[ \\t]*=[ \\t]*"?([A-Za-z0-9_.-]+)"?')); return x ? x[1] : null; };
			defs[m[1]] = { percent: g('percent') === 'yes', already: g('already_percent') === 'yes', decimals: g('decimals'), color: g('color') || 'good', boolean: g('boolean') === 'yes', format: g('format') };
		}
	}
	return defs;
};
