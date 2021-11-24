import { createLogger, transports, format } from 'winston';

const logFormat = format.printf(({ level, message, label, timestamp }) => `${timestamp} [${label}] ${level}: ${message}`);

export const logger = createLogger({
  transports: [
    new transports.Console({
      format: format.combine(
        format.label({ label: 'GeospatialBucketizer' }),
        format.timestamp(),
        logFormat,
      ),
    }),
  ],
});
