// node peek.js <save|latest> <section> [path>to>block] [max lines]
// Prints what sits directly under a path of a TEXT save, one line each (long lines cut), to find where something is
// stored. Examples:   node peek.js latest countries "database>944"      node peek.js latest locations "locations>2669"
const fs = require('fs'), readline = require('readline');
const { savePath } = require('./paths.js');
const [arg, section, pth, max = 400] = process.argv.slice(2);
if (!arg || !section) { console.error('usage: node peek.js <save|latest> <section> [a>b>c] [max lines]'); process.exit(1); }
const want = pth ? pth.split('>') : [];
(async () => {
	const rl = readline.createInterface({ input: fs.createReadStream(savePath(arg), { encoding: 'latin1', highWaterMark: 1 << 20 }) });
	let inSec = false, stack = [], printed = 0;
	for await (const line of rl) {
		if (!inSec) { if (line === section + '={') { inSec = true; stack = []; } continue; }
		const t = line.trim();
		const m = t.match(/^([^\s={}]+)=\{$/);
		const at = stack.length === want.length && want.every((w, i) => stack[i] === w);
		if (at && t && t !== '}') { console.log(t.length > 150 ? t.slice(0, 150) + ' ...' : t); if (++printed >= +max) break; }
		const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
		if (opens > closes) { stack.push(m ? m[1] : (t.split('=')[0] || '?')); for (let i = 1; i < opens - closes; i++) stack.push('?'); }
		else if (closes > opens) { let done = false; for (let i = 0; i < closes - opens; i++) { if (!stack.length) { done = true; break; } stack.pop(); } if (done) break; }
	}
	rl.close();
})();
