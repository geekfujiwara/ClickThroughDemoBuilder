/**
 * メール送信サービス
 * Microsoft Graph API (Mail.Send) を使用して送信
 * AZURE_TENANT_ID が未設定の場合はコンソールにログ出力（ローカル開発用）
 */
import { ClientSecretCredential } from '@azure/identity';

function getAppUrl(): string {
  return (
    process.env.APP_URL ??
    'https://agreeable-island-071ec5400.4.azurestaticapps.net'
  );
}

async function sendViaGraph(to: string, subject: string, body: { text: string; html: string }): Promise<void> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const sender = process.env.GRAPH_SENDER ?? 'admin@M365x45121568.onmicrosoft.com';

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET are required for Graph mail');
  }

  const cred = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const tokenResponse = await cred.getToken('https://graph.microsoft.com/.default');
  const accessToken = tokenResponse.token;

  const payload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: body.html },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph sendMail failed: ${res.status} ${err}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  name: string,
): Promise<void> {
  const verifyUrl = `${getAppUrl()}/verify?token=${token}`;
  const appName = 'Click Through Demo Builder';
  const subject = `Verify your ${appName} account`;

  const textBody = [
    `Welcome to ${appName}!`,
    ``,
    `Hi ${name},`,
    ``,
    `Please verify your email address by opening the link below:`,
    verifyUrl,
    ``,
    `This link expires in 24 hours.`,
    `If you did not create an account, please ignore this email.`,
  ].join('\n');

  const htmlBody = `
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
</html>`;

  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  if (!tenantId) {
    // ローカル開発: コンソールに出力
    console.log(`\n[Email] =====================`);
    console.log(`[Email] Verification link for ${to}:`);
    console.log(`[Email] ${verifyUrl}`);
    console.log(`[Email] =====================\n`);
    return;
  }

  await sendViaGraph(to, subject, { text: textBody, html: htmlBody });
}
