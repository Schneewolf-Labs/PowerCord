const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const nut = require('../protocols/nut');
const apcupsd = require('../protocols/apcupsd');

async function fakeDaemon(onData) {
	const server = net.createServer(socket => socket.on('data', data => onData(socket, data)));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	return { server, port: server.address().port };
}

test('NUT targets use upsc syntax', () => {
	assert.deepEqual(nut.parseTarget('myups@nas'), { ups: 'myups', host: 'nas', port: 3493, name: 'myups@nas' });
	assert.equal(nut.parseTarget('a@b:1234').port, 1234);
	assert.throws(() => nut.parseTarget('nas'));
});

test('NUT status flags', () => {
	assert.deepEqual(nut.parseResponse('VAR ups ups.status "OB LB DISCHRG"', 'ups'),
		{ commLost: false, onBattery: true, lowBattery: true, replaceBattery: false, shutdown: false });
	assert.deepEqual(nut.parseResponse('ERR DATA-STALE', 'ups'), { commLost: true });
	assert.throws(() => nut.parseResponse('ERR UNKNOWN-UPS', 'ups'), /UNKNOWN-UPS/);
});

test('polls upsd over TCP', async () => {
	let asked;
	const { server, port } = await fakeDaemon((socket, data) => {
		asked = data.toString();
		socket.write('VAR myups ups.status "OL CHRG RB"\n');
	});
	try {
		const state = await nut.poll(nut.parseTarget(`myups@127.0.0.1:${port}`));
		assert.equal(asked, 'GET VAR myups ups.status\n');
		assert.deepEqual(state, { commLost: false, onBattery: false, lowBattery: false, replaceBattery: true, shutdown: false });
	} finally {
		server.close();
	}
});

test('apcupsd status flags', () => {
	assert.deepEqual(apcupsd.parseStatus('ONBATT LOWBATT'),
		{ commLost: false, onBattery: true, lowBattery: true, replaceBattery: false, shutdown: false });
	assert.equal(apcupsd.parseStatus('ONBATT SHUTTING DOWN').shutdown, true);
	assert.deepEqual(apcupsd.parseStatus('COMMLOST'), { commLost: true });
});

test('polls apcupsd NIS, reassembling records split across packets', async () => {
	let asked;
	const { server, port } = await fakeDaemon((socket, data) => {
		asked = data;
		const reply = Buffer.concat([
			apcupsd.frame('APC      : 001,036,0879\n'),
			apcupsd.frame('STATUS   : ONBATT \n'),
			Buffer.from([0, 0]),
		]);
		socket.write(reply.subarray(0, 20));
		setTimeout(() => socket.write(reply.subarray(20)), 5);
	});
	try {
		const state = await apcupsd.poll(apcupsd.parseTarget(`127.0.0.1:${port}`));
		assert.deepEqual(asked, apcupsd.frame('status'));
		assert.equal(state.onBattery, true);
	} finally {
		server.close();
	}
});

test('an unreachable daemon rejects', async () => {
	const { server, port } = await fakeDaemon(() => {});
	server.close();
	await assert.rejects(nut.poll(nut.parseTarget(`ups@127.0.0.1:${port}`)));
});
