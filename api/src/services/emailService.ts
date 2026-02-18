/**
 * メール送信サービス
 * SMTP_HOST が未設定の場合はコンソールにログ出力（ローカル開発用）
 */
import nodemailer from 'nodemailer';

function getAppUrl(): string {
  return (
    process.env.APP_URL ??
    'https://agreeable-island-071ec5400.4.azurestaticapps.net'
  );
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  name: string,
): Promise<void> {
  const verifyUrl = `${getAppUrl()}/verify?token=${token}`;

  const smtpHost = process.env.SMTP_HOST?.trim();
  if (!smtpHost) {
    // 開発環境: メールの代わりにコンソールに出力
    console.log(`\n[Email] =====================`);
    console.log(`[Email] Verification link for ${to}:`);
    console.log(`[Email] ${verifyUrl}`);
    console.log(`[Email] =====================\n`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const appName = 'Click Through Demo Builder';
  const from = process.env.SMTP_FROM ?? `"${appName}" <noreply@microsoft.com>`;

  await transporter.sendMail({
    from,
    to,
    subject: `Verify your ${appName} account`,
    text: [
      `Welcome to ${appName}!`,
      ``,
      `Hi ${name},`,
      ``,
      `Please verify your email address by opening the link below:`,
      verifyUrl,
      ``,
      `This link expires in 24 hours.`,
      `If you did not create an account, please ignore this email.`,
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1b1b1f">
  <h2 style="color:#0078d4">${appName}</h2>
  <p>Hi <strong>${name}</strong>,</p>
  <p>Please verify your email address to complete your account registration.</p>
  <p style="margin:24px 0">
    <a href="${verifyUrl}"
       style="background:#0078d4;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:600">
      Verify Email Address
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    Or copy this link into your browser:<br>
    <a href="${verifyUrl}" style="color:#0078d4">${verifyUrl}</a>
  </p>
  <p style="color:#666;font-size:13px">This link expires in 24 hours.<br>
  If you did not create an account, please ignore this email.</p>
</body>
</html>`,
  });
}
