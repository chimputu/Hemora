import type { Request, Response, NextFunction } from "express";

/**
 * Audit logging middleware that logs sensitive operations.
 * Logs: method, path, user ID, role, IP address, timestamp, and response status.
 * Only logs write operations (POST, PATCH, DELETE) and sensitive read operations.
 */

const SENSITIVE_PATHS = [
  "/users",
  "/me",
  "/inventory",
  "/requisitions",
  "/campaigns",
  "/invitations",
];

const WRITE_METHODS = ["POST", "PATCH", "DELETE"];

function shouldLog(method: string, path: string): boolean {
  // Always log write operations on sensitive paths
  if (WRITE_METHODS.includes(method) && SENSITIVE_PATHS.some((p) => path.startsWith(p))) {
    return true;
  }
  // Log all user management operations
  if (path.startsWith("/users")) {
    return true;
  }
  return false;
}

export function auditLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method;
    const path = req.path;

    if (!shouldLog(method, path)) {
      return next();
    }

    // Capture the start time
    const startTime = Date.now();

    // Log after the response is finished
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const userId = (req as any).user?.id || "anonymous";
      const role = (req as any).user?.role || "unknown";
      const ip = req.ip || req.socket.remoteAddress || "unknown";

      const auditEntry = {
        timestamp: new Date().toISOString(),
        method,
        path,
        userId,
        role,
        ip,
        statusCode: res.statusCode,
        durationMs: duration,
      };

      // Use a dedicated audit log prefix for easy filtering
      console.log("[AUDIT]", JSON.stringify(auditEntry));
    });

    next();
  };
}
