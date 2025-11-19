require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const logger = require('./utils/logger');
const { validateEnv } = require('./utils/validator');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health');
const upsRoutes = require('./routes/ups');
const Discord = require('./discord');
const config = require('./config.json');

/**
 * Validate environment variables on startup
 */
let env;
try {
    env = validateEnv();
} catch (error) {
    console.error('Failed to start: Invalid environment configuration');
    console.error(error.message);
    process.exit(1);
}

const PORT = env.PORT || 1100;

/**
 * Initialize Express app
 */
const app = express();

// Security middleware
app.use(helmet());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// Apply rate limiting to all routes
app.use(apiRateLimiter);

/**
 * Initialize Discord client
 */
let discordClient;
try {
    discordClient = new Discord(env.DISCORD_TOKEN, env.DISCORD_CHANNEL_ID);
    app.set('discordClient', discordClient);
    app.set('config', config);
    logger.info('Discord client initialized');
} catch (error) {
    logger.error('Failed to initialize Discord client:', error);
    process.exit(1);
}

/**
 * Mount routes
 */
app.use('/', healthRoutes);
app.use('/', upsRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'PowerCord',
        description: 'UPS monitoring and Discord notification service',
        version: '2.0.0',
        endpoints: {
            health: 'GET /health',
            status: 'GET /status',
            ready: 'GET /ready',
            alive: 'GET /alive',
            upsEvent: 'POST /ups-event'
        }
    });
});

/**
 * Error handling
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Start server
 */
let server;
try {
    server = app.listen(PORT, () => {
        logger.info(`PowerCord server listening on port ${PORT}`);
        logger.info(`Environment: ${env.NODE_ENV}`);
        logger.info(`Log level: ${env.LOG_LEVEL}`);
    });
} catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
}

/**
 * Graceful shutdown handler
 */
const shutdown = async (signal) => {
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
        logger.info('HTTP server closed');

        try {
            // Disconnect Discord client
            if (discordClient) {
                await discordClient.disconnect();
            }

            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forcefully shutting down after timeout');
        process.exit(1);
    }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
});

module.exports = app; // Export for testing
