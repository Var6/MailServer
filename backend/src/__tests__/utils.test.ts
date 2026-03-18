/**
 * General utility / pure-logic tests that need no mocking.
 */
import { describe, it, expect } from "vitest";

// ── mbLabel (copied from EditTenantModal logic — tested here as pure fn) ──
function mbLabel(mb: number): string {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
    : `${mb} MB`;
}

describe("mbLabel", () => {
  it("formats MB correctly", () => {
    expect(mbLabel(256)).toBe("256 MB");
    expect(mbLabel(512)).toBe("512 MB");
  });

  it("formats whole GB correctly", () => {
    expect(mbLabel(1024)).toBe("1 GB");
    expect(mbLabel(2048)).toBe("2 GB");
  });

  it("formats fractional GB correctly", () => {
    expect(mbLabel(1536)).toBe("1.5 GB");
  });
});

// ── Tenant storage summary math ────────────────────────────────────────────
function totalStorageGb(storagePerUserMb: number, maxUsers: number): string {
  return ((storagePerUserMb * maxUsers) / 1024).toFixed(1);
}

describe("totalStorageGb", () => {
  it("calculates correctly for 10 users × 512 MB", () => {
    expect(totalStorageGb(512, 10)).toBe("5.0");
  });

  it("calculates correctly for 100 users × 1 GB", () => {
    expect(totalStorageGb(1024, 100)).toBe("100.0");
  });

  it("handles fractional GB", () => {
    expect(totalStorageGb(256, 3)).toBe("0.8");
  });
});

// ── nearestPreset (from EditTenantModal) ───────────────────────────────────
const MB_PRESETS = [256, 512, 1024, 2048, 5120, 10240, 20480, 51200, 102400];

function nearestPreset(v: number): number {
  return MB_PRESETS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
}

describe("nearestPreset", () => {
  it("returns exact match for preset values", () => {
    expect(nearestPreset(1024)).toBe(1024);
    expect(nearestPreset(512)).toBe(512);
  });

  it("rounds down to nearest preset", () => {
    expect(nearestPreset(700)).toBe(512);
  });

  it("rounds up to nearest preset", () => {
    expect(nearestPreset(900)).toBe(1024);
  });

  it("handles values below all presets", () => {
    expect(nearestPreset(0)).toBe(256);
  });

  it("handles values above all presets", () => {
    expect(nearestPreset(999999)).toBe(102400);
  });
});

// ── Domain validation ──────────────────────────────────────────────────────
function isValidDomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}

describe("isValidDomain", () => {
  it("accepts valid domains", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("mail.acme.co.uk")).toBe(true);
    expect(isValidDomain("my-company.io")).toBe(true);
  });

  it("rejects localhost", () => {
    expect(isValidDomain("localhost")).toBe(false);
  });

  it("rejects domains with spaces", () => {
    expect(isValidDomain("my domain.com")).toBe(false);
  });

  it("rejects domains starting with a hyphen", () => {
    expect(isValidDomain("-bad.com")).toBe(false);
  });
});
