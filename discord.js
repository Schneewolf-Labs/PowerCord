const { Client, GatewayIntentBits } = require('discord.js');

class Discord {
    constructor(token, channel) {
        this.token = token;
        this.channel = channel;
        this.intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        this.client = new Client({ intents: this.intents });

        this.client.once(Events.ClientReady, c => {
            logger.info(`Discord Ready! Logged in as ${c.user.tag}`);
        });

        this.connect();
    }

    connect() {
        this.client.login(this.token);
    }

    send(message) {
        const channel = this.client.channels.cache.get(this.channel);
        channel.send(message);
    }
}

module.exports = Discord;