const test = require('node:test');
const assert = require('node:assert');
const dgram = require('node:dgram');
const snmp = require('../protocols/snmp');
const { TAG, tlv, encodeInteger, encodeOid, APC_MIB, UPS_MIB } = snmp;

const NO_SUCH_OBJECT = tlv(0x80, Buffer.alloc(0));

// Answers a GetRequest from `mib` (oid -> integer); anything missing is noSuchObject.
function encodeResponse(request, mib, { community = 'public', errorStatus = 0, requestId } = {}) {
	const [, , pdu] = snmp.decode(request).children;
	const [reqId, , , varbinds] = pdu.children;
	const answers = varbinds.children.map(({ children: [oid] }) => {
		const name = snmp.decodeOid(oid.value);
		const value = Object.hasOwn(mib, name) ? encodeInteger(mib[name]) : NO_SUCH_OBJECT;
		return tlv(TAG.SEQUENCE, Buffer.concat([encodeOid(name), value]));
	});
	return tlv(TAG.SEQUENCE, Buffer.concat([
		encodeInteger(1),
		tlv(TAG.OCTET_STRING, Buffer.from(community)),
		tlv(TAG.RESPONSE, Buffer.concat([
			requestId === undefined ? tlv(TAG.INTEGER, reqId.value) : encodeInteger(requestId),
			encodeInteger(errorStatus),
			encodeInteger(0),
			tlv(TAG.SEQUENCE, Buffer.concat(answers)),
		])),
	]));
}

async function fakeAgent(handle) {
	const socket = dgram.createSocket('udp4');
	const seen = [];
	socket.on('message', (msg, rinfo) => {
		seen.push(msg);
		for (const reply of [].concat(handle(msg))) socket.send(reply, rinfo.port, rinfo.address);
	});
	await new Promise(resolve => socket.bind(0, '127.0.0.1', resolve));
	return { socket, seen, target: () => snmp.parseTarget(`secret@127.0.0.1:${socket.address().port}`) };
}

test('BER encoding matches known bytes', () => {
	assert.equal(encodeOid('1.3.6.1.2.1.1.1.0').toString('hex'), '06082b06010201010100');
	assert.equal(encodeOid('1.3.6.1.4.1.318.1').toString('hex'), '06082b06010401823e01');
	assert.equal(encodeInteger(128).toString('hex'), '02020080');
	assert.equal(encodeInteger(-129).toString('hex'), '0202ff7f');
	assert.equal(snmp.decodeOid(encodeOid(APC_MIB.outputStatus).subarray(2)), APC_MIB.outputStatus);
});

test('long-form lengths round-trip', () => {
	const body = Buffer.alloc(300, 1);
	const node = snmp.decode(tlv(TAG.OCTET_STRING, body));
	assert.deepEqual(node.value, body);
});

test('targets default to public on 161 and keep the community out of the name', () => {
	assert.deepEqual(snmp.parseTarget('ups-nmc'), { community: 'public', host: 'ups-nmc', port: 161, name: 'ups-nmc' });
	assert.deepEqual(snmp.parseTarget('s3cret@10.0.0.5:1161'), { community: 's3cret', host: '10.0.0.5', port: 1161, name: '10.0.0.5:1161' });
	assert.equal(snmp.parseTarget('[::1]:161').host, '::1');
	assert.throws(() => snmp.parseTarget('a@b@c'));
});

test('APC PowerNet-MIB status', () => {
	const values = { [APC_MIB.outputStatus]: 3, [APC_MIB.batteryStatus]: 3, [APC_MIB.replaceBattery]: 2, [APC_MIB.commStatus]: 1 };
	assert.deepEqual(snmp.parseStatus(values), { commLost: false, onBattery: true, lowBattery: true, replaceBattery: true, shutdown: false });
	assert.deepEqual(snmp.parseStatus({ ...values, [APC_MIB.commStatus]: 2 }), { commLost: true });
});

test('RFC 1628 UPS-MIB status', () => {
	assert.deepEqual(snmp.parseStatus({ [UPS_MIB.outputSource]: 5, [UPS_MIB.batteryStatus]: 4 }),
		{ commLost: false, onBattery: true, lowBattery: true, replaceBattery: false, shutdown: false });
	assert.equal(snmp.parseStatus({ [UPS_MIB.outputSource]: 3, [UPS_MIB.batteryStatus]: 2 }).onBattery, false);
	assert.throws(() => snmp.parseStatus({}), /neither/);
});

test('polls an APC agent over UDP with the configured community', async () => {
	const mib = { [APC_MIB.outputStatus]: 3, [APC_MIB.batteryStatus]: 2, [APC_MIB.replaceBattery]: 1, [APC_MIB.commStatus]: 1 };
	const agent = await fakeAgent(msg => encodeResponse(msg, mib));
	try {
		const state = await snmp.poll(agent.target());
		assert.equal(state.onBattery, true);
		assert.equal(state.lowBattery, false);
		const [version, community] = snmp.decode(agent.seen[0]).children;
		assert.equal(version.value[0], 1);
		assert.equal(community.value.toString(), 'secret');
	} finally {
		agent.socket.close();
	}
});

test('falls back to UPS-MIB when the APC OIDs are missing', async () => {
	const agent = await fakeAgent(msg => encodeResponse(msg, { [UPS_MIB.outputSource]: 3, [UPS_MIB.batteryStatus]: 3 }));
	try {
		assert.deepEqual(await snmp.poll(agent.target()),
			{ commLost: false, onBattery: false, lowBattery: true, replaceBattery: false, shutdown: false });
	} finally {
		agent.socket.close();
	}
});

test('ignores responses to someone else\'s request', async () => {
	const mib = { [UPS_MIB.outputSource]: 5 };
	const agent = await fakeAgent(msg => [encodeResponse(msg, {}, { requestId: 42 }), encodeResponse(msg, mib)]);
	try {
		assert.equal((await snmp.poll(agent.target())).onBattery, true);
	} finally {
		agent.socket.close();
	}
});

test('an agent error or silence rejects', async () => {
	const erroring = await fakeAgent(msg => encodeResponse(msg, {}, { errorStatus: 5 }));
	const silent = await fakeAgent(() => []);
	try {
		await assert.rejects(snmp.get(erroring.target(), snmp.OIDS), /error-status 5/);
		await assert.rejects(snmp.get({ ...silent.target(), timeout: 50 }, snmp.OIDS), /no SNMP response/);
	} finally {
		erroring.socket.close();
		silent.socket.close();
	}
});
