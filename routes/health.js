const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Health check endpoint
 * @route GET /health
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * Status endpoint with Discord connection info
 * @route GET /status
 */
router.get('/status', (req, res) => {
    const discordClient = req.app.get('discordClient');

    if (!discordClient) {
        return res.status(503).json({
            status: 'error',
            message: 'Discord client not initialized'
        });
    }

    const discordStatus = discordClient.getStatus();

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
            memoryUsage: process.memoryUsage()
        },
        discord: {
            connected: discordStatus.isReady,
            queuedMessages: discordStatus.queuedMessages,
            uptime: discordStatus.uptime,
            ping: discordStatus.ping
        }
    });
});

/**
 * Readiness probe (Kubernetes-style)
 * @route GET /ready
 */
router.get('/ready', (req, res) => {
    const discordClient = req.app.get('discordClient');

    if (!discordClient || !discordClient.getStatus().isReady) {
        return res.status(503).json({
            status: 'not ready',
            message: 'Discord client not ready'
        });
    }

    res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});

/**
 * Liveness probe (Kubernetes-style)
 * @route GET /alive
 */
router.get('/alive', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;