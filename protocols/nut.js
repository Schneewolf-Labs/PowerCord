const { request } = require('./tcp');

// upsmon NOTIFYTYPEs, for NOTIFYCMD scripts that post straight to /ups-event.
// Mapped onto the apcupsd names so one set of messages in config.json covers both.
const NOTIFY_EVENTS = {
	ONBATT: 'onbattery',
	ONLINE: 'offbattery',
	LOWBATT: 'lowbattery',
	COMMBAD: 'commfailure',
	NOCOMM: 'commfailure',
	COMMOK: 'commok',
	REPLBATT: 'changeme',
	FSD: 'doshutdown',
	SHUTDOWN: 'doshutdown',
};

// "ups@host[:port]", the same spelling upsc and upsmon use.
function parseTarget(spec) {
	const match = /^([^@\s]+)@([^:\s]+)(?::(\d+))?$/.exec(spec);
	if (!match) {
		throw new Error(`bad NUT target "${spec}", expected ups@host[:port]`);
	}
	return { ups: match[1], host: match[2], port: Number(match[3]) || 3493, name: spec };
}

// Errors that mean upsd is fine but has lost the UPS, as opposed to a misconfiguration.
const STALE = new Set(['DATA-STALE', 'DRIVER-NOT-CONNECTED']);

function parseStatus(status) {
	const flags = new Set(status.trim().split(/\s+/));
	return {
		commLost: false,
		onBattery: flags.has('OB'),
		lowBattery: flags.has('LB'),
		replaceBattery: flags.has('RB'),
		shutdown: flags.has('FSD'),
	};
}

function parseResponse(line, ups) {
	const err = /^ERR (\S+)/.exec(line);
	if (err) {
		if (STALE.has(err[1])) {
			return { commLost: true };
		}
		throw new Error(`upsd refused ${ups}: ${err[1]}`);
	}
	const value = /^VAR \S+ ups\.status "(.*)"$/.exec(line);
	if (!value) {
		throw new Error(`unexpected upsd response: ${line}`);
	}
	return parseStatus(value[1]);
}

async function poll(target) {
	const buf = await request(target, `GET VAR ${target.ups} ups.status\n`, b => b.includes(0x0a));
	return parseResponse(buf.toString('utf8').split('\n')[0].trim(), target.ups);
}

module.exports = { NOTIFY_EVENTS, parseTarget, parseStatus, parseResponse, poll };
