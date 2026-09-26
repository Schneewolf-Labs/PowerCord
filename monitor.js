// Polls a UPS daemon and turns status changes into the same event names apcupsd's
// scripts use, so config.json's messages work regardless of where the event came from.

// Starting from a healthy UPS means a restart during an outage still reports it.
const HEALTHY = { commLost: false, onBattery: false, lowBattery: false, replaceBattery: false, shutdown: false };

// [flag, event when it turns on, event when it turns off]
const TRANSITIONS = [
	['onBattery', 'onbattery', 'offbattery'],
	['lowBattery', 'lowbattery', null],
	['replaceBattery', 'changeme', null],
	['shutdown', 'doshutdown', null],
];

// While the UPS is unreachable its other flags are unknown, so they carry over
// instead of looking like the power came back.
function diffStates(prev, next) {
	if (next.commLost) {
		return { state: { ...prev, commLost: true }, events: prev.commLost ? [] : ['commfailure'] };
	}
	const events = prev.commLost ? ['commok'] : [];
	for (const [flag, on, off] of TRANSITIONS) {
		if (!prev[flag] && next[flag]) events.push(on);
		if (prev[flag] && !next[flag] && off) events.push(off);
	}
	return { state: { ...next, commLost: false }, events };
}

function startMonitor({ name, poll, emit, interval }) {
	let state = HEALTHY;
	let timer;
	let stopped = false;

	const tick = async () => {
		let next;
		try {
			next = await poll();
		} catch (err) {
			// A dead daemon is as bad as a dead UPS link; only log it on the way down.
			if (!state.commLost) console.error(`${name}: ${err.message}`);
			next = { commLost: true };
		}
		const result = diffStates(state, next);
		state = result.state;
		result.events.forEach(emit);
		if (!stopped) timer = setTimeout(tick, interval);
	};
	tick();

	return { stop: () => { stopped = true; clearTimeout(timer); } };
}

module.exports = { HEALTHY, diffStates, startMonitor };
