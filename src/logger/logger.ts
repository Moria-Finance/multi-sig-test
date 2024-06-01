import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(import.meta.dir, '../..', '.env'),
});

const logger = pino({
  level: process.env.PINO_LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export default logger;
