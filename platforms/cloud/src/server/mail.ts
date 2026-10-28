import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Config } from "./config";

export type Mail = { to: string; subject: string; text: string };

export type Mailer = {
  /** False when no SMTP server is configured; nothing can be sent then. */
  enabled: boolean;
  send(mail: Mail): Promise<void>;
};

export function createMailer(config: Config): Mailer {
  const { smtp, mailOutboxDir } = config;
  if (mailOutboxDir) return createOutboxMailer(mailOutboxDir);
  if (!smtp) {
    return {
      enabled: false,
      async send() {
        throw new Error("Email is not configured");
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return {
    enabled: true,
    async send(mail) {
      await transport.sendMail({ from: smtp.from, ...mail });
    },
  };
}

/** Collects mail instead of sending it. For tests. */
export function createMemoryMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return {
    enabled: true,
    sent,
    async send(mail) {
      sent.push(mail);
    },
  };
}

/**
 * Writes each mail as a JSON file into `dir` instead of sending it
 * (MAIL_OUTBOX_DIR): for development and browser tests, never production.
 */
export function createOutboxMailer(dir: string): Mailer {
  mkdirSync(dir, { recursive: true });
  let n = 0;
  return {
    enabled: true,
    async send(mail) {
      const name = `${Date.now()}-${String(++n).padStart(4, "0")}.json`;
      writeFileSync(path.join(dir, name), JSON.stringify(mail, null, 2));
    },
  };
}
