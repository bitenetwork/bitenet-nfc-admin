import winston from "winston";
import { env } from "~/env.mjs";
import * as util from "util";

const globalForWinston = globalThis as unknown as {
  logger: winston.Logger | undefined;
};

export const logger =
  globalForWinston.logger ??
  winston.createLogger({
    level: "info",
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: "YYYY-MM-DD hh:mm:ss.SSS" }),
      winston.format.align(),
      winston.format.errors({ stack: true, cause: true }),
      winston.format.printf(
        ({ timestamp, level, requestId, message, stack, cause }) =>
          `${timestamp} ${level} requestId:[${requestId}] ${message} ${
            stack ? `\n${stack}` : ""
          } ${cause ? "\n" + util.inspect(cause) : ""}`,
      ),
    ),
  });

if (env.NODE_ENV !== "production") globalForWinston.logger = logger;
