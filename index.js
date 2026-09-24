require('dotenv').config();
const config = require('./config.json');
const { createApp } = require('./app');

// apcupsd's event scripts call this from the same box; anything else on the network
// should not be able to post fake power alerts.
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 1100;

const Discord = require('./discord');
const discordClient = new Discord(process.env.DISCORD_TOKEN, process.env.DISCORD_CHANNEL_ID);

const app = createApp(config, message => discordClient.send(message));

app.listen(PORT, HOST, () => {
	console.log(`Server listening on ${HOST}:${PORT}`);
});
