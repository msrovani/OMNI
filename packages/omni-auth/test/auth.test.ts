import { describe, it, expect, beforeEach } from "vitest";
import {
  AuthService,
  AuthError,
  Role,
  Permission,
} from "../src/index.js";

describe("AuthService", () => {
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService("test-secret", 3600);
  });

  describe("User Management", () => {
    it("should register a user", () => {
      const user = auth.registerUser({
        username: "admin",
        password: "admin123",
        role: Role.Admin,
      });
      expect(user.id).toBeDefined();
      expect(user.username).toBe("admin");
      expect(user.role).toBe("admin");
      expect(user.enabled).toBe(true);
    });

    it("should find user by username", () => {
      auth.registerUser({ username: "op", password: "pass", role: Role.Operator });
      const found = auth.findUserByUsername("op");
      expect(found).toBeDefined();
      expect(found!.username).toBe("op");
    });

    it("should return undefined for unknown username", () => {
      const found = auth.findUserByUsername("nobody");
      expect(found).toBeUndefined();
    });
  });

  describe("Authentication", () => {
    it("should authenticate with valid credentials", () => {
      auth.registerUser({ username: "admin", password: "admin123", role: Role.Admin });
      const token = auth.authenticate("admin", "admin123");
      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3);
    });

    it("should reject invalid password", () => {
      auth.registerUser({ username: "admin", password: "admin123", role: Role.Admin });
      expect(() => auth.authenticate("admin", "wrong")).toThrow(AuthError);
    });

    it("should reject unknown user", () => {
      expect(() => auth.authenticate("nobody", "pass")).toThrow(AuthError);
    });

    it("should reject disabled user", () => {
      const user = auth.registerUser({
        username: "disabled",
        password: "pass",
        role: Role.Viewer,
      });
      // Directly disable
      const record = auth.getUser(user.id)!;
      (record as any).enabled = false;
      expect(() => auth.authenticate("disabled", "pass")).toThrow(AuthError);
    });
  });

  describe("Token Verification", () => {
    it("should verify a valid token", () => {
      auth.registerUser({ username: "op", password: "pass", role: Role.Operator });
      const token = auth.authenticate("op", "pass");
      const { payload, user } = auth.verifyToken(token);
      expect(payload.role).toBe("operator");
      expect(user.username).toBe("op");
    });

    it("should reject expired token", () => {
      const expiredAuth = new AuthService("test-secret", 0); // expires immediately
      expiredAuth.registerUser({ username: "x", password: "x", role: Role.Viewer });
      const token = expiredAuth.authenticate("x", "x");
      // Wait 1ms
      expect(() => expiredAuth.verifyToken(token)).toThrow(AuthError);
      try {
        expiredAuth.verifyToken(token);
      } catch (e) {
        expect((e as AuthError).code).toBe("TOKEN_EXPIRED");
      }
    });

    it("should reject malformed token", () => {
      expect(() => auth.verifyToken("not.a.token")).toThrow(AuthError);
    });

    it("should reject tampered token", () => {
      auth.registerUser({ username: "op", password: "pass", role: Role.Operator });
      const token = auth.authenticate("op", "pass");
      const parts = token.split(".");
      parts[2] = "tampered";
      expect(() => auth.verifyToken(parts.join("."))).toThrow(AuthError);
    });
  });

  describe("Token Revocation", () => {
    it("should reject revoked tokens", () => {
      auth.registerUser({ username: "revoke", password: "pass", role: Role.Viewer });
      const token = auth.authenticate("revoke", "pass");
      auth.revokeToken(token);
      expect(() => auth.verifyToken(token)).toThrow(AuthError);
    });
  });

  describe("RBAC Permissions", () => {
    it("should allow admin all permissions", () => {
      const user = auth.registerUser({
        username: "root",
        password: "root",
        role: Role.Admin,
      });
      expect(auth.hasPermission(user, Permission.AdminSystem)).toBe(true);
      expect(auth.hasPermission(user, Permission.DispatchExecute)).toBe(true);
      expect(auth.hasPermission(user, Permission.AssetsDelete)).toBe(true);
    });

    it("should restrict viewer permissions", () => {
      const user = auth.registerUser({
        username: "view",
        password: "view",
        role: Role.Viewer,
      });
      expect(auth.hasPermission(user, Permission.AssetsRead)).toBe(true);
      expect(auth.hasPermission(user, Permission.DispatchExecute)).toBe(false);
      expect(auth.hasPermission(user, Permission.AdminSystem)).toBe(false);
    });

    it("should allow device only telemetry write", () => {
      const user = auth.registerUser({
        username: "dev",
        password: "dev",
        role: Role.Device,
      });
      expect(auth.hasPermission(user, Permission.TelemetryWrite)).toBe(true);
      expect(auth.hasPermission(user, Permission.AssetsRead)).toBe(false);
      expect(auth.hasPermission(user, Permission.DispatchExecute)).toBe(false);
    });

    it("requirePermission should throw for insufficient rights", () => {
      const user = auth.registerUser({
        username: "weak",
        password: "weak",
        role: Role.Viewer,
      });
      expect(() =>
        auth.requirePermission(user, Permission.AdminSystem),
      ).toThrow(AuthError);
    });

    it("getPermissionsForRole should return correct set", () => {
      const perms = auth.getPermissionsForRole(Role.Operator);
      expect(perms.includes(Permission.DispatchExecute)).toBe(true);
      expect(perms.includes(Permission.AdminUsers)).toBe(false);
    });
  });

  describe("Multiple Users", () => {
    it("should handle multiple concurrent users", () => {
      auth.registerUser({ username: "a", password: "a", role: Role.Admin });
      auth.registerUser({ username: "b", password: "b", role: Role.Operator });
      auth.registerUser({ username: "c", password: "c", role: Role.Viewer });

      const t1 = auth.authenticate("a", "a");
      const t2 = auth.authenticate("b", "b");
      const t3 = auth.authenticate("c", "c");

      expect(auth.verifyToken(t1).payload.role).toBe("admin");
      expect(auth.verifyToken(t2).payload.role).toBe("operator");
      expect(auth.verifyToken(t3).payload.role).toBe("viewer");
    });
  });
});
