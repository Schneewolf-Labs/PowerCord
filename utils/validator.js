const Joi = require('joi');
const logger = require('./logger');

/**
 * Environment variables schema
 */
const envSchema = Joi.object({
    DISCORD_TOKEN: Joi.string().required()
        .description('Discord bot token'),
    DISCORD_CHANNEL_ID: Joi.string().required()
        .description('Discord channel ID to send messages to'),
    PORT: Joi.number().port().default(1100)
        .description('Server port'),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('production')
        .description('Node environment'),
    WEBHOOK_SECRET: Joi.string().min(16)
        .description('Secret for webhook authentication (optional but recommended)'),
    LOG_LEVEL: Joi.string()
        .valid('error', 'warn', 'info', 'debug')
        .default('info')
        .description('Logging level'),
}).unknown(true); // Allow other env vars

/**
 * UPS event request body schema
 */
const upsEventSchema = Joi.object({
    eventType: Joi.string().required()
        .valid(
            'onbattery',
            'offbattery',
            'commok',
            'commfailure',
            'changeme',
            'failing',
            'loadlimit',
            'runlimit',
            'timeout',
            'startself',
            'battdetach',
            'battattach',
            'doshutdown',
            'mainsback',
            'annoyme',
            'emergency',
            'changeme',
            'remotedown'
        )
        .description('Type of UPS event'),
    secret: Joi.string()
        .description('Authentication secret'),
    metadata: Joi.object()
        .description('Additional event metadata')
}).unknown(false);

/**
 * Validate environment variables
 * @throws {Error} If validation fails
 * @returns {Object} Validated environment variables
 */
const validateEnv = () => {
    const { error, value } = envSchema.validate(process.env, {
        abortEarly: false,
        stripUnknown: false
    });

    if (error) {
        const errors = error.details.map(detail => detail.message).join(', ');
        logger.error(`Environment validation failed: ${errors}`);
        throw new Error(`Environment validation failed: ${errors}`);
    }

    logger.info('Environment variables validated successfully');
    return value;
};

/**
 * Validate UPS event request
 * @param {Object} data - Request data to validate
 * @returns {Object} Validation result with error or value
 */
const validateUpsEvent = (data) => {
    const { error, value } = upsEventSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => detail.message).join(', ');
        return { error: errors, value: null };
    }

    return { error: null, value };
};

module.exports = {
    validateEnv,
    validateUpsEvent,
};
