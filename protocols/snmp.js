const dgram = require('node:dgram');
const net = require('node:net');
const crypto = require('node:crypto');

// Just enough BER for an SNMPv2c GetRequest and its Response. v2c rather than v1 because
// a v2c agent answers an OID it doesn't have with a per-varbind noSuchObject instead of
// failing the whole request, which lets one GET ask both MIBs and use whichever answers.

const TAG = {
	INTEGER: 0x02,
	OCTET_STRING: 0x04,
	NULL: 0x05,
	OID: 0x06,
	SEQUENCE: 0x30,
	GET_REQUEST: 0xa0,
	RESPONSE: 0xa2,
};

function encodeLength(len) {
	if (len < 0x80) return Buffer.from([len]);
	const bytes = [];
	for (let n = len; n > 0; n >>= 8) bytes.unshift(n & 0xff);
	return Buffer.from([0x80 | bytes.length, ...bytes]);
}

const tlv = (tag, body) => Buffer.concat([Buffer.from([tag]), encodeLength(body.length), body]);

function encodeInteger(value) {
	const bytes = [];
	let n = value;
	do {
		bytes.unshift(n & 0xff);
		n >>= 8;
	} while (!((n === 0 && !(bytes[0] & 0x80)) || (n === -1 && bytes[0] & 0x80)));
	return tlv(TAG.INTEGER, Buffer.from(bytes));
}

function encodeOid(oid) {
	const parts = oid.split('.').map(Number);
	const bytes = [40 * parts[0] + parts[1]];
	for (const part of parts.slice(2)) {
		const chunk = [part & 0x7f];
		for (let n = part >>> 7; n > 0; n >>>= 7) chunk.unshift(0x80 | (n & 0x7f));
		bytes.push(...chunk);
	}
	return tlv(TAG.OID, Buffer.from(bytes));
}

function encodeGetRequest(community, requestId, oids) {
	const varbinds = oids.map(oid => tlv(TAG.SEQUENCE, Buffer.concat([encodeOid(oid), tlv(TAG.NULL, Buffer.alloc(0))])));
	const pdu = tlv(TAG.GET_REQUEST, Buffer.concat([
		encodeInteger(requestId),
		encodeInteger(0), // error-status
		encodeInteger(0), // error-index
		tlv(TAG.SEQUENCE, Buffer.concat(varbinds)),
	]));
	return tlv(TAG.SEQUENCE, Buffer.concat([
		encodeInteger(1), // version: v2c
		tlv(TAG.OCTET_STRING, Buffer.from(community)),
		pdu,
	]));
}

// Constructed types (bit 0x20) are parsed into children, everything else is left as bytes.
function decode(buf, offset = 0) {
	const tag = buf[offset];
	let len = buf[offset + 1];
	let start = offset + 2;
	if (len & 0x80) {
		const count = len & 0x7f;
		len = buf.readUIntBE(start, count);
		start += count;
	}
	const end = start + len;
	if (tag === undefined || end > buf.length) {
		throw new Error('truncated SNMP packet');
	}
	const node = { tag, end };
	if (tag & 0x20) {
		node.children = [];
		for (let pos = start; pos < end; pos = node.children.at(-1).end) {
			node.children.push(decode(buf, pos));
		}
	} else {
		node.value = buf.subarray(start, end);
	}
	return node;
}

function decodeInteger(bytes) {
	return bytes.length ? bytes.readIntBE(0, Math.min(bytes.length, 6)) : 0;
}

function decodeOid(bytes) {
	const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
	let n = 0;
	for (const byte of bytes.subarray(1)) {
		n = n * 128 + (byte & 0x7f);
		if (!(byte & 0x80)) {
			parts.push(n);
			n = 0;
		}
	}
	return parts.join('.');
}

// Returns { requestId, errorStatus, values: { oid: integer | undefined } }; OIDs the agent
// doesn't have (noSuchObject/noSuchInstance) come back undefined.
function decodeResponse(buf) {
	const [, , pdu] = decode(buf).children;
	if (pdu?.tag !== TAG.RESPONSE) {
		throw new Error('not an SNMP response');
	}
	const [requestId, errorStatus, , varbinds] = pdu.children;
	const values = {};
	for (const { children: [oid, value] } of varbinds.children) {
		values[decodeOid(oid.value)] = value.tag === TAG.INTEGER ? decodeInteger(value.value) : undefined;
	}
	return { requestId: decodeInteger(requestId.value), errorStatus: decodeInteger(errorStatus.value), values };
}

function get({ host, port, community, timeout = 5000 }, oids) {
	return new Promise((resolve, reject) => {
		const socket = dgram.createSocket(net.isIPv6(host) ? 'udp6' : 'udp4');
		const requestId = crypto.randomInt(1, 0x7fffffff);
		const done = (err, result) => {
			clearTimeout(timer);
			socket.close();
			err ? reject(err) : resolve(result);
		};
		// A wrong community is silently dropped by the agent, so it looks exactly like this.
		const timer = setTimeout(() => done(new Error(`no SNMP response from ${host}:${port}`)), timeout);

		socket.on('error', done);
		socket.on('message', msg => {
			let response;
			try {
				response = decodeResponse(msg);
			} catch {
				return; // not ours or garbled; keep waiting until the timeout
			}
			if (response.requestId !== requestId) return;
			if (response.errorStatus !== 0) {
				return done(new Error(`SNMP error-status ${response.errorStatus} from ${host}:${port}`));
			}
			done(null, response.values);
		});
		socket.send(encodeGetRequest(community, requestId, oids), port, host);
	});
}

// RFC 1628 UPS-MIB, the vendor-neutral one.
const UPS_MIB = {
	outputSource: '1.3.6.1.2.1.33.1.4.1.0', // 5 = battery
	batteryStatus: '1.3.6.1.2.1.33.1.2.1.0', // 3 = low, 4 = depleted
};

// APC PowerNet-MIB, since plenty of APC network cards don't implement UPS-MIB.
const APC_MIB = {
	outputStatus: '1.3.6.1.4.1.318.1.1.1.4.1.1.0', // 3 = onBattery
	batteryStatus: '1.3.6.1.4.1.318.1.1.1.2.1.1.0', // 3 = low
	replaceBattery: '1.3.6.1.4.1.318.1.1.1.2.2.4.0', // 2 = needs replacing
	commStatus: '1.3.6.1.4.1.318.1.1.1.8.1.0', // 2 = card has lost the UPS
};

const OIDS = [...Object.values(UPS_MIB), ...Object.values(APC_MIB)];

function parseStatus(values) {
	const apc = key => values[APC_MIB[key]];
	const std = key => values[UPS_MIB[key]];

	if (apc('outputStatus') !== undefined) {
		if (apc('commStatus') === 2) return { commLost: true };
		return {
			commLost: false,
			onBattery: apc('outputStatus') === 3,
			lowBattery: apc('batteryStatus') === 3,
			replaceBattery: apc('replaceBattery') === 2,
			shutdown: false,
		};
	}
	if (std('outputSource') !== undefined) {
		return {
			commLost: false,
			onBattery: std('outputSource') === 5,
			lowBattery: std('batteryStatus') === 3 || std('batteryStatus') === 4,
			// UPS-MIB only reports these through its alarm table, which needs a walk.
			replaceBattery: false,
			shutdown: false,
		};
	}
	throw new Error('agent implements neither UPS-MIB nor the APC PowerNet-MIB');
}

// "[community@]host[:port]"; community defaults to public. IPv6 hosts go in brackets.
function parseTarget(spec) {
	const match = /^(?:([^@\s]+)@)?(\[[^\]\s]+\]|[^:@\s]+)(?::(\d+))?$/.exec(spec);
	if (!match) {
		throw new Error(`bad SNMP target "${spec}", expected [community@]host[:port]`);
	}
	const host = match[2].replace(/^\[|\]$/g, '');
	const port = Number(match[3]) || 161;
	// the name ends up in Discord, so leave the community out of it
	return { community: match[1] || 'public', host, port, name: `${match[2]}${match[3] ? `:${port}` : ''}` };
}

async function poll(target) {
	return parseStatus(await get(target, OIDS));
}

module.exports = {
	encodeInteger, encodeOid, encodeGetRequest, decode, decodeOid, decodeResponse,
	get, parseStatus, parseTarget, poll, UPS_MIB, APC_MIB, OIDS, TAG, tlv,
};
