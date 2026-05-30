import { describe, expect, it } from "vitest";
import {
  CredentialError,
  IntegrationError,
  isRadarboardError,
  NotFoundError,
  PluginError,
  RadarboardError,
  ValidationError,
} from "./errors";

describe("RadarboardError hierarchy", () => {
  describe("RadarboardError (base)", () => {
    it("has correct properties", () => {
      const err = new RadarboardError("INTERNAL_ERROR", "Something broke", 500, {
        requestId: "abc",
      });

      expect(err.message).toBe("Something broke");
      expect(err.code).toBe("INTERNAL_ERROR");
      expect(err.statusCode).toBe(500);
      expect(err.metadata).toEqual({ requestId: "abc" });
      expect(err.name).toBe("RadarboardError");
      expect(err).toBeInstanceOf(Error);
    });

    it("serializes to JSON", () => {
      const err = new RadarboardError("INTERNAL_ERROR", "boom", 500, { key: "val" });
      expect(err.toJSON()).toEqual({
        error: "boom",
        code: "INTERNAL_ERROR",
        metadata: { key: "val" },
      });
    });

    it("omits metadata from JSON when undefined", () => {
      const err = new RadarboardError("INTERNAL_ERROR", "boom");
      const json = err.toJSON();
      expect(json).toEqual({ error: "boom", code: "INTERNAL_ERROR" });
      expect("metadata" in json).toBe(false);
    });
  });

  describe("CredentialError", () => {
    it("maps to 401", () => {
      const err = new CredentialError("CREDENTIAL_MISSING", "No token found");
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("CREDENTIAL_MISSING");
      expect(err.name).toBe("CredentialError");
      expect(err).toBeInstanceOf(RadarboardError);
    });
  });

  describe("IntegrationError", () => {
    it("maps INTEGRATION_RATE_LIMITED to 429", () => {
      const err = new IntegrationError("INTEGRATION_RATE_LIMITED", "Too many requests");
      expect(err.statusCode).toBe(429);
    });

    it("maps INTEGRATION_TIMEOUT to 504", () => {
      const err = new IntegrationError("INTEGRATION_TIMEOUT", "Timed out");
      expect(err.statusCode).toBe(504);
    });

    it("maps INTEGRATION_UNAVAILABLE to 502", () => {
      const err = new IntegrationError("INTEGRATION_UNAVAILABLE", "API down");
      expect(err.statusCode).toBe(502);
    });
  });

  describe("PluginError", () => {
    it("maps PLUGIN_NOT_FOUND to 404", () => {
      const err = new PluginError("PLUGIN_NOT_FOUND", "No such plugin");
      expect(err.statusCode).toBe(404);
    });

    it("maps PLUGIN_TOKEN_INVALID to 403", () => {
      const err = new PluginError("PLUGIN_TOKEN_INVALID", "Bad token");
      expect(err.statusCode).toBe(403);
    });

    it("maps PLUGIN_INIT_FAILED to 500", () => {
      const err = new PluginError("PLUGIN_INIT_FAILED", "Init crashed");
      expect(err.statusCode).toBe(500);
    });
  });

  describe("ValidationError", () => {
    it("maps to 400", () => {
      const err = new ValidationError("Invalid input", {
        issues: [{ path: ["name"], message: "Required" }],
      });
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("NotFoundError", () => {
    it("maps to 404", () => {
      const err = new NotFoundError("Widget not found");
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
    });
  });

  describe("isRadarboardError", () => {
    it("returns true for RadarboardError subclasses", () => {
      expect(isRadarboardError(new CredentialError("CREDENTIAL_EXPIRED", "expired"))).toBe(true);
      expect(isRadarboardError(new IntegrationError("INTEGRATION_TIMEOUT", "timeout"))).toBe(true);
      expect(isRadarboardError(new ValidationError("bad input"))).toBe(true);
    });

    it("returns false for plain errors", () => {
      expect(isRadarboardError(new Error("plain"))).toBe(false);
      expect(isRadarboardError("string error")).toBe(false);
      expect(isRadarboardError(null)).toBe(false);
    });
  });
});
