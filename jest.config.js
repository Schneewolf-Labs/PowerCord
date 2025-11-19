module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/logs/**',
        '!jest.config.js',
        '!eslint.config.js'
    ],
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 40,
            lines: 50,
            statements: 50
        }
    },
    testTimeout: 10000,
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
