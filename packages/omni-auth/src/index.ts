// ⚡ Omni-Grid Auth — JWT + RBAC
// Zero Trust Architecture: every request must authenticate.
// Uses HMAC-SHA256 JWT with role-based access control.

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";

// ─── Roles ───

export const Role = {
  Admin: "admin",
  Operator: "operator",
  Viewer: "viewer",
  Device: "device",
  ApiClient: "api_client",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

// ─── Permissions (Resource:Action) ───

export const Permission = {
  // Assets
  AssetsRead: "assets:read",
  AssetsWrite: "assets:write",
  AssetsDelete: "assets:delete",

  // Dispatch
  DispatchRead: "dispatch:read",
  DispatchExecute: "dispatch:execute",

  // Market
  MarketRead: "market:read",

  // Admin
  AdminUsers: "admin:users",
  AdminSystem: "admin:system",
  AdminAudit: "admin:audit",

  // Telemetry
  TelemetryRead: "telemetry:read",
  TelemetryWrite: "telemetry:write",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// ─── Role → Permissions Mapping ───

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.Admin]: [
    Permission.AssetsRead,
    Permission.AssetsWrite,
    Permission.AssetsDelete,
    Permission.DispatchRead,
    Permission.DispatchExecute,
    Permission.MarketRead,
    Permission.AdminUsers,
    Permission.AdminSystem,
    Permission.AdminAudit,
    Permission.TelemetryRead,
    Permission.TelemetryWrite,
  ],
  [Role.Operator]: [
    Permission.AssetsRead,
    Permission.AssetsWrite,
    Permission.DispatchRead,
    Permission.DispatchExecute,
    Permission.MarketRead,
    Permission.TelemetryRead,
    Permission.TelemetryWrite,
  ],
  [Role.Viewer]: [
    Permission.AssetsRead,
    Permission.DispatchRead,
    Permission.MarketRead,
    Permission.TelemetryRead,
  ],
  [Role.Device]: [
    Permission.TelemetryWrite,
  ],
  [Role.ApiClient]: [
    Permission.AssetsRead,
    Permission.DispatchRead,
    Permission.DispatchExecute,
    Permission.MarketRead,
    Permission.TelemetryRead,
  ],
};

// ─── JWT Token ───

export interface JwtPayload {
  sub: string;
  role: Role;
  clientId?: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

// ─── Token Errors ───

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TOKEN_EXPIRED"
      | "TOKEN_INVALID"
      | "TOKEN_MALFORMED"
      | "INSUFFICIENT_PERMISSIONS"
      | "USER_NOT_FOUND"
      | "INVALID_CREDENTIALS",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─── Auth Service ───

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  clientId?: string;
  apiKeyHash: string;
  enabled: boolean;
  createdAt: Date;
}

export class AuthService {
  private secret: string;
  private users = new Map<string, UserRecord>();
  private tokenBlacklist = new Set<string>();
  private readonly tokenExpirySeconds: number;

  constructor(
    secret?: string,
    tokenExpirySeconds = 86400, // default 24h
  ) {
    this.secret = secret ?? randomUUID();
    this.tokenExpirySeconds = tokenExpirySeconds;
  }

  // ─── User Management ───

  registerUser(input: {
    username: string;
    password: string;
    role: Role;
    clientId?: string;
  }): UserRecord {
    const id = randomUUID();
    const user: UserRecord = {
      id,
      username: input.username,
      role: input.role,
      clientId: input.clientId,
      apiKeyHash: this.hashPassword(input.password),
      enabled: true,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  getUser(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findUserByUsername(username: string): UserRecord | undefined {
    return Array.from(this.users.values()).find(
      (u) => u.username === username,
    );
  }

  // ─── Authentication ───

  authenticate(username: string, password: string): string {
    const user = this.findUserByUsername(username);
    if (!user) throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    if (!user.enabled) throw new AuthError("User disabled", "INVALID_CREDENTIALS");

    const expectedHash = this.hashPassword(password);
    if (!timingSafeEqual(Buffer.from(user.apiKeyHash), Buffer.from(expectedHash))) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    return this.generateToken(user);
  }

  generateToken(user: UserRecord): string {
    const now = Math.floor(Date.now() / 1000);
    const header: JwtHeader = { alg: "HS256", typ: "JWT" };
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      clientId: user.clientId,
      iat: now,
      exp: now + this.tokenExpirySeconds,
      jti: randomUUID(),
    };

    const headerB64 = this.base64url(JSON.stringify(header));
    const payloadB64 = this.base64url(JSON.stringify(payload));
    const signature = this.sign(`${headerB64}.${payloadB64}`);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  verifyToken(token: string): { payload: JwtPayload; user: UserRecord } {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthError("Malformed token", "TOKEN_MALFORMED");
    }

    const [headerB64, payloadB64, signature] = parts;

    // Verify signature
    const expectedSig = this.sign(`${headerB64}.${payloadB64}`);
    try {
      const sigBuf = Buffer.from(signature!, "base64url");
      const expBuf = Buffer.from(expectedSig, "base64url");
      if (!timingSafeEqual(sigBuf, expBuf)) {
        throw new AuthError("Invalid signature", "TOKEN_INVALID");
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError("Invalid signature", "TOKEN_INVALID");
    }

    // Decode payload
    let payload: JwtPayload;
    try {
      const decoded = Buffer.from(payloadB64!, "base64url").toString();
      payload = JSON.parse(decoded);
    } catch {
      throw new AuthError("Malformed payload", "TOKEN_MALFORMED");
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new AuthError("Token expired", "TOKEN_EXPIRED");
    }

    // Check blacklist
    if (this.tokenBlacklist.has(payload.jti)) {
      throw new AuthError("Token revoked", "TOKEN_INVALID");
    }

    // Find user
    const user = this.getUser(payload.sub);
    if (!user || !user.enabled) {
      throw new AuthError("User not found or disabled", "USER_NOT_FOUND");
    }

    return { payload, user };
  }

  revokeToken(token: string): void {
    try {
      const { payload } = this.verifyToken(token);
      this.tokenBlacklist.add(payload.jti);
    } catch {
      // Silently ignore invalid tokens
    }
  }

  // ─── Authorization (RBAC) ───

  hasPermission(user: UserRecord, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[user.role];
    return permissions?.includes(permission) ?? false;
  }

  requirePermission(user: UserRecord, permission: Permission): void {
    if (!this.hasPermission(user, permission)) {
      throw new AuthError(
        `Insufficient permissions: ${user.role} cannot ${permission}`,
        "INSUFFICIENT_PERMISSIONS",
      );
    }
  }

  getPermissionsForRole(role: Role): Permission[] {
    return [...(ROLE_PERMISSIONS[role] ?? [])];
  }

  // ─── Internal ───

  private sign(data: string): string {
    return createHmac("sha256", this.secret).update(data).digest("base64url");
  }

  private hashPassword(password: string): string {
    return createHmac("sha256", this.secret).update(password).digest("hex");
  }

  private base64url(data: string): string {
    return Buffer.from(data).toString("base64url");
  }
}

// ─── Fastify Plugin Helper ───

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export interface AuthPluginOptions {
  authService: AuthService;
  excludePaths?: string[];
}

export async function registerAuthPlugin(
  app: FastifyInstance,
  opts: AuthPluginOptions,
) {
  const exclude = new Set(opts.excludePaths ?? ["/health"]);

  app.decorate("authService", opts.authService);

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (exclude.has(request.url)) return;

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        reply.status(401).send({ error: "Missing or invalid Authorization header" });
        return;
      }

      const token = authHeader.slice(7);
      try {
        const { payload, user } = opts.authService.verifyToken(token);
        (request as any).user = user;
        (request as any).tokenPayload = payload;
      } catch (err) {
        if (err instanceof AuthError) {
          reply.status(401).send({ error: err.message, code: err.code });
        } else {
          reply.status(401).send({ error: "Authentication failed" });
        }
      }
    },
  );

  app.decorate(
    "requirePermission",
    (permission: Permission) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = (request as any).user;
        if (!user) {
          reply.status(401).send({ error: "Not authenticated" });
          return;
        }
        try {
          opts.authService.requirePermission(user, permission);
        } catch (err) {
          if (err instanceof AuthError) {
            reply.status(403).send({ error: err.message, code: err.code });
          }
        }
      },
  );

  app.addHook("onRequest", (app as any).authenticate);
}

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    authService: AuthService;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    requirePermission: (
      permission: Permission,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: UserRecord;
    tokenPayload?: JwtPayload;
  }
}
