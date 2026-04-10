/**
 * POST /api/auth/entra
 * Microsoft Entra ID (Azure AD) の ID トークンを検証して JWT セッションを発行する
 * @microsoft.com アカウント限定。初回ログイン時はクリエイターを自動作成。
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createToken, buildSessionCookie } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';
import * as trustedAliasService from '../services/trustedAliasService.js';

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
    //    oid（Entra Object ID）を第一キーとし、フォールバックで email 検索する。
    //    これにより同一ユーザーが複数エイリアスを持っていても同一クリエイターとして扱う。
    const oid = payload.oid ?? '';
    let creator;
    try {
      // まず oid で検索
      if (oid) {
        creator = await creatorService.findCreatorByOid(oid);
      }

      // oid で見つからなければ email でフォールバック検索
      if (!creator) {
        creator = await creatorService.findCreatorByEmail(email);
      }

      if (creator) {
        // 既存ユーザー: oid が未設定または異なるエイリアスでログインした場合にメールと oid を更新
        if (oid && (!creator.entraOid || creator.email !== email)) {
          creator = await creatorService.updateCreatorEntraOid(creator.id, oid, email);
          context.log(`Updated creator entraOid/email: ${creator.id} → oid=${oid}, email=${email}`);
        }
      } else {
        // 新規ユーザー作成
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
          role: 'viewer',
          entraOid: oid || undefined,
        });
      }
    } catch (e) {
      context.error('Creator service error:', (e as Error).message, (e as Error).stack ?? '');
      return { status: 500, jsonBody: { error: `Storage error: ${(e as Error).message}` } };
    }

    // ⑤ ブロック済みユーザーはログイン拒否
    if (creator.isBlocked) {
      return { status: 403, jsonBody: { error: 'Your account has been blocked.' } };
    }

    // ⑤-b 信頼済みエイリアスによる自動昇格
    try {
      const trusted = await trustedAliasService.findByEmail(email);
      if (trusted) {
        const currentLevel = trustedAliasService.roleLevel(creator.role ?? 'viewer');
        const targetLevel = trustedAliasService.roleLevel(trusted.role);
        if (currentLevel < targetLevel) {
          creator = await creatorService.changeUserRole(creator.id, trusted.role);
          context.log(`Trusted alias auto-promoted: ${email} → ${trusted.role}`);
        }
      }
    } catch (e) {
      // 昇格失敗はログインをブロックしない（警告のみ）
      context.warn('Trusted alias check error:', (e as Error).message);
    }

    // ⑥ クリエイターのロールを使って JWT を発行
    const creatorRole = creator.role ?? 'designer';
    const tokenMaxAge = (creatorRole === 'system_admin' || creatorRole === 'user_admin') ? 8 * 3600
      : creatorRole === 'designer' ? 8 * 3600
      : 24 * 3600;
    const token = createToken(creatorRole, creator.id);
    return {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookie(token, tokenMaxAge) },
      jsonBody: { role: creatorRole, creatorId: creator.id, name: creator.name },
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
