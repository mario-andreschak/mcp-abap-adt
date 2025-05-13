/**
 * Logger module for MCP-compatible logging
 *
 * This file provides logging utilities that work both in regular console mode
 * and with the MCP Inspector. It avoids direct console.log calls which can
 * interfere with MCP's JSON-RPC communication.
 */

// Logger functions for different log levels
function createLogFn(level: string) {
  return (message: string, data?: any) => {
    if (process.env.DEBUG === "true") {
      // In debug mode with MCP Inspector, use process.stderr instead of console.log
      // This avoids interfering with MCP's JSON-RPC protocol
      const logObject = {
        level,
        timestamp: new Date().toISOString(),
        message,
        ...data,
      };

      // Output to stderr which won't interfere with MCP communication
      process.stderr.write(JSON.stringify(logObject) + "\n");
    }
  };
}

// Export log functions
export const logger = {
  info: createLogFn("INFO"),
  warn: createLogFn("WARN"),
  error: createLogFn("ERROR"),
  debug: createLogFn("DEBUG"),

  // Special handler for TLS config
  tlsConfig: (rejectUnauthorized: boolean) => {
    if (process.env.DEBUG === "true") {
      const message = `TLS certificate validation is ${
        rejectUnauthorized ? "enabled" : "disabled"
      }`;
      process.stderr.write(
        JSON.stringify({
          level: "INFO",
          timestamp: new Date().toISOString(),
          type: "TLS_CONFIG",
          message,
          rejectUnauthorized,
        }) + "\n"
      );
    }
  },

  // Special handler for CSRF token
  csrfToken: (
    type: "fetch" | "success" | "error" | "retry",
    message: string,
    data?: any
  ) => {
    if (process.env.DEBUG === "true") {
      process.stderr.write(
        JSON.stringify({
          level: type === "error" ? "ERROR" : "INFO",
          timestamp: new Date().toISOString(),
          type: `CSRF_${type.toUpperCase()}`,
          message,
          ...data,
        }) + "\n"
      );
    }
  },
};
