const request = require('supertest');
const express = require('express');
const healthRoutes = require('../routes/health');

describe('Health Routes', () => {
    let app;
    let mockDiscordClient;

    beforeEach(() => {
        app = express();

        // Mock Discord client
        mockDiscordClient = {
            getStatus: jest.fn(() => ({
                isReady: true,
                queuedMessages: 0,
                uptime: 12345,
                ping: 50
            }))
        };

        app.set('discordClient', mockDiscordClient);
        app.use(healthRoutes);
    });

    describe('GET /health', () => {
        it('should return 200 and health status', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('nodeVersion');
        });
    });

    describe('GET /status', () => {
        it('should return 200 with full status when Discord is connected', async () => {
            const response = await request(app).get('/status');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('server');
            expect(response.body).toHaveProperty('discord');
            expect(response.body.discord.connected).toBe(true);
        });

        it('should return 503 if Discord client not initialized', async () => {
            app.set('discordClient', null);
            const response = await request(app).get('/status');

            expect(response.status).toBe(503);
            expect(response.body).toHaveProperty('status', 'error');
        });
    });

    describe('GET /ready', () => {
        it('should return 200 when Discord is ready', async () => {
            const response = await request(app).get('/ready');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ready');
        });

        it('should return 503 when Discord is not ready', async () => {
            mockDiscordClient.getStatus.mockReturnValue({
                isReady: false,
                queuedMessages: 0,
                uptime: 0,
                ping: 0
            });

            const response = await request(app).get('/ready');

            expect(response.status).toBe(503);
            expect(response.body).toHaveProperty('status', 'not ready');
        });
    });

    describe('GET /alive', () => {
        it('should always return 200', async () => {
            const response = await request(app).get('/alive');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'alive');
        });
    });
});
