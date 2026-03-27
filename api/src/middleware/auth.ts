/**
 * 認証ミドルウェア — JWT Cookie の検証・ロールチェック
 */
import jwt from 'jsonwebtoken';
import type { HttpRequest } from '@azure/functions';
import type { JwtPayload, UserRole } from '../shared/types.js';

/**
 * 環境変数を取得する。未設定の場合はエラーをスローする。
 * モジュール初期化時ではなく、各関数が呼ばれたタイミングで評価する（遅延評価）。
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Cookie ヘッダーから指定キーの値を取り出す
 */
function parseCookie(req: HttpRequest, key: string): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  const match = header.split(';').find((c) => c.trim().startsWith(`${key}=`));
  return match?.split('=').slice(1).join('=').trim();
}

/**
 * JWT トークン生成
 */
export function createToken(role: UserRole, creatorId?: string): string {
  const secret = getRequiredEnv('JWT_SECRET');
  const expiresIn = role === 'viewer' ? '24h' : '8h';
  const payload: Pick<JwtPayload, 'role' | 'creatorId'> = { role };
  if (creatorId) payload.creatorId = creatorId;
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * JWT Cookie の Set-Cookie ヘッダー値を生成
 */
export function buildSessionCookie(token: string, maxAge: number): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/**
 * Cookie を消去する Set-Cookie ヘッダー値
 */
export function buildClearCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

/**
 * リクエストから JWT を検証してロールを返す。失敗時は null。
 */
export function authenticate(req: HttpRequest): JwtPayload | null {
  const token = parseCookie(req, 'session');
  if (!token) return null;
  try {
    const secret = getRequiredEnv('JWT_SECRET');
    const payload = jwt.verify(token, secret) as JwtPayload;
    if (!payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * ロール階層（数値が大きいほど上位）
 */
const ROLE_LEVEL: Record<UserRole, number> = {
  viewer: 0,
  designer: 1,
  user_admin: 2,
  system_admin: 3,
};

/**
 * 管理者ロールかどうか
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'system_admin' || role === 'user_admin';
}

/**
 * 指定ロールの認証を要求するヘルパー。
 * 認証失敗時は 401 レスポンスオブジェクトを返す。成功時は payload を返す。
 * allowedRoles に含まれるロール以上の権限があれば許可する（階層チェック）。
 */
export function requireRole(
  req: HttpRequest,
  ...allowedRoles: UserRole[]
): { status: 401; body: string } | { payload: JwtPayload } {
  const payload = authenticate(req);
  if (!payload) {
    return { status: 401, body: 'Unauthorized' };
  }
  // 明示的に許可リストに含まれるか、いずれかの allowed role 以上の権限があれば OK
  const userLevel = ROLE_LEVEL[payload.role] ?? 0;
  const minRequired = Math.min(...allowedRoles.map((r) => ROLE_LEVEL[r] ?? 0));
  if (userLevel < minRequired && !allowedRoles.includes(payload.role)) {
    return { status: 401, body: 'Unauthorized' };
  }
  return { payload };
}

/**
 * セッション JWT の期限切れを検出する。
 * Cookie は存在するが署名検証失敗 (期限切れ含む) の場合に true を返す。
 */
export function isSessionExpired(req: HttpRequest): boolean {
  const token = parseCookie(req, 'session');
  if (!token) return false;
  try {
    const secret = getRequiredEnv('JWT_SECRET');
    jwt.verify(token, secret);
    return false; // 有効なトークン
  } catch (e: unknown) {
    if (e instanceof jwt.TokenExpiredError) return true;
    return false; // 他のエラー（改ざんなど）は期限切れとは別
  }
}

/**
 * クライアント IP アドレスを取得するヘルパー
 */
export function getClientIp(req: HttpRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const direct = req.headers.get('x-client-ip') ?? req.headers.get('x-ms-client-ip');
  if (direct) return direct.trim();
  return 'unknown';
}
