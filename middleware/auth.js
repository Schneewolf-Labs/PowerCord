const logger = require('../utils/logger');

/**
 * Middleware to verify webhook secret
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyWebhookSecret = (req, res, next) => {
    const configuredSecret = process.env.WEBHOOK_SECRET;

    // If no secret is configured, log warning but allow request
    if (!configuredSecret) {
        logger.warn('No WEBHOOK_SECRET configured - webhook endpoint is unprotected!');
        return next();
    }

    const providedSecret = req.body.secret || req.headers['x-webhook-secret'];

    if (!providedSecret) {
        logger.warn('Webhook request rejected - no secret provided', {
            ip: req.ip,
            path: req.path
        });
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Webhook secret required'
        });
    }

    if (providedSecret !== configuredSecret) {
        logger.warn('Webhook request rejected - invalid secret', {
            ip: req.ip,
            path: req.path
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid webhook secret'
        });
    }

    next();
};

module.exports = {
    verifyWebhookSecret,
};
