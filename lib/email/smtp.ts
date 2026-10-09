import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user || 'quang.dh@umc.edu.vn';

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from,
  };
}

export function createSmtpTransporter() {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error('Chưa cấu hình các biến môi trường SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS / SMTP_PASSWORD)');
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    },
  });
}
