const { verifyWebhookSecret } = require('../middleware/auth');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');

describe('Middleware', () => {
    describe('verifyWebhookSecret', () => {
        let req, res, next;
        const originalEnv = process.env;

        beforeEach(() => {
            req = {
                body: {},
                headers: {},
                ip: '127.0.0.1',
                path: '/test'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        it('should allow request if no secret configured', () => {
            delete process.env.WEBHOOK_SECRET;
            verifyWebhookSecret(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should allow request with valid secret in body', () => {
            process.env.WEBHOOK_SECRET = 'my_secret_123';
            req.body.secret = 'my_secret_123';

            verifyWebhookSecret(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should allow request with valid secret in header', () => {
            process.env.WEBHOOK_SECRET = 'my_secret_123';
            req.headers['x-webhook-secret'] = 'my_secret_123';

            verifyWebhookSecret(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should reject request with missing secret', () => {
            process.env.WEBHOOK_SECRET = 'my_secret_123';

            verifyWebhookSecret(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject request with invalid secret', () => {
            process.env.WEBHOOK_SECRET = 'my_secret_123';
            req.body.secret = 'wrong_secret';

            verifyWebhookSecret(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('errorHandler', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/test',
                method: 'GET',
                ip: '127.0.0.1'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        it('should handle error with custom status code', () => {
            const error = new Error('Test error');
            error.statusCode = 400;

            errorHandler(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Test error' })
            );
        });

        it('should default to 500 status code', () => {
            const error = new Error('Test error');

            errorHandler(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should include stack trace in development', () => {
            process.env.NODE_ENV = 'development';
            const error = new Error('Test error');

            errorHandler(error, req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ stack: expect.any(String) })
            );
        });
    });

    describe('notFoundHandler', () => {
        let req, res;

        beforeEach(() => {
            req = {
                path: '/nonexistent',
                method: 'GET',
                ip: '127.0.0.1'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
        });

        it('should return 404 with error message', () => {
            notFoundHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Not Found',
                    message: expect.stringContaining('GET /nonexistent')
                })
            );
        });
    });
});
