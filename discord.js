const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const logger = require('./utils/logger');

/**
 * Discord client wrapper with message queuing and error handling
 */
class Discord {
    /**
     * @param {string} token - Discord bot token
     * @param {string} channelId - Discord channel ID
     */
    constructor(token, channelId) {
        this.token = token;
        this.channelId = channelId;
        this.isReady = false;
        this.messageQueue = [];
        this.retryAttempts = 3;
        this.retryDelay = 2000; // 2 seconds

        this.intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        this.client = new Client({ intents: this.intents });

        this.setupEventHandlers();
        this.connect();
    }

    /**
     * Setup Discord event handlers
     */
    setupEventHandlers() {
        this.client.once(Events.ClientReady, async (c) => {
            this.isReady = true;
            logger.info(`Discord Ready! Logged in as ${c.user.tag}`);

            // Verify channel access
            try {
                const channel = await this.client.channels.fetch(this.channelId);
                if (!channel) {
                    logger.error(`Channel ${this.channelId} not found`);
                    return;
                }
                logger.info(`Channel verified: ${channel.name} (${channel.id})`);

                // Process queued messages
                await this.processMessageQueue();
            } catch (error) {
                logger.error(`Failed to verify channel: ${error.message}`);
            }
        });

        this.client.on(Events.Error, (error) => {
            logger.error('Discord client error:', error);
        });

        this.client.on(Events.Warn, (warning) => {
            logger.warn('Discord client warning:', warning);
        });

        this.client.on(Events.ShardDisconnect, (event) => {
            logger.warn('Discord disconnected', { code: event.code, reason: event.reason });
        });

        this.client.on(Events.ShardReconnecting, () => {
            logger.info('Discord reconnecting...');
            this.isReady = false;
        });

        this.client.on(Events.ShardResume, () => {
            logger.info('Discord connection resumed');
            this.isReady = true;
        });
    }

    /**
     * Connect to Discord
     */
    async connect() {
        try {
            await this.client.login(this.token);
        } catch (error) {
            logger.error('Failed to login to Discord:', error);
            throw error;
        }
    }

    /**
     * Process queued messages
     */
    async processMessageQueue() {
        if (this.messageQueue.length === 0) return;

        logger.info(`Processing ${this.messageQueue.length} queued messages`);

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            try {
                await this.sendMessage(message);
            } catch (error) {
                logger.error('Failed to send queued message:', error);
                // Re-queue if failed
                this.messageQueue.push(message);
                break;
            }
        }
    }

    /**
     * Create an embed for UPS events
     * @param {string} eventType - Type of event
     * @param {string} message - Message text
     * @returns {EmbedBuilder} Discord embed
     */
    createEmbed(eventType, message) {
        const embed = new EmbedBuilder()
            .setTitle('UPS Event')
            .setDescription(message)
            .setTimestamp()
            .setFooter({ text: 'PowerCord UPS Monitor' });

        // Set color based on event severity
        const eventColors = {
            // Critical events - Red
            'onbattery': 0xFF0000,
            'failing': 0xFF0000,
            'doshutdown': 0xFF0000,
            'emergency': 0xFF0000,
            'battdetach': 0xFF0000,

            // Warning events - Yellow/Orange
            'commfailure': 0xFFA500,
            'loadlimit': 0xFFA500,
            'runlimit': 0xFFA500,
            'timeout': 0xFFA500,
            'changeme': 0xFFA500,
            'remotedown': 0xFFA500,

            // Info events - Blue
            'startself': 0x0099FF,
            'annoyme': 0x0099FF,
            'mainsback': 0x0099FF,

            // Success events - Green
            'offbattery': 0x00FF00,
            'commok': 0x00FF00,
            'battattach': 0x00FF00,
        };

        embed.setColor(eventColors[eventType] || 0x808080);

        // Add event type field
        embed.addFields({
            name: 'Event Type',
            value: `\`${eventType}\``,
            inline: true
        });

        return embed;
    }

    /**
     * Send a message to Discord
     * @param {string|Object} content - Message content (string or embed options)
     * @param {string} eventType - Type of event (for embed creation)
     * @returns {Promise<void>}
     */
    async send(content, eventType = null) {
        // If not ready, queue the message
        if (!this.isReady) {
            logger.info('Discord not ready, queuing message');
            this.messageQueue.push({ content, eventType });
            return;
        }

        await this.sendMessage({ content, eventType });
    }

    /**
     * Internal method to send message with retry logic
     * @param {Object} messageData - Message data
     * @param {number} attempt - Current retry attempt
     * @returns {Promise<void>}
     */
    async sendMessage(messageData, attempt = 1) {
        const { content, eventType } = messageData;

        try {
            const channel = await this.client.channels.fetch(this.channelId);

            if (!channel) {
                throw new Error(`Channel ${this.channelId} not found`);
            }

            if (!channel.isTextBased()) {
                throw new Error(`Channel ${this.channelId} is not a text channel`);
            }

            // Create embed if eventType provided
            const messageOptions = eventType
                ? { embeds: [this.createEmbed(eventType, content)] }
                : { content };

            await channel.send(messageOptions);
            logger.info(`Message sent successfully`, { eventType, attempt });

        } catch (error) {
            logger.error(`Failed to send message (attempt ${attempt}/${this.retryAttempts}):`, error);

            if (attempt < this.retryAttempts) {
                // Retry with exponential backoff
                const delay = this.retryDelay * attempt;
                logger.info(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendMessage(messageData, attempt + 1);
            } else {
                logger.error('Max retry attempts reached, message failed');
                throw error;
            }
        }
    }

    /**
     * Gracefully disconnect from Discord
     */
    async disconnect() {
        logger.info('Disconnecting from Discord...');
        this.isReady = false;
        await this.client.destroy();
        logger.info('Discord disconnected');
    }

    /**
     * Get connection status
     * @returns {boolean} True if connected and ready
     */
    getStatus() {
        return {
            isReady: this.isReady,
            queuedMessages: this.messageQueue.length,
            uptime: this.client.uptime,
            ping: this.client.ws.ping,
        };
    }
}

module.exports = Discord;