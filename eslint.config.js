module.exports = [
    {
        ignores: [
            'node_modules/**',
            'coverage/**',
            'logs/**',
            'dist/**',
            'build/**'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
            }
        },
        rules: {
            // Best practices
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-console': 'off', // Allow console in Node.js
            'no-debugger': 'error',

            // Style
            'indent': ['error', 4, { SwitchCase: 1 }],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'semi': ['error', 'always'],
            'comma-dangle': ['error', 'never'],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],

            // ES6+
            'prefer-const': 'warn',
            'no-var': 'warn',
            'arrow-spacing': 'error',

            // Error prevention
            'no-empty': 'warn',
            'no-unreachable': 'error',
            'no-dupe-keys': 'error'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                // Jest globals
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                jest: 'readonly'
            }
        }
    }
];
