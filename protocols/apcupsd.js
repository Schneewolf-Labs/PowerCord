const { request } = require('./tcp');

// apcupsd's Network Information Server (NISIP/NISPORT in apcupsd.conf). Records in both
// directions are a 2-byte big-endian length followed by text; a zero length ends the reply.
function frame(text) {
	const body = Buffer.from(text, 'ascii');
	const len = Buffer.alloc(2);
	len.writeUInt16BE(body.length);
	return Buffer.concat([len, body]);
}

// Returns the records, or null while the terminating empty record hasn't arrived yet.
function readRecords(buf) {
	const records = [];
	let offset = 0;
	while (offset + 2 <= buf.length) {
		const len = buf.readUInt16BE(offset);
		offset += 2;
		if (len === 0) {
			return records;
		}
		if (offset + len > buf.length) {
			return null;
		}
		records.push(buf.toString('ascii', offset, offset + len));
		offset += len;
	}
	return null;
}

function parseTarget(spec) {
	const match = /^([^:\s]+)(?::(\d+))?$/.exec(spec);
	if (!match) {
		throw new Error(`bad apcupsd target "${spec}", expected host[:port]`);
	}
	return { host: match[1], port: Number(match[2]) || 3551, name: spec };
}

// "STATUS   : ONBATT LOWBATT" and friends, keyed by the left-hand side.
function parseRecords(records) {
	const fields = {};
	for (const record of records) {
		const sep = record.indexOf(':');
		if (sep !== -1) {
			fields[record.slice(0, sep).trim()] = record.slice(sep + 1).trim();
		}
	}
	return fields;
}

function parseStatus(status) {
	if (status === undefined) {
		throw new Error('apcupsd reply had no STATUS field');
	}
	if (status.includes('COMMLOST')) {
		return { commLost: true };
	}
	const flags = new Set(status.split(/\s+/));
	return {
		commLost: false,
		onBattery: flags.has('ONBATT'),
		lowBattery: flags.has('LOWBATT'),
		replaceBattery: flags.has('REPLACEBATT'),
		shutdown: status.includes('SHUTTING DOWN'),
	};
}

async function poll(target) {
	const buf = await request(target, frame('status'), b => readRecords(b) !== null);
	return parseStatus(parseRecords(readRecords(buf)).STATUS);
}

module.exports = { frame, readRecords, parseTarget, parseRecords, parseStatus, poll };
