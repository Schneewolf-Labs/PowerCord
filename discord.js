const { Client, GatewayIntentBits, Events } = require('discord.js');

class Discord {
    constructor(token, channel) {
        this.token = token;
        this.channel = channel;
        this.intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        this.client = new Client({ intents: this.intents });

        // events that arrive while still connecting wait for this instead of throwing
        this.ready = new Promise(resolve => {
            this.client.once(Events.ClientReady, c => {
                console.log(`Discord Ready! Logged in as ${c.user.tag}`);
                resolve();
            });
        });

        // an 'error' event with no listener throws and takes the process down
        this.client.on(Events.Error, err => {
            console.error(`Discord client error: ${err.message}`);
        });

        this.connect();
    }

    connect() {
        this.client.login(this.token).catch(err => {
            console.error(`Discord login failed: ${err.message}`);
            process.exit(1);
        });
    }

    async send(message) {
        await this.ready;
        const channel = await this.client.channels.fetch(this.channel);
        if (!channel) {
            throw new Error(`channel ${this.channel} not found`);
        }
        await channel.send(message);
    }
}

module.exports = Discord;
