const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter for webhook endpoints
 * Prevents abuse by limiting requests per IP
 */
const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per minute
    message: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path
        });
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.'
        });
    },
    skip: (req) => {
        // Skip rate limiting in test environment
        return process.env.NODE_ENV === 'test';
    }
});

/**
 * Rate limiter for general API endpoints
 */
const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // More lenient for health checks etc
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return process.env.NODE_ENV === 'test';
    }
});

module.exports = {
    webhookRateLimiter,
    apiRateLimiter,
};
