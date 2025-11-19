const request = require('supertest');
const express = require('express');
const upsRoutes = require('../routes/ups');

describe('UPS Routes', () => {
    let app;
    let mockDiscordClient;
    let mockConfig;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock Discord client
        mockDiscordClient = {
            send: jest.fn().mockResolvedValue(undefined)
        };

        // Mock config
        mockConfig = {
            onbattery: 'Warning: running on battery!',
            offbattery: 'AC power restored',
            commok: 'Communication OK',
            commfailure: 'Communication failed'
        };

        app.set('discordClient', mockDiscordClient);
        app.set('config', mockConfig);
        app.use(upsRoutes);
    });

    describe('POST /ups-event', () => {
        const secret = process.env.WEBHOOK_SECRET;

        it('should process valid UPS event', async () => {
            const response = await request(app)
                .post('/ups-event')
                .send({ eventType: 'onbattery', secret });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
            expect(mockDiscordClient.send).toHaveBeenCalledWith(
                mockConfig.onbattery,
                'onbattery'
            );
        });

        it('should reject invalid event type', async () => {
            const response = await request(app)
                .post('/ups-event')
                .send({ eventType: 'invalid', secret });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should reject missing event type', async () => {
            const response = await request(app)
                .post('/ups-event')
                .send({ secret });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle events without configured messages', async () => {
            const response = await request(app)
                .post('/ups-event')
                .send({ eventType: 'changeme', secret });

            expect(response.status).toBe(200);
            expect(mockDiscordClient.send).not.toHaveBeenCalled();
        });

        it('should return 503 if Discord client not available', async () => {
            app.set('discordClient', null);

            const response = await request(app)
                .post('/ups-event')
                .send({ eventType: 'onbattery', secret });

            expect(response.status).toBe(503);
            expect(response.body).toHaveProperty('error', 'Service Unavailable');
        });

        it('should process all valid event types', async () => {
            const validEvents = ['onbattery', 'offbattery', 'commok', 'commfailure'];

            for (const eventType of validEvents) {
                const response = await request(app)
                    .post('/ups-event')
                    .send({ eventType, secret });

                expect(response.status).toBe(200);
            }
        });
    });
});
