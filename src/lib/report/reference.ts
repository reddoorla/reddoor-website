import { createHash } from "node:crypto";

/**
 * A short label for a report, derived from its token: the first 8 hex
 * characters of the token's SHA-256. Shared by the main and Technical routes so
 * they cannot disagree. Server-only (node:crypto); the token never leaves the
 * server, only this label does.
 */
export const reportReference = (token: string): string =>
  createHash("sha256").update(token).digest("hex").slice(0, 8);
