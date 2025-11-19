const winston = require('winston');

/**
 * Create and configure winston logger
 * @returns {winston.Logger} Configured logger instance
 */
const createLogger = () => {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const nodeEnv = process.env.NODE_ENV || 'development';

    const formats = [
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
    ];

    if (nodeEnv !== 'production') {
        formats.push(winston.format.colorize());
    }

    formats.push(
        winston.format.printf(({ level, message, timestamp, stack }) => {
            if (stack) {
                return `${timestamp} [${level}]: ${message}\n${stack}`;
            }
            return `${timestamp} [${level}]: ${message}`;
        })
    );

    return winston.createLogger({
        level: logLevel,
        format: winston.format.combine(...formats),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
            }),
            new winston.transports.File({
                filename: 'logs/combined.log',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
            }),
        ],
        exceptionHandlers: [
            new winston.transports.File({ filename: 'logs/exceptions.log' })
        ],
        rejectionHandlers: [
            new winston.transports.File({ filename: 'logs/rejections.log' })
        ]
    });
};

module.exports = createLogger();
