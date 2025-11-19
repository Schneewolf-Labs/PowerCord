const { validateEnv, validateUpsEvent } = require('../utils/validator');

describe('Validator', () => {
    describe('validateEnv', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            jest.resetModules();
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        it('should validate valid environment variables', () => {
            process.env.DISCORD_TOKEN = 'test_token';
            process.env.DISCORD_CHANNEL_ID = '123456';
            process.env.PORT = '1100';

            const result = validateEnv();
            expect(result.DISCORD_TOKEN).toBe('test_token');
            expect(result.DISCORD_CHANNEL_ID).toBe('123456');
        });

        it('should throw error if DISCORD_TOKEN is missing', () => {
            delete process.env.DISCORD_TOKEN;
            expect(() => validateEnv()).toThrow();
        });

        it('should throw error if DISCORD_CHANNEL_ID is missing', () => {
            process.env.DISCORD_TOKEN = 'test_token';
            delete process.env.DISCORD_CHANNEL_ID;
            expect(() => validateEnv()).toThrow();
        });

        it('should use default values for optional fields', () => {
            process.env.DISCORD_TOKEN = 'test_token';
            process.env.DISCORD_CHANNEL_ID = '123456';
            delete process.env.PORT;
            delete process.env.LOG_LEVEL;

            const result = validateEnv();
            expect(result.PORT).toBe(1100);
            expect(result.LOG_LEVEL).toBe('info');
        });
    });

    describe('validateUpsEvent', () => {
        it('should validate valid UPS event', () => {
            const event = { eventType: 'onbattery' };
            const result = validateUpsEvent(event);

            expect(result.error).toBeNull();
            expect(result.value.eventType).toBe('onbattery');
        });

        it('should reject invalid event type', () => {
            const event = { eventType: 'invalid_event' };
            const result = validateUpsEvent(event);

            expect(result.error).toBeTruthy();
            expect(result.value).toBeNull();
        });

        it('should reject missing event type', () => {
            const event = {};
            const result = validateUpsEvent(event);

            expect(result.error).toBeTruthy();
            expect(result.value).toBeNull();
        });

        it('should accept all valid event types', () => {
            const validEvents = [
                'onbattery', 'offbattery', 'commok', 'commfailure',
                'changeme', 'failing', 'loadlimit', 'runlimit',
                'timeout', 'startself', 'battdetach', 'battattach',
                'doshutdown', 'mainsback', 'annoyme', 'emergency', 'remotedown'
            ];

            validEvents.forEach(eventType => {
                const result = validateUpsEvent({ eventType });
                expect(result.error).toBeNull();
                expect(result.value.eventType).toBe(eventType);
            });
        });

        it('should reject unknown fields', () => {
            const event = {
                eventType: 'onbattery',
                unknownField: 'should be rejected'
            };
            const result = validateUpsEvent(event);

            expect(result.error).toBeTruthy();
            expect(result.value).toBeNull();
        });
    });
});
