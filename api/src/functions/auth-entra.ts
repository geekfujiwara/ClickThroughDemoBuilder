/**
 * POST /api/auth/entra
 * Microsoft Entra ID (Azure AD) の ID トークンを検証して JWT セッションを発行する
 * @microsoft.com アカウント限定。初回ログイン時はクリエイターを自動作成。
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createToken, buildSessionCookie } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID ?? '';
const ALLOWED_DOMAIN = '@microsoft.com';

type TokenClaims = {
  tid?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  oid?: string;
};

async function handler(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { idToken?: string };
    const idToken = body.idToken?.trim();
    if (!idToken) {
      return { status: 400, jsonBody: { error: 'idToken is required.' } };
    }

    if (!ENTRA_CLIENT_ID) {
      context.error('ENTRA_CLIENT_ID is not configured.');
      return { status: 500, jsonBody: { error: 'Server configuration error: ENTRA_CLIENT_ID missing.' } };
    }

    // ① JWT ヘッダー/ペイロードを検証なしでデコードして tid を取得
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return { status: 400, jsonBody: { error: 'Invalid token format.' } };
    }
    const rawPayload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8'),
    ) as TokenClaims;

    const tid = rawPayload.tid;
    if (!tid) {
      return { status: 400, jsonBody: { error: 'Missing tenant ID (tid) in token.' } };
    }
    // S-03: SSRF 防止 — tid は UUID 形式のみ許可
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tid)) {
      return { status: 400, jsonBody: { error: 'Invalid token format.' } };
    }

    // ② テナント固有の JWKS で署名を検証
    let payload: TokenClaims;
    try {
      const JWKS = createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`),
      );
      const result = await jwtVerify<TokenClaims>(idToken, JWKS, {
        audience: ENTRA_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${tid}/v2.0`,
      });
      payload = result.payload;
    } catch (e) {
      context.warn('Entra token verification failed:', (e as Error).message);
      return { status: 401, jsonBody: { error: 'Token verification failed.' } };
    }

    // ③ メールアドレスを確認（preferred_username または email クレーム）
    const email = (
      (payload.preferred_username ?? payload.email) ?? ''
    ).toLowerCase().trim();

    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return {
        status: 403,
        jsonBody: { error: 'Only @microsoft.com accounts are allowed.' },
      };
    }

    // ④ クリエイターを検索、なければ自動作成
    let creator;
    try {
      creator = await creatorService.findCreatorByEmail(email);

      if (!creator) {
        const displayName = (payload.name ?? email.split('@')[0]) ?? 'Unknown';
        const allCreators = await creatorService.getAllCreators();
        const nameExists = allCreators.some(
          (c) => c.name.toLowerCase() === displayName.toLowerCase(),
        );
        const finalName = nameExists
          ? `${displayName} (${email.split('@')[0]})`
          : displayName;

        creator = await creatorService.createCreator({
          name: finalName,
          email,
          language: 'ja',
        });
      }
    } catch (e) {
      context.error('Creator service error:', (e as Error).message, (e as Error).stack ?? '');
      return { status: 500, jsonBody: { error: `Storage error: ${(e as Error).message}` } };
    }

    // ⑤ セッション JWT を発行して Cookie にセット
    const token = createToken('designer', creator.id);
    return {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookie(token, 8 * 3600) },
      jsonBody: { role: 'designer', creatorId: creator.id, name: creator.name },
    };
  } catch (e) {
    context.error('Unexpected error in auth-entra:', (e as Error).message, (e as Error).stack ?? '');
    return {
      status: 500,
      jsonBody: { error: `Internal server error: ${(e as Error).message}` },
    };
  }
}

app.http('auth-entra', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/entra',
  handler,
});
