/**
 * Integration tests for the entire application
 * Note: These tests mock the Discord client to avoid requiring actual Discord credentials
 */

// Mock Discord before requiring the app
jest.mock('../discord', () => {
    return jest.fn().mockImplementation(() => ({
        isReady: true,
        send: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn(() => ({
            isReady: true,
            queuedMessages: 0,
            uptime: 12345,
            ping: 50
        }))
    }));
});

const request = require('supertest');

describe('Integration Tests', () => {
    let app;

    beforeAll(() => {
        // Require app once for all tests
        app = require('../index');
    });

    describe('Application Startup', () => {
        it('should start successfully', () => {
            expect(app).toBeDefined();
        });

        it('should respond to root endpoint', async () => {
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('name', 'PowerCord');
            expect(response.body).toHaveProperty('endpoints');
        });
    });

    describe('Complete UPS Event Flow', () => {
        const secret = process.env.WEBHOOK_SECRET;

        it('should handle complete onbattery event flow', async () => {
            const response = await request(app)
                .post('/ups-event')
                .send({ eventType: 'onbattery', secret });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
        });

        it('should handle multiple events sequentially', async () => {
            const events = ['onbattery', 'offbattery', 'commfailure', 'commok'];

            for (const eventType of events) {
                const response = await request(app)
                    .post('/ups-event')
                    .send({ eventType, secret });

                expect(response.status).toBe(200);
            }
        });
    });

    describe('Health Check Flow', () => {
        it('should report healthy status', async () => {
            const health = await request(app).get('/health');
            const status = await request(app).get('/status');
            const ready = await request(app).get('/ready');
            const alive = await request(app).get('/alive');

            expect(health.status).toBe(200);
            expect(status.status).toBe(200);
            expect(ready.status).toBe(200);
            expect(alive.status).toBe(200);
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 for unknown routes', async () => {
            const response = await request(app).get('/nonexistent');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Not Found');
        });

        it('should handle invalid JSON', async () => {
            const response = await request(app)
                .post('/ups-event')
                .set('Content-Type', 'application/json')
                .send('invalid json{');

            expect(response.status).toBe(400);
        });
    });

    describe('Security Features', () => {
        it('should include security headers', async () => {
            const response = await request(app).get('/');

            // Helmet adds security headers
            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
        });
    });
});
