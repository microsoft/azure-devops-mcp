// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Request, Response, NextFunction } from "express";

const EASY_AUTH_HEADER = "x-ms-client-principal";

const EMAIL_CLAIM_TYPES = [
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "preferred_username",
  "upn",
] as const;

export interface EasyAuthPrincipal {
  email?: string;
  name?: string;
  claims?: Record<string, string>;
}

/**
 * Parses the Azure Easy Auth client principal from the request header.
 * The header value is base64-encoded JSON.
 *
 * @param req - Express request (must have headers)
 * @returns Parsed principal with email, name, and raw claims; empty object if header missing/invalid
 */
export function parseClientPrincipal(req: Request): EasyAuthPrincipal {
  const raw = req.headers[EASY_AUTH_HEADER];
  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    if (!payload || typeof payload !== "object") {
      return {};
    }
    const claims = payload.claims as Record<string, string> | undefined;
    const claimsRecord: Record<string, string> = {};
    let email: string | undefined;
    let name: string | undefined;

    if (Array.isArray(claims)) {
      for (const c of claims) {
        if (c && typeof c.typ === "string" && typeof c.val === "string") {
          claimsRecord[c.typ] = c.val;
          if (EMAIL_CLAIM_TYPES.includes(c.typ as (typeof EMAIL_CLAIM_TYPES)[number])) {
            email = c.val;
          }
          if (c.typ === "name") {
            name = c.val;
          }
        }
      }
    }

    if (!email && typeof payload.userDetails === "string") {
      email = payload.userDetails;
    }
    if (!name && typeof payload.userDetails === "string") {
      name = payload.userDetails;
    }

    return {
      email: email ?? claimsRecord["preferred_username"] ?? claimsRecord["upn"] ?? claimsRecord["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
      name,
      claims: Object.keys(claimsRecord).length > 0 ? claimsRecord : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Middleware: requires that the request has the Easy Auth principal header.
 * If missing, sends 401 and does not call next().
 */
export function requireEasyAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers[EASY_AUTH_HEADER];
  if (typeof raw !== "string" || !raw.trim()) {
    res.status(401).json({ error: "Unauthorized: x-ms-client-principal header required" });
    return;
  }
  next();
}

/**
 * Reads ALLOWED_EMAILS from env (comma-separated). If set, returns middleware
 * that enforces the caller's email (from x-ms-client-principal) is in the list.
 * If allowlist is not set, returns a no-op middleware.
 * If allowlist is set but email cannot be determined => 403.
 */
export function makeAllowlistMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  const allowedEnv = process.env["ALLOWED_EMAILS"];
  if (!allowedEnv || typeof allowedEnv !== "string" || !allowedEnv.trim()) {
    return (_req, _res, next) => next();
  }
  const allowed = new Set(
    allowedEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
  if (allowed.size === 0) {
    return (_req, _res, next) => next();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const principal = parseClientPrincipal(req);
    const email = principal.email?.trim().toLowerCase();
    if (!email) {
      res.status(403).json({ error: "Forbidden: could not determine user email for allowlist check" });
      return;
    }
    if (!allowed.has(email)) {
      res.status(403).json({ error: "Forbidden: user not in allowlist" });
      return;
    }
    next();
  };
}
