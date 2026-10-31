// Progress for long simulations: "[ 40%] 12 of 30, about 1m 20s left", on stderr so results stay clean, at most every few seconds and always at the end.
//   const tick = require('./progress.js')(total, 'label');   then tick() after each finished job
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
module.exports = (total, label = 'sim', everyMs = 3000) => {
	const t0 = Date.now();
	let done = 0, last = 0;
	return (n = 1) => {
		done += n;
		const now = Date.now();
		if (done < total && now - last < everyMs) return;
		last = now;
		const pct = String(Math.floor(100 * done / total)).padStart(3);
		const left = done ? (now - t0) / done * (total - done) : 0;
		process.stderr.write(`[${pct}%] ${label}: ${done} of ${total}, ${done < total ? `about ${clock(left)} left` : `done in ${clock(now - t0)}`}\n`);
	};
};
