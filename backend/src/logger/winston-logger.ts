import * as winston from 'winston';
import 'winston-daily-rotate-file';

export function createTypeOrmLogger(logPath: string) {
  return winston.createLogger({
    transports: [
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize({ all: true }),
          winston.format.printf(
            (info) =>
              `[Nest] ${info.timestamp}  ${info.level}: ${info.message}`,
          ),
        ),
      }),
      new winston.transports.DailyRotateFile({
        level: 'debug',
        filename: `${logPath}/%DATE%/combined.log`,
        datePattern: 'YYYY-MM',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '12m',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json(),
        ),
      }),
      new winston.transports.DailyRotateFile({
        level: 'error',
        filename: `${logPath}/%DATE%/error.log`,
        datePattern: 'YYYY-MM',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '12m',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json(),
        ),
      }),
    ],
  });
}
