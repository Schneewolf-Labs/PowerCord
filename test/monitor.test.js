const test = require('node:test');
const assert = require('node:assert');
const { HEALTHY, diffStates, startMonitor } = require('../monitor');

const run = (...states) => {
	let state = HEALTHY;
	const events = [];
	for (const next of states) {
		const result = diffStates(state, { ...HEALTHY, ...next });
		state = result.state;
		events.push(...result.events);
	}
	return events;
};

test('a steady healthy UPS says nothing', () => {
	assert.deepEqual(run({}, {}, {}), []);
});

test('an outage reports battery, low battery, and recovery once each', () => {
	assert.deepEqual(
		run({ onBattery: true }, { onBattery: true }, { onBattery: true, lowBattery: true }, {}),
		['onbattery', 'lowbattery', 'offbattery'],
	);
});

test('losing the UPS keeps its last known state instead of faking a recovery', () => {
	assert.deepEqual(
		run({ onBattery: true }, { commLost: true }, { commLost: true }, { onBattery: true }, {}),
		['onbattery', 'commfailure', 'commok', 'offbattery'],
	);
});

test('starting mid-outage still reports it', () => {
	assert.deepEqual(run({ onBattery: true, replaceBattery: true }), ['onbattery', 'changeme']);
});

test('a failing poll counts as lost communication and is not re-reported', async () => {
	const events = [];
	let calls = 0;
	const originalError = console.error;
	console.error = () => {};
	const monitor = startMonitor({
		name: 'test',
		interval: 1,
		poll: async () => { if (++calls > 3) return HEALTHY; throw new Error('down'); },
		emit: e => events.push(e),
	});
	await new Promise(resolve => setTimeout(resolve, 50));
	monitor.stop();
	console.error = originalError;
	assert.deepEqual(events, ['commfailure', 'commok']);
});
