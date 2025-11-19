/**
 * Jest test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test_token_1234567890';
process.env.DISCORD_CHANNEL_ID = '1234567890';
process.env.PORT = '3000';
process.env.LOG_LEVEL = 'error'; // Minimize logging during tests
process.env.WEBHOOK_SECRET = 'test_secret_webhook_1234567890';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Increase timeout for async operations
jest.setTimeout(10000);
