require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const PORT = 1100;
const config = require('./config.json');

const Discord = require('./discord');
const discordClient = new Discord(process.env.DISCORD_TOKEN, process.env.DISCORD_CHANNEL_ID);

// Handle UPS events
app.post('/ups-event', (req, res) => {
	const eventType = req.body.eventType;
	switch (eventType) {
		case 'onbattery':
			// Handle on battery event
			discordClient.send(config.onbattery);
			break;
		case 'offbattery':
			// Handle off battery event
			discordClient.send(config.offbattery);
			break;
		case 'commok':
			// Handle communication restored event
			discordClient.send(config.commok);
			break;
		case 'commfailure':
			// Handle communication failure event
			discordClient.send(config.commfailure);
			break;
		default:
			console.warn(`Unknown event type: ${eventType}`);
	}
	res.sendStatus(200);
});

app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
