const express = require('express');

// Any apcupsd event with a message in config.json is forwarded; the rest are rejected
// so a typo in an /etc/apcupsd script shows up in its output instead of silently.
function createApp(messages, send) {
	const app = express();
	app.use(express.json());

	app.post('/ups-event', (req, res) => {
		const eventType = req.body?.eventType;
		const message = Object.hasOwn(messages, eventType) ? messages[eventType] : undefined;
		if (!message) {
			console.warn(`Unknown event type: ${eventType}`);
			return res.status(400).send(`unknown eventType: ${eventType}`);
		}
		send(message).catch(err => console.error(`Failed to send ${eventType}: ${err.message}`));
		res.sendStatus(200);
	});

	return app;
}

module.exports = { createApp };
