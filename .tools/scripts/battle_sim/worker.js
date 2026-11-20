// Web Worker for the battle simulator page: runs Monte Carlo chunks off the main thread, one worker per core.
importScripts('engine.js');
const ready = fetch('units.json').then(r => r.json()).then(db => self.BattleSim.setUnitDB(db));
self.onmessage = async e => {
	const { id, scn, n, seed, steps } = e.data;
	try {
		await ready;
		self.BattleSim.setTimeSteps(steps === 'hourly' ? 'hourly' : 'daily');
		self.postMessage({ id, result: self.BattleSim.monteCarloScenario(scn, n, { seed }) });
	} catch (err) {
		self.postMessage({ id, error: String(err && err.message || err) });
	}
};
