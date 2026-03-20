/**
 * SMTP service tests
 * Verifies the Ethereal dev-mode fallback behaviour.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSendMail, mockCreateTestAccount, mockCreateTransport, mockGetTestMessageUrl,
} = vi.hoisted(() => ({
  mockSendMail:          vi.fn().mockResolvedValue({ messageId: "test-id" }),
  mockCreateTestAccount: vi.fn().mockResolvedValue({ user: "test@ethereal.email", pass: "p" }),
  mockCreateTransport:   vi.fn(),
  mockGetTestMessageUrl: vi.fn().mockReturnValue("https://ethereal.email/message/abc"),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTestAccount:  mockCreateTestAccount,
    createTransport:    mockCreateTransport,
    getTestMessageUrl:  mockGetTestMessageUrl,
  },
}));

vi.mock("../config/index.js", () => ({
  config: { SMTP_HOST: "", SMTP_PORT: 587 },  // empty host = dev / Ethereal mode
}));

import { sendMail } from "../services/smtpService.js";

const BASE = {
  from: "sender@example.com",
  to:   "recipient@gmail.com",
  subject: "Hello",
  text: "Body",
  html: "<p>Body</p>",
};

describe("smtpService — dev mode (SMTP_HOST empty)", () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
    mockCreateTestAccount.mockClear();
  });

  it("creates an Ethereal test account", async () => {
    await sendMail(BASE, "pass");
    expect(mockCreateTestAccount).toHaveBeenCalledOnce();
  });

  it("uses smtp.ethereal.email as host", async () => {
    await sendMail(BASE, "pass");
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.ethereal.email" })
    );
  });

  it("sends the message with correct from/to/subject", async () => {
    await sendMail(BASE, "pass");
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: BASE.from, to: BASE.to, subject: BASE.subject })
    );
  });

  it("resolves without throwing", async () => {
    await expect(sendMail(BASE, "pass")).resolves.toBeUndefined();
  });

  it("joins array recipients into a comma-separated string", async () => {
    await sendMail({ ...BASE, to: ["a@x.com", "b@x.com"] }, "pass");
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@x.com, b@x.com" })
    );
  });

  it("passes cc and bcc when provided", async () => {
    await sendMail({ ...BASE, cc: "cc@x.com", bcc: "bcc@x.com" }, "pass");
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ cc: "cc@x.com", bcc: "bcc@x.com" })
    );
  });
});
