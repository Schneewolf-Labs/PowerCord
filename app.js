const express = require('express');
const { NOTIFY_EVENTS } = require('./protocols/nut');

// Prefixed with the UPS name when there's more than one to tell apart.
const label = (message, ups) => (ups ? `[${ups}] ${message}` : message);

// An event name is looked up as-is first, then as a NUT NOTIFYTYPE (ONBATT, LOWBATT...).
function lookup(messages, eventType) {
	if (Object.hasOwn(messages, eventType)) return messages[eventType];
	if (Object.hasOwn(NOTIFY_EVENTS, eventType)) return messages[NOTIFY_EVENTS[eventType]];
	return undefined;
}

// Any apcupsd event with a message in config.json is forwarded; the rest are rejected
// so a typo in an /etc/apcupsd script shows up in its output instead of silently.
function createApp(messages, send) {
	const app = express();
	app.use(express.json());

	app.post('/ups-event', (req, res) => {
		const eventType = req.body?.eventType;
		const ups = typeof req.body?.ups === 'string' ? req.body.ups : undefined;
		const message = lookup(messages, eventType);
		if (!message) {
			console.warn(`Unknown event type: ${eventType}`);
			return res.status(400).send(`unknown eventType: ${eventType}`);
		}
		send(label(message, ups)).catch(err => console.error(`Failed to send ${eventType}: ${err.message}`));
		res.sendStatus(200);
	});

	return app;
}

module.exports = { createApp, label };
