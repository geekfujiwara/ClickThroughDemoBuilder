/**
 * メール送信サービス
 * Microsoft Graph API (Mail.Send) を使用して送信
 * AZURE_TENANT_ID が未設定の場合はコンソールにログ出力（ローカル開発用）
 */
import { ClientSecretCredential } from '@azure/identity';

/** HTML特殊文字をエスケープ */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAppUrl(): string {
  return process.env.APP_URL ?? 'https://your-app.azurestaticapps.net';
}

async function sendViaGraph(to: string, subject: string, body: { text: string; html: string }): Promise<void> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const sender = process.env.GRAPH_SENDER;
  if (!sender) {
    throw new Error('GRAPH_SENDER environment variable is required');
  }

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
  <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
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

/**
 * デザイナー権限申請通知（管理者向け）
 */
export async function sendDesignerApplicationEmail(opts: {
  applicantName: string;
  applicantEmail: string;
  reason: string;
  approvalUrl: string;
}): Promise<void> {
  const adminEmail = process.env.APPROVAL_EMAIL;
  const appName = 'Click Through Demo Builder';
  const subject = `[${appName}] デザイナー権限申請 - ${opts.applicantName}`;

  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  if (!tenantId || !adminEmail) {
    console.log(`\n[Email] ===== Designer Application =====`);
    console.log(`[Email] Applicant: ${opts.applicantName} <${opts.applicantEmail}>`);
    console.log(`[Email] Reason: ${opts.reason}`);
    console.log(`[Email] Approval URL: ${opts.approvalUrl}`);
    console.log(`[Email] =====================================\n`);
    return;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1b1b1f">
  <h2 style="color:#0078d4">${appName} - デザイナー権限申請</h2>
  <p>以下のユーザーからデザイナー権限の申請がありました。</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">申請者名</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(opts.applicantName)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">メールアドレス</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(opts.applicantEmail)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">申請理由</td><td style="padding:8px;border:1px solid #ddd;white-space:pre-wrap">${escapeHtml(opts.reason)}</td></tr>
  </table>
  <p style="margin:24px 0">
    <a href="${opts.approvalUrl}"
       style="background:#0078d4;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:600">
      デザイナー権限を承認する
    </a>
  </p>
  <p style="color:#666;font-size:13px">このリンクは7日間有効です。</p>
</body>
</html>`;

  await sendViaGraph(adminEmail, subject, { text: `申請者: ${opts.applicantName} / ${opts.approvalUrl}`, html: htmlBody });
}

/**
 * デザイナー権限付与通知（申請者向け）
 */
export async function sendDesignerApprovalEmail(to: string, name: string): Promise<void> {
  const appName = 'Click Through Demo Builder';
  const appUrl = getAppUrl();
  const subject = `[${appName}] デザイナー権限が付与されました`;

  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  if (!tenantId) {
    console.log(`\n[Email] Designer approved: ${name} <${to}>\n`);
    return;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1b1b1f">
  <h2 style="color:#0078d4">${appName}</h2>
  <p>こんにちは <strong>${escapeHtml(name)}</strong> さん、</p>
  <p>デザイナー権限の申請が承認されました。デモの作成・編集が行えるようになりました。</p>
  <p style="margin:24px 0">
    <a href="${appUrl}"
       style="background:#0078d4;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:600">
      アプリを開く
    </a>
  </p>
</body>
</html>`;

  await sendViaGraph(to, subject, { text: `デザイナー権限が付与されました。${appUrl}`, html: htmlBody });
}
