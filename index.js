require('dotenv').config();
const config = require('./config.json');
const { createApp, label } = require('./app');
const { startMonitor } = require('./monitor');
const nut = require('./protocols/nut');
const apcupsd = require('./protocols/apcupsd');

// apcupsd's event scripts call this from the same box; anything else on the network
// should not be able to post fake power alerts.
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 1100;
const POLL_INTERVAL = (Number(process.env.POLL_INTERVAL) || 5) * 1000;

const Discord = require('./discord');
const discordClient = new Discord(process.env.DISCORD_TOKEN, process.env.DISCORD_CHANNEL_ID);
const send = message => discordClient.send(message);

const app = createApp(config, send);

app.listen(PORT, HOST, () => {
	console.log(`Server listening on ${HOST}:${PORT}`);
});

// Polling is opt-in: the /ups-event hooks above keep working without it.
const list = value => (value || '').split(',').map(s => s.trim()).filter(Boolean);
const targets = [
	...list(process.env.NUT_UPS).map(spec => ({ protocol: nut, target: nut.parseTarget(spec) })),
	...list(process.env.APCUPSD_NIS).map(spec => ({ protocol: apcupsd, target: apcupsd.parseTarget(spec) })),
];

for (const { protocol, target } of targets) {
	const ups = targets.length > 1 ? target.name : undefined;
	startMonitor({
		name: target.name,
		interval: POLL_INTERVAL,
		poll: () => protocol.poll(target),
		emit: event => {
			const message = config[event];
			if (!message) {
				return console.warn(`${target.name}: no message configured for ${event}`);
			}
			send(label(message, ups)).catch(err => console.error(`Failed to send ${event}: ${err.message}`));
		},
	});
	console.log(`Polling ${target.name} every ${POLL_INTERVAL / 1000}s`);
}
