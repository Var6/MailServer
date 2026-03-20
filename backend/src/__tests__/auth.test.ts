/**
 * Auth service unit tests
 * Uses vi.mock to isolate from MongoDB, argon2, and JWT.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs BEFORE module imports, so refs are valid inside vi.mock factories
const { mockFindOne } = vi.hoisted(() => ({ mockFindOne: vi.fn() }));

vi.mock("argon2", () => ({
  default: {
    hash:   vi.fn(async (p: string) => `hashed:${p}`),
    verify: vi.fn(async (hash: string, plain: string) => hash === `hashed:${plain}`),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign:   vi.fn(() => "mock.jwt.token"),
    verify: vi.fn(() => ({ sub: "user@example.com", domain: "example.com", role: "user" })),
  },
}));

vi.mock("../models/User.js", () => ({
  User:   { findOne: mockFindOne, create: vi.fn(), updateMany: vi.fn() },
  Domain: { findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
}));

vi.mock("../models/Tenant.js", () => ({
  Tenant: { findOne: vi.fn() },
}));

vi.mock("../config/index.js", () => ({
  config: {
    JWT_SECRET:         "test-secret-32-chars-minimum-ok!",
    JWT_REFRESH_SECRET: "test-refresh-secret-32-chars-ok!",
  },
}));

import {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyCredentials,
} from "../services/authService.js";

describe("issueAccessToken", () => {
  it("returns a string token", () => {
    const fakeUser = { email: "u@e.com", domain: "e.com", role: "user", password: "" } as any;
    const token = issueAccessToken(fakeUser);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });
});

describe("issueRefreshToken", () => {
  it("returns a string token", () => {
    const fakeUser = { email: "u@e.com", domain: "e.com", role: "user", password: "" } as any;
    const token = issueRefreshToken(fakeUser);
    expect(typeof token).toBe("string");
  });
});

describe("verifyAccessToken", () => {
  it("returns payload with sub, domain, role", () => {
    const payload = verifyAccessToken("any.token");
    expect(payload).toMatchObject({ sub: "user@example.com", domain: "example.com", role: "user" });
  });
});

describe("verifyCredentials", () => {
  beforeEach(() => mockFindOne.mockReset());

  it("returns null when user not found", async () => {
    mockFindOne.mockResolvedValue(null);
    expect(await verifyCredentials("nobody@x.com", "pass")).toBeNull();
  });

  it("returns null when password is wrong", async () => {
    mockFindOne.mockResolvedValue({ email: "u@x.com", password: "hashed:correct", active: true });
    expect(await verifyCredentials("u@x.com", "wrong")).toBeNull();
  });

  it("returns user when credentials are correct", async () => {
    const fakeUser = { email: "u@x.com", password: "hashed:correct", active: true };
    mockFindOne.mockResolvedValue(fakeUser);
    expect(await verifyCredentials("u@x.com", "correct")).toEqual(fakeUser);
  });
});
