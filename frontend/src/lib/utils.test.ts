import { describe, it, expect } from "vitest";
import {
  avatarColor, senderInitial, senderName, formatBytes, stripHtml,
} from "./utils.ts";

// ── avatarColor ────────────────────────────────────────────────────────────
describe("avatarColor", () => {
  it("returns a tailwind bg-* class", () => {
    expect(avatarColor("alice@example.com")).toMatch(/^bg-\w+-\d+$/);
  });

  it("is deterministic — same input gives same color", () => {
    const a = avatarColor("bob@test.com");
    const b = avatarColor("bob@test.com");
    expect(a).toBe(b);
  });

  it("returns different colors for clearly different inputs", () => {
    const colors = new Set([
      avatarColor("a@a.com"),
      avatarColor("z@z.com"),
      avatarColor("user1@domain.com"),
      avatarColor("user2@domain.com"),
      avatarColor("hello@world.com"),
    ]);
    // Not all 5 need to be different but we should get at least 2 distinct colors
    expect(colors.size).toBeGreaterThan(1);
  });

  it("handles empty string without throwing", () => {
    expect(() => avatarColor("")).not.toThrow();
  });
});

// ── senderInitial ──────────────────────────────────────────────────────────
describe("senderInitial", () => {
  it("extracts initial from display name", () => {
    expect(senderInitial("Alice Smith <alice@example.com>")).toBe("A");
  });

  it("extracts initial from plain email", () => {
    expect(senderInitial("bob@example.com")).toBe("B");
  });

  it("returns uppercase", () => {
    expect(senderInitial("charlie@x.com")).toBe("C");
  });

  it("returns ? for empty string", () => {
    expect(senderInitial("")).toBe("?");
  });
});

// ── senderName ─────────────────────────────────────────────────────────────
describe("senderName", () => {
  it("returns display name when present", () => {
    expect(senderName("Alice Smith <alice@example.com>")).toBe("Alice Smith");
  });

  it("returns local part of email when no display name", () => {
    expect(senderName("<bob@example.com>")).toBe("bob");
  });

  it("returns local part of plain email", () => {
    expect(senderName("charlie@example.com")).toBe("charlie");
  });
});

// ── formatBytes ────────────────────────────────────────────────────────────
describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("rounds kilobytes", () => {
    expect(formatBytes(1536)).toBe("2 KB");
  });
});

// ── stripHtml ──────────────────────────────────────────────────────────────
describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("<p>  foo  </p>  <p>  bar  </p>")).toBe("foo bar");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("no tags here")).toBe("no tags here");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});
