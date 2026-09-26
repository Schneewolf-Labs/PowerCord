const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../app');

const messages = { onbattery: 'on battery!', offbattery: 'power back' };

async function withServer(send, fn) {
	const server = createApp(messages, send).listen(0, '127.0.0.1');
	await new Promise(resolve => server.once('listening', resolve));
	const url = `http://127.0.0.1:${server.address().port}/ups-event`;
	try {
		await fn(url);
	} finally {
		server.close();
	}
}

const post = (url, body, headers = { 'content-type': 'application/json' }) =>
	fetch(url, { method: 'POST', headers, body });

test('forwards a configured event', async () => {
	const sent = [];
	await withServer(async m => { sent.push(m); }, async url => {
		const res = await post(url, JSON.stringify({ eventType: 'onbattery' }));
		assert.equal(res.status, 200);
	});
	assert.deepEqual(sent, ['on battery!']);
});

test('rejects unknown and inherited event types', async () => {
	const sent = [];
	await withServer(async m => { sent.push(m); }, async url => {
		assert.equal((await post(url, JSON.stringify({ eventType: 'nope' }))).status, 400);
		assert.equal((await post(url, JSON.stringify({ eventType: 'toString' }))).status, 400);
	});
	assert.deepEqual(sent, []);
});

test('a request without a JSON body is a 400, not a crash', async () => {
	await withServer(async () => {}, async url => {
		assert.equal((await post(url, 'eventType=onbattery', {})).status, 400);
	});
});

test('a failed Discord send still acknowledges apcupsd', async () => {
	await withServer(() => Promise.reject(new Error('boom')), async url => {
		assert.equal((await post(url, JSON.stringify({ eventType: 'offbattery' }))).status, 200);
	});
});
