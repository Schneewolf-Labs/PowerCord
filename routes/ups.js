const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { validateUpsEvent } = require('../utils/validator');
const { verifyWebhookSecret } = require('../middleware/auth');
const { webhookRateLimiter } = require('../middleware/rateLimiter');

/**
 * UPS event webhook endpoint
 * @route POST /ups-event
 */
router.post('/ups-event',
    webhookRateLimiter,
    verifyWebhookSecret,
    async (req, res, next) => {
        try {
            // Validate request body
            const { error, value } = validateUpsEvent(req.body);

            if (error) {
                logger.warn('Invalid UPS event request', {
                    error,
                    body: req.body,
                    ip: req.ip
                });
                return res.status(400).json({
                    error: 'Bad Request',
                    message: error
                });
            }

            const { eventType, metadata } = value;
            logger.info('UPS event received', { eventType, metadata });

            // Get Discord client and config
            const discordClient = req.app.get('discordClient');
            const config = req.app.get('config');

            if (!discordClient) {
                logger.error('Discord client not available');
                return res.status(503).json({
                    error: 'Service Unavailable',
                    message: 'Discord client not initialized'
                });
            }

            // Get message for event type
            const message = config[eventType];

            if (!message) {
                logger.warn(`No message configured for event type: ${eventType}`);
                return res.status(200).json({
                    status: 'ok',
                    message: 'Event received but no message configured'
                });
            }

            // Send message to Discord with embed
            await discordClient.send(message, eventType);

            logger.info('UPS event processed successfully', { eventType });

            res.status(200).json({
                status: 'ok',
                message: 'Event processed successfully',
                eventType
            });

        } catch (error) {
            logger.error('Error processing UPS event:', error);
            next(error);
        }
    }
);

module.exports = router;